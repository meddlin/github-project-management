#!/usr/bin/env node
import { Command } from "commander";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFile = process.env.GPM_ENV_FILE
  ? process.env.GPM_ENV_FILE
  : [".env", "../../.env"]
      .map((path) => resolve(process.cwd(), path))
      .find((path) => existsSync(path));

config({ path: envFile, quiet: true });

const requiredEnvVars = ["DATABASE_URL", "GITHUB_PAT"] as const;

const program = new Command();

type GitHubPageInfo = {
  endCursor: string | null;
  hasNextPage: boolean;
};

type GitHubRepositoryNode = {
  databaseId: number | null;
  defaultBranchRef: { name: string } | null;
  id: string;
  isArchived: boolean;
  isFork: boolean;
  isPrivate: boolean;
  issues: { totalCount: number };
  name: string;
  nameWithOwner: string;
  openIssues: { totalCount: number };
  owner: { login: string };
  projectsV2: { totalCount: number };
  pushedAt: string | null;
  updatedAt: string | null;
  url: string;
  visibility: string;
};

type GitHubRepositoriesResponse = {
  data?: {
    viewer: {
      repositories: {
        nodes: Array<GitHubRepositoryNode | null>;
        pageInfo: GitHubPageInfo;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

const repositoriesQuery = `
  query Repositories($after: String) {
    viewer {
      repositories(
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        first: 100
        after: $after
        orderBy: { field: NAME, direction: ASC }
      ) {
        nodes {
          databaseId
          defaultBranchRef {
            name
          }
          id
          isArchived
          isFork
          isPrivate
          issues(first: 1, states: [OPEN, CLOSED]) {
            totalCount
          }
          name
          nameWithOwner
          openIssues: issues(first: 1, states: OPEN) {
            totalCount
          }
          owner {
            login
          }
          projectsV2(first: 1) {
            totalCount
          }
          pushedAt
          updatedAt
          url
          visibility
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

function validateEnvironment(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Environment configuration is valid.");
}

function requireEnvironment(): boolean {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exitCode = 1;
    return false;
  }

  return true;
}

function parseGitHubDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

async function fetchGitHubRepositories(token: string): Promise<GitHubRepositoryNode[]> {
  const repositories: GitHubRepositoryNode[] = [];
  let after: string | null = null;

  do {
    const response = await fetch("https://api.github.com/graphql", {
      body: JSON.stringify({
        query: repositoriesQuery,
        variables: { after }
      }),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "github-project-management"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GitHubRepositoriesResponse;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.viewer.repositories;

    if (!connection) {
      throw new Error("GitHub GraphQL response did not include repositories.");
    }

    repositories.push(
      ...connection.nodes.filter((node): node is GitHubRepositoryNode => node !== null)
    );
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return repositories;
}

async function syncRepositories(): Promise<void> {
  if (!requireEnvironment()) {
    return;
  }

  const token = process.env.GITHUB_PAT;

  if (!token) {
    return;
  }

  const { prisma } = await import("@gpm/db");
  let syncRun: { id: string } | null = null;

  try {
    syncRun = await prisma.gitHubRepositorySyncRun.create({
      data: {
        status: "running"
      }
    });

    const repositories = await fetchGitHubRepositories(token);
    const syncedAt = new Date();

    for (const repository of repositories) {
      const githubId = repository.databaseId?.toString() ?? repository.id;
      const linkedProjectCount = repository.projectsV2.totalCount;
      const issueCount = repository.issues.totalCount;

      await prisma.gitHubRepository.upsert({
        create: {
          defaultBranch: repository.defaultBranchRef?.name,
          fullName: repository.nameWithOwner,
          githubId,
          githubUpdatedAt: parseGitHubDate(repository.updatedAt),
          hasIssuesCreated: issueCount > 0,
          hasLinkedProject: linkedProjectCount > 0,
          isArchived: repository.isArchived,
          isFork: repository.isFork,
          isPrivate: repository.isPrivate,
          issueCount,
          linkedProjectCount,
          name: repository.name,
          nodeId: repository.id,
          openIssueCount: repository.openIssues.totalCount,
          owner: repository.owner.login,
          pushedAt: parseGitHubDate(repository.pushedAt),
          syncedAt,
          url: repository.url,
          visibility: repository.visibility
        },
        update: {
          defaultBranch: repository.defaultBranchRef?.name,
          fullName: repository.nameWithOwner,
          githubUpdatedAt: parseGitHubDate(repository.updatedAt),
          hasIssuesCreated: issueCount > 0,
          hasLinkedProject: linkedProjectCount > 0,
          isArchived: repository.isArchived,
          isFork: repository.isFork,
          isPrivate: repository.isPrivate,
          issueCount,
          linkedProjectCount,
          name: repository.name,
          nodeId: repository.id,
          openIssueCount: repository.openIssues.totalCount,
          owner: repository.owner.login,
          pushedAt: parseGitHubDate(repository.pushedAt),
          syncedAt,
          url: repository.url,
          visibility: repository.visibility
        },
        where: {
          githubId
        }
      });
    }

    await prisma.gitHubRepositorySyncRun.update({
      data: {
        finishedAt: new Date(),
        repositoryCount: repositories.length,
        status: "success"
      },
      where: {
        id: syncRun.id
      }
    });

    console.log(`Synced ${repositories.length} GitHub repositories.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure.";

    if (syncRun) {
      await prisma.gitHubRepositorySyncRun.update({
        data: {
          error: message,
          finishedAt: new Date(),
          status: "failed"
        },
        where: {
          id: syncRun.id
        }
      });
    }

    console.error(`Repository sync failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

program
  .name("gpm")
  .description("CLI for GitHub project management workflows.")
  .version("0.1.0");

program
  .command("doctor")
  .description("Validate local configuration required by the CLI.")
  .action(validateEnvironment);

program
  .command("repos")
  .description("Manage persisted GitHub repository inventory.")
  .command("sync")
  .description("Sync repositories visible to GITHUB_PAT into Postgres.")
  .action(syncRepositories);

const scriptArgs = process.argv.slice(2);
const argv =
  scriptArgs[0] === "--"
    ? [...process.argv.slice(0, 2), ...scriptArgs.slice(1)]
    : process.argv;

program.parse(argv);
