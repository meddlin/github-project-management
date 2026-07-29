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

type GitHubIssueNode = {
  assignees: {
    nodes: Array<{ login: string } | null>;
  };
  author: { login: string } | null;
  closedAt: string | null;
  comments: { totalCount: number };
  createdAt: string;
  databaseId: number | null;
  id: string;
  labels: {
    nodes: Array<{ name: string } | null>;
  };
  number: number;
  state: string;
  title: string;
  updatedAt: string;
  url: string;
};

type GitHubProjectFieldNode = {
  id: string;
  name: string;
  options?: Array<{
    id: string;
    name: string;
  }>;
};

type GitHubRepositoryProjectNode = {
  fields: {
    nodes: Array<GitHubProjectFieldNode | null>;
  };
  id: string;
  owner: { login: string } | null;
  title: string;
  url: string;
};

type GitHubProjectItemContentNode =
  | {
      __typename: "Issue";
      id: string;
      number: number;
      repository: {
        nameWithOwner: string;
      } | null;
    }
  | {
      __typename: "DraftIssue";
      assignees: {
        nodes: Array<{ login: string } | null>;
      };
      bodyText: string;
      createdAt: string;
      creator: { login: string } | null;
      id: string;
      title: string;
      updatedAt: string;
    }
  | {
      __typename: string;
    };

type GitHubProjectItemNode = {
  content: GitHubProjectItemContentNode | null;
  fieldValueByName: {
    field: { id: string; name: string } | null;
    name: string | null;
    optionId: string | null;
    updatedAt: string;
  } | null;
  id: string;
  updatedAt: string;
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

type GitHubIssuesResponse = {
  data?: {
    repository: {
      issues: {
        nodes: Array<GitHubIssueNode | null>;
        pageInfo: GitHubPageInfo;
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
};

type GitHubRepositoryProjectsResponse = {
  data?: {
    repository: {
      projectsV2: {
        nodes: Array<GitHubRepositoryProjectNode | null>;
        pageInfo: GitHubPageInfo;
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
};

type GitHubProjectItemsResponse = {
  data?: {
    node: {
      items: {
        nodes: Array<GitHubProjectItemNode | null>;
        pageInfo: GitHubPageInfo;
      };
    } | null;
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

const issuesQuery = `
  query Issues($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      issues(
        first: 100
        after: $after
        states: [OPEN, CLOSED]
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          assignees(first: 20) {
            nodes {
              login
            }
          }
          author {
            login
          }
          closedAt
          comments {
            totalCount
          }
          createdAt
          databaseId
          id
          labels(first: 20) {
            nodes {
              name
            }
          }
          number
          state
          title
          updatedAt
          url
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

const repositoryProjectsQuery = `
  query RepositoryProjects($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      projectsV2(first: 50, after: $after) {
        nodes {
          id
          title
          url
          owner {
            ... on Organization {
              login
            }
            ... on User {
              login
            }
          }
          fields(first: 50) {
            nodes {
              ... on ProjectV2FieldCommon {
                id
                name
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

const projectItemsQuery = `
  query ProjectItems($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100, after: $after) {
          nodes {
            id
            updatedAt
            content {
              __typename
              ... on Issue {
                id
                number
                repository {
                  nameWithOwner
                }
              }
              ... on DraftIssue {
                assignees(first: 20) {
                  nodes {
                    login
                  }
                }
                bodyText
                createdAt
                creator {
                  login
                }
                id
                title
                updatedAt
              }
            }
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
                name
                optionId
                updatedAt
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

type PlanningStatusValue =
  | "NO_STATUS"
  | "BACKLOG"
  | "READY"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

const labelStatusMap = new Map<string, PlanningStatusValue>([
  ["backlog", "BACKLOG"],
  ["ready", "READY"],
  ["in progress", "IN_PROGRESS"],
  ["in-progress", "IN_PROGRESS"],
  ["in_progress", "IN_PROGRESS"],
  ["in review", "IN_REVIEW"],
  ["in-review", "IN_REVIEW"],
  ["in_review", "IN_REVIEW"],
  ["done", "DONE"]
]);

const projectStatusMap = new Map<string, PlanningStatusValue>([
  ["backlog", "BACKLOG"],
  ["ready", "READY"],
  ["in progress", "IN_PROGRESS"],
  ["in review", "IN_REVIEW"],
  ["done", "DONE"]
]);

function normalizeStatusName(value: string): string {
  return value.trim().toLowerCase();
}

function mapLabelsToPlanningStatus(labels: string[]): PlanningStatusValue {
  for (const label of labels) {
    const status = labelStatusMap.get(normalizeStatusName(label));

    if (status) {
      return status;
    }
  }

  return "NO_STATUS";
}

function mapProjectStatus(value: string | null | undefined): PlanningStatusValue {
  return value ? projectStatusMap.get(normalizeStatusName(value)) ?? "NO_STATUS" : "NO_STATUS";
}

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

function isDraftIssueContent(
  content: GitHubProjectItemContentNode
): content is Extract<GitHubProjectItemContentNode, { __typename: "DraftIssue" }> {
  return content.__typename === "DraftIssue" && "title" in content;
}

function isIssueContent(
  content: GitHubProjectItemContentNode
): content is Extract<GitHubProjectItemContentNode, { __typename: "Issue" }> {
  return content.__typename === "Issue" && "id" in content;
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

async function fetchGitHubIssues({
  name,
  owner,
  token
}: {
  name: string;
  owner: string;
  token: string;
}): Promise<GitHubIssueNode[]> {
  const issues: GitHubIssueNode[] = [];
  let after: string | null = null;

  do {
    const response = await fetch("https://api.github.com/graphql", {
      body: JSON.stringify({
        query: issuesQuery,
        variables: { after, name, owner }
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
      throw new Error(
        `GitHub issues GraphQL request failed for ${owner}/${name}: ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as GitHubIssuesResponse;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.repository?.issues;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include issues for ${owner}/${name}.`);
    }

    issues.push(...connection.nodes.filter((node): node is GitHubIssueNode => node !== null));
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return issues;
}

async function fetchGitHubRepositoryProjects({
  name,
  owner,
  token
}: {
  name: string;
  owner: string;
  token: string;
}): Promise<GitHubRepositoryProjectNode[]> {
  const projects: GitHubRepositoryProjectNode[] = [];
  let after: string | null = null;

  do {
    const response = await fetch("https://api.github.com/graphql", {
      body: JSON.stringify({
        query: repositoryProjectsQuery,
        variables: { after, name, owner }
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
      throw new Error(
        `GitHub projects GraphQL request failed for ${owner}/${name}: ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as GitHubRepositoryProjectsResponse;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.repository?.projectsV2;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include projects for ${owner}/${name}.`);
    }

    projects.push(...connection.nodes.filter((node): node is GitHubRepositoryProjectNode => node !== null));
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return projects;
}

async function fetchGitHubProjectItems({
  projectId,
  token
}: {
  projectId: string;
  token: string;
}): Promise<GitHubProjectItemNode[]> {
  const items: GitHubProjectItemNode[] = [];
  let after: string | null = null;

  do {
    const response = await fetch("https://api.github.com/graphql", {
      body: JSON.stringify({
        query: projectItemsQuery,
        variables: { after, projectId }
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
      throw new Error(
        `GitHub project items GraphQL request failed for ${projectId}: ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as GitHubProjectItemsResponse;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.node?.items;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include project items for ${projectId}.`);
    }

    items.push(...connection.nodes.filter((node): node is GitHubProjectItemNode => node !== null));
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return items;
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

      const persistedRepository = await prisma.gitHubRepository.upsert({
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

      const issues = await fetchGitHubIssues({
        name: repository.name,
        owner: repository.owner.login,
        token
      });
      const syncedIssueNodeIds: string[] = [];

      for (const issue of issues) {
        syncedIssueNodeIds.push(issue.id);
        const labels = issue.labels.nodes
          .filter((label): label is { name: string } => label !== null)
          .map((label) => label.name);
        const assignees = issue.assignees.nodes
          .filter((assignee): assignee is { login: string } => assignee !== null)
          .map((assignee) => assignee.login);
        const labelPlanningStatus = mapLabelsToPlanningStatus(labels);
        const labelPlanningStatusSource =
          labelPlanningStatus === "NO_STATUS" ? "NONE" : "GITHUB_LABEL";

        const persistedIssue = await prisma.gitHubIssue.upsert({
          create: {
            assignees,
            authorLogin: issue.author?.login ?? null,
            closedAt: parseGitHubDate(issue.closedAt),
            commentCount: issue.comments.totalCount,
            createdAt: new Date(issue.createdAt),
            githubId: issue.databaseId?.toString() ?? issue.id,
            labels,
            nodeId: issue.id,
            number: issue.number,
            planningStatus: labelPlanningStatus,
            planningStatusSource: labelPlanningStatusSource,
            planningStatusUpdatedAt:
              labelPlanningStatus === "NO_STATUS" ? null : syncedAt,
            repositoryId: persistedRepository.id,
            state: issue.state,
            syncedAt,
            title: issue.title,
            updatedAt: new Date(issue.updatedAt),
            url: issue.url
          },
          update: {
            assignees,
            authorLogin: issue.author?.login ?? null,
            closedAt: parseGitHubDate(issue.closedAt),
            commentCount: issue.comments.totalCount,
            githubId: issue.databaseId?.toString() ?? issue.id,
            labels,
            number: issue.number,
            state: issue.state,
            syncedAt,
            title: issue.title,
            updatedAt: new Date(issue.updatedAt),
            url: issue.url
          },
          where: {
            repositoryId_number: {
              number: issue.number,
              repositoryId: persistedRepository.id
            }
          }
        });

        if (
          persistedIssue.planningStatusSource === "NONE" ||
          persistedIssue.planningStatusSource === "GITHUB_LABEL"
        ) {
          await prisma.gitHubIssue.update({
            data: {
              planningStatus: labelPlanningStatus,
              planningStatusSource: labelPlanningStatusSource,
              planningStatusUpdatedAt:
                labelPlanningStatus === "NO_STATUS" ? null : syncedAt
            },
            where: {
              id: persistedIssue.id
            }
          });
        }
      }

      await prisma.gitHubIssue.deleteMany({
        where: {
          repositoryId: persistedRepository.id,
          ...(syncedIssueNodeIds.length > 0 ? { nodeId: { notIn: syncedIssueNodeIds } } : {})
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

async function applyImportedProjectStatus({
  issueId,
  prisma
}: {
  issueId: string;
  prisma: Awaited<typeof import("@gpm/db")>["prisma"];
}): Promise<void> {
  const issue = await prisma.gitHubIssue.findUnique({
    include: {
      projectItems: {
        include: {
          project: true
        }
      }
    },
    where: {
      id: issueId
    }
  });

  if (!issue || issue.planningStatusSource === "LOCAL") {
    return;
  }

  const bestItem = [...issue.projectItems].sort((left, right) => {
    const leftTime = left.itemUpdatedAt?.getTime() ?? left.importedAt.getTime();
    const rightTime = right.itemUpdatedAt?.getTime() ?? right.importedAt.getTime();

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    const titleCompare = left.project.title.localeCompare(right.project.title);

    if (titleCompare !== 0) {
      return titleCompare;
    }

    return left.project.nodeId.localeCompare(right.project.nodeId);
  })[0];

  if (!bestItem) {
    return;
  }

  const planningStatus = mapProjectStatus(bestItem.importedStatusName);

  await prisma.gitHubIssue.update({
    data: {
      planningStatus,
      planningStatusSource:
        planningStatus === "NO_STATUS" ? "NONE" : "GITHUB_PROJECT",
      planningStatusUpdatedAt:
        planningStatus === "NO_STATUS" ? null : bestItem.importedAt
    },
    where: {
      id: issue.id
    }
  });
}

async function importProjectStatuses(): Promise<void> {
  if (!requireEnvironment()) {
    return;
  }

  const token = process.env.GITHUB_PAT;

  if (!token) {
    return;
  }

  const { prisma } = await import("@gpm/db");
  const repositories = await prisma.gitHubRepository.findMany({
    orderBy: {
      fullName: "asc"
    },
    where: {
      linkedProjectCount: {
        gt: 0
      }
    }
  });
  const importedAt = new Date();
  const importedProjectIds = new Set<string>();
  let importedProjectCount = 0;
  let importedItemCount = 0;
  let warningCount = 0;

  try {
    for (const repository of repositories) {
      const projects = await fetchGitHubRepositoryProjects({
        name: repository.name,
        owner: repository.owner,
        token
      });

      for (const project of projects) {
        const statusField = project.fields.nodes.find((field) => {
          return field?.name === "Status" && Array.isArray(field.options);
        });

        if (!statusField) {
          warningCount += 1;
          console.warn(
            `Skipping ${project.title} for ${repository.fullName}: missing Status single-select field.`
          );
          continue;
        }

        const persistedProject = await prisma.gitHubProject.upsert({
          create: {
            importedAt,
            nodeId: project.id,
            owner: project.owner?.login ?? repository.owner,
            title: project.title,
            url: project.url
          },
          update: {
            importedAt,
            owner: project.owner?.login ?? repository.owner,
            title: project.title,
            url: project.url
          },
          where: {
            nodeId: project.id
          }
        });

        await prisma.gitHubRepositoryProject.upsert({
          create: {
            importedAt,
            projectId: persistedProject.id,
            repositoryId: repository.id
          },
          update: {
            importedAt
          },
          where: {
            repositoryId_projectId: {
              projectId: persistedProject.id,
              repositoryId: repository.id
            }
          }
        });

        if (importedProjectIds.has(project.id)) {
          continue;
        }

        importedProjectIds.add(project.id);
        importedProjectCount += 1;

        const items = await fetchGitHubProjectItems({
          projectId: project.id,
          token
        });

        for (const item of items) {
          if (!item.content) {
            continue;
          }

          const statusValue = item.fieldValueByName;

          if (isDraftIssueContent(item.content)) {
            const draftAssignees = item.content.assignees.nodes
              .filter((assignee): assignee is { login: string } => assignee !== null)
              .map((assignee) => assignee.login);

            await prisma.gitHubProjectItem.upsert({
              create: {
                contentType: "DRAFT_ISSUE",
                draftAssignees,
                draftAuthorLogin: item.content.creator?.login ?? null,
                draftBodyText: item.content.bodyText,
                draftCreatedAt: new Date(item.content.createdAt),
                draftTitle: item.content.title,
                draftUpdatedAt: new Date(item.content.updatedAt),
                importedAt,
                importedStatusName: statusValue?.name ?? null,
                importedStatusOption: statusValue?.optionId ?? null,
                itemUpdatedAt: parseGitHubDate(statusValue?.updatedAt ?? item.updatedAt),
                nodeId: item.id,
                projectId: persistedProject.id
              },
              update: {
                contentType: "DRAFT_ISSUE",
                draftAssignees,
                draftAuthorLogin: item.content.creator?.login ?? null,
                draftBodyText: item.content.bodyText,
                draftCreatedAt: new Date(item.content.createdAt),
                draftTitle: item.content.title,
                draftUpdatedAt: new Date(item.content.updatedAt),
                importedAt,
                importedStatusName: statusValue?.name ?? null,
                importedStatusOption: statusValue?.optionId ?? null,
                issueId: null,
                itemUpdatedAt: parseGitHubDate(statusValue?.updatedAt ?? item.updatedAt),
                projectId: persistedProject.id
              },
              where: {
                nodeId: item.id
              }
            });

            importedItemCount += 1;
            continue;
          }

          if (!isIssueContent(item.content)) {
            continue;
          }

          const issue = await prisma.gitHubIssue.findUnique({
            where: {
              nodeId: item.content.id
            }
          });

          if (!issue) {
            continue;
          }

          await prisma.gitHubProjectItem.upsert({
            create: {
              contentType: "ISSUE",
              draftAssignees: [],
              draftAuthorLogin: null,
              draftBodyText: null,
              draftCreatedAt: null,
              draftTitle: null,
              draftUpdatedAt: null,
              importedAt,
              importedStatusName: statusValue?.name ?? null,
              importedStatusOption: statusValue?.optionId ?? null,
              issueId: issue.id,
              itemUpdatedAt: parseGitHubDate(statusValue?.updatedAt ?? item.updatedAt),
              nodeId: item.id,
              projectId: persistedProject.id
            },
            update: {
              contentType: "ISSUE",
              draftAssignees: [],
              draftAuthorLogin: null,
              draftBodyText: null,
              draftCreatedAt: null,
              draftTitle: null,
              draftUpdatedAt: null,
              importedAt,
              importedStatusName: statusValue?.name ?? null,
              importedStatusOption: statusValue?.optionId ?? null,
              issueId: issue.id,
              itemUpdatedAt: parseGitHubDate(statusValue?.updatedAt ?? item.updatedAt),
              projectId: persistedProject.id
            },
            where: {
              nodeId: item.id
            }
          });

          await applyImportedProjectStatus({
            issueId: issue.id,
            prisma
          });

          importedItemCount += 1;
        }
      }
    }

    console.log(
      `Imported ${importedItemCount} project issue statuses from ${importedProjectCount} GitHub projects.`
    );

    if (warningCount > 0) {
      console.warn(`${warningCount} projects were skipped because they do not expose a Status field.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown project import failure.";

    console.error(`Project status import failed: ${message}`);
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

program
  .command("projects")
  .description("Manage imported GitHub Projects planning data.")
  .command("import-statuses")
  .description("Import linked GitHub Projects v2 issue statuses into Postgres.")
  .action(importProjectStatuses);

const scriptArgs = process.argv.slice(2);
const argv =
  scriptArgs[0] === "--"
    ? [...process.argv.slice(0, 2), ...scriptArgs.slice(1)]
    : process.argv;

program.parse(argv);
