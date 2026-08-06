import { prisma } from "@gpm/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const accessLog = new Map<string, { count: number; startedAt: number }>();

type RepoDetailsTab = "issues" | "pullRequests";

function isValidRepositoryId(value: string) {
  return /^[a-z0-9_-]{8,64}$/i.test(value);
}

function parseLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(value: string | null) {
  if (!value) {
    return 0;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      offset?: unknown;
    };

    return typeof parsed.offset === "number" && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

function parseTab(value: string | null): RepoDetailsTab {
  return value === "pullRequests" ? "pullRequests" : "issues";
}

function toIsoString(value: Date | null) {
  return value?.toISOString() ?? null;
}

function notFound() {
  return Response.json(
    { error: "Repository not found." },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status: 404
    }
  );
}

function logRepositoryAccess(repositoryId: string, path: string) {
  const now = Date.now();
  const existing = accessLog.get(repositoryId);
  const entry =
    existing && now - existing.startedAt < 60_000
      ? { count: existing.count + 1, startedAt: existing.startedAt }
      : { count: 1, startedAt: now };

  accessLog.set(repositoryId, entry);

  if (entry.count === 25 || entry.count % 50 === 0) {
    console.warn("[repos-api] repeated repository details access", {
      count: entry.count,
      path,
      repositoryId,
      windowSeconds: Math.round((now - entry.startedAt) / 1000)
    });
  }
}

function createNdjsonStream(chunks: unknown[]) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      }

      controller.close();
    }
  });
}

async function loadRepositorySummary(repositoryId: string) {
  return prisma.gitHubRepository.findUnique({
    select: {
      defaultBranch: true,
      favorite: true,
      fullName: true,
      hasIssuesCreated: true,
      hasLinkedProject: true,
      id: true,
      isArchived: true,
      isFork: true,
      issueCount: true,
      linkedProjectCount: true,
      name: true,
      openIssueCount: true,
      openPullRequestCount: true,
      owner: true,
      primaryLanguageColor: true,
      primaryLanguageName: true,
      pullRequestCount: true,
      pullRequestsSyncedAt: true,
      pushedAt: true,
      syncedAt: true,
      url: true,
      visibility: true
    },
    where: {
      id: repositoryId
    }
  });
}

async function loadIssueChunk({
  limit,
  offset,
  repositoryId
}: {
  limit: number;
  offset: number;
  repositoryId: string;
}) {
  const issues = await prisma.gitHubIssue.findMany({
    orderBy: [{ state: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
    select: {
      assignees: true,
      authorLogin: true,
      commentCount: true,
      createdAt: true,
      labels: true,
      number: true,
      state: true,
      title: true,
      updatedAt: true,
      url: true
    },
    skip: offset,
    take: limit + 1,
    where: {
      repositoryId
    }
  });
  const hasMore = issues.length > limit;
  const page = hasMore ? issues.slice(0, limit) : issues;

  return {
    cursor: hasMore ? encodeCursor(offset + limit) : null,
    items: page.map((issue) => ({
      assignees: issue.assignees,
      authorLogin: issue.authorLogin,
      commentCount: issue.commentCount,
      createdAt: issue.createdAt.toISOString(),
      labels: issue.labels,
      number: issue.number,
      state: issue.state,
      title: issue.title,
      updatedAt: issue.updatedAt.toISOString(),
      url: issue.url
    }))
  };
}

async function loadPullRequestChunk({
  limit,
  offset,
  repositoryId
}: {
  limit: number;
  offset: number;
  repositoryId: string;
}) {
  const pullRequests = await prisma.gitHubPullRequest.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      authorLogin: true,
      commentCount: true,
      createdAt: true,
      isDraft: true,
      number: true,
      state: true,
      title: true,
      updatedAt: true,
      url: true
    },
    skip: offset,
    take: limit + 1,
    where: {
      repositoryId,
      state: "OPEN"
    }
  });
  const hasMore = pullRequests.length > limit;
  const page = hasMore ? pullRequests.slice(0, limit) : pullRequests;

  return {
    cursor: hasMore ? encodeCursor(offset + limit) : null,
    items: page.map((pullRequest) => ({
      authorLogin: pullRequest.authorLogin,
      commentCount: pullRequest.commentCount,
      createdAt: pullRequest.createdAt.toISOString(),
      isDraft: pullRequest.isDraft,
      number: pullRequest.number,
      state: pullRequest.state,
      title: pullRequest.title,
      updatedAt: pullRequest.updatedAt.toISOString(),
      url: pullRequest.url
    }))
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const path = `${url.pathname}${url.search}`;

  if (!isValidRepositoryId(id)) {
    return notFound();
  }

  logRepositoryAccess(id, path);

  try {
    const tab = parseTab(url.searchParams.get("tab"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = decodeCursor(url.searchParams.get("cursor"));
    const repository = await loadRepositorySummary(id);

    if (!repository) {
      return notFound();
    }

    const list =
      tab === "pullRequests"
        ? await loadPullRequestChunk({ limit, offset, repositoryId: repository.id })
        : await loadIssueChunk({ limit, offset, repositoryId: repository.id });

    const chunks = [
      ...(offset === 0
        ? [
            {
              repository: {
                defaultBranch: repository.defaultBranch,
                favorite: repository.favorite,
                fullName: repository.fullName,
                hasIssuesCreated: repository.hasIssuesCreated,
                hasLinkedProject: repository.hasLinkedProject,
                id: repository.id,
                isArchived: repository.isArchived,
                isFork: repository.isFork,
                issueCount: repository.issueCount,
                linkedProjectCount: repository.linkedProjectCount,
                name: repository.name,
                openIssueCount: repository.openIssueCount,
                openPullRequestCount: repository.openPullRequestCount,
                owner: repository.owner,
                primaryLanguageColor: repository.primaryLanguageColor,
                primaryLanguageName: repository.primaryLanguageName,
                pullRequestCount: repository.pullRequestCount,
                pullRequestsSyncedAt: toIsoString(repository.pullRequestsSyncedAt),
                pushedAt: toIsoString(repository.pushedAt),
                syncedAt: repository.syncedAt.toISOString(),
                url: repository.url,
                visibility: repository.visibility
              },
              type: "summary"
            }
          ]
        : []),
      {
        cursor: list.cursor,
        items: list.items,
        tab,
        type: "items"
      }
    ];

    return new Response(createNdjsonStream(chunks), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson"
      }
    });
  } catch (error) {
    console.error("[repos-api] failed to load repository details", {
      error: error instanceof Error ? error.message : "Unknown error",
      path,
      repositoryId: id
    });

    return Response.json(
      { error: "Unable to load repository details." },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
