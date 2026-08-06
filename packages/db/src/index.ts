import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = process.env.GPM_ENV_FILE
  ? process.env.GPM_ENV_FILE
  : [".env", "../../.env"]
      .map((path) => resolve(packageRoot, path))
      .find((path) => existsSync(path));

config({ path: envFile, quiet: true });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

type GitHubGraphqlError = {
  message: string;
  type?: string;
};

type GitHubGraphqlPayload<T> = T & {
  errors?: GitHubGraphqlError[];
};

type GitHubRateLimitMetadata = {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
  resource: string | null;
  used: string | null;
};

type GitHubRequestOptions = {
  maxRetries?: number;
  maxSleepMs?: number;
  requestName: string;
  token: string;
};

type GitHubGraphqlRequestOptions = GitHubRequestOptions & {
  query: string;
  variables: Record<string, unknown>;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_SLEEP_MS = Number.POSITIVE_INFINITY;
const FALLBACK_RATE_LIMIT_WAIT_MS = 60_000;
const serialQueues = new Map<string, Promise<unknown>>();

function readRateLimitMetadata(response: Response): GitHubRateLimitMetadata {
  return {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset"),
    resource: response.headers.get("x-ratelimit-resource"),
    used: response.headers.get("x-ratelimit-used")
  };
}

function logRateLimitMetadata(requestName: string, metadata: GitHubRateLimitMetadata) {
  if (!metadata.limit && !metadata.remaining && !metadata.reset && !metadata.used) {
    return;
  }

  console.info("[github-api] rate limit", {
    limit: metadata.limit,
    remaining: metadata.remaining,
    requestName,
    reset: metadata.reset,
    resource: metadata.resource,
    used: metadata.used
  });
}

function parseRetryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");

  if (!value) {
    return null;
  }

  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

function parseRateLimitResetMs(response: Response): number | null {
  const value = response.headers.get("x-ratelimit-reset");

  if (!value || response.headers.get("x-ratelimit-remaining") !== "0") {
    return null;
  }

  const resetMs = Number(value) * 1000;
  const waitMs = resetMs - Date.now();

  return Number.isFinite(waitMs) && waitMs > 0 ? waitMs : 0;
}

function isRateLimited({
  errors,
  response
}: {
  errors?: GitHubGraphqlError[];
  response: Response;
}) {
  if (response.status === 403 || response.status === 429) {
    return true;
  }

  if (response.headers.get("x-ratelimit-remaining") === "0") {
    return true;
  }

  return (
    errors?.some((error) => {
      const message = error.message.toLowerCase();
      return (
        error.type === "RATE_LIMITED" ||
        message.includes("rate limit") ||
        message.includes("secondary rate limit")
      );
    }) ?? false
  );
}

function computeBackoffMs({
  attempt,
  maxSleepMs,
  response
}: {
  attempt: number;
  maxSleepMs: number;
  response: Response;
}) {
  const retryAfterMs = parseRetryAfterMs(response);

  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, maxSleepMs);
  }

  const resetMs = parseRateLimitResetMs(response);

  if (resetMs !== null) {
    return Math.min(resetMs, maxSleepMs);
  }

  return Math.min(FALLBACK_RATE_LIMIT_WAIT_MS * 2 ** attempt, maxSleepMs);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runSerially<T>(queueKey: string, task: () => Promise<T>): Promise<T> {
  const previous = serialQueues.get(queueKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);

  serialQueues.set(queueKey, next);

  try {
    return await next;
  } finally {
    if (serialQueues.get(queueKey) === next) {
      serialQueues.delete(queueKey);
    }
  }
}

export async function requestGitHubGraphql<T>({
  maxRetries = DEFAULT_MAX_RETRIES,
  maxSleepMs = DEFAULT_MAX_SLEEP_MS,
  query,
  requestName,
  token,
  variables
}: GitHubGraphqlRequestOptions): Promise<T> {
  return runSerially(token, async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch("https://api.github.com/graphql", {
        body: JSON.stringify({
          query,
          variables
        }),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "github-project-management"
        },
        method: "POST"
      });
      const metadata = readRateLimitMetadata(response);

      logRateLimitMetadata(requestName, metadata);

      let payload: GitHubGraphqlPayload<T> | null = null;

      try {
        payload = (await response.json()) as GitHubGraphqlPayload<T>;
      } catch {
        payload = null;
      }

      if (!response.ok || payload?.errors?.length) {
        if (isRateLimited({ errors: payload?.errors, response }) && attempt < maxRetries) {
          const waitMs = computeBackoffMs({ attempt, maxSleepMs, response });

          console.warn("[github-api] rate limited; backing off", {
            attempt: attempt + 1,
            requestName,
            waitMs
          });

          await sleep(waitMs);
          continue;
        }

        const errors = payload?.errors?.map((error) => error.message).filter(Boolean) ?? [];
        const message =
          errors.length > 0
            ? errors.join("; ")
            : `${response.status} ${response.statusText}`.trim();

        throw new Error(`GitHub GraphQL request failed for ${requestName}: ${message}`);
      }

      if (!payload) {
        throw new Error(`GitHub GraphQL request failed for ${requestName}: empty response body`);
      }

      return payload as T;
    }

    throw new Error(`GitHub GraphQL request failed for ${requestName}: retry limit exceeded`);
  });
}

export { PrismaClient };
export type { Prisma } from "@prisma/client";
