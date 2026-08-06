import { prisma, requestGitHubGraphql } from "@gpm/db";
import { pickPrimaryProjectItem } from "./planning-project";

type GitHubPageInfo = {
  endCursor: string | null;
  hasNextPage: boolean;
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
  bodyText: string;
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
  openPullRequests: { totalCount: number };
  owner: { login: string };
  primaryLanguage: { color: string | null; name: string } | null;
  projectsV2: { totalCount: number };
  pullRequests: { totalCount: number };
  pushedAt: string | null;
  updatedAt: string | null;
  url: string;
  visibility: string;
};

type GitHubPullRequestNode = {
  author: { login: string } | null;
  comments: { totalCount: number };
  createdAt: string;
  databaseId: number | null;
  id: string;
  isDraft: boolean;
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

type GitHubRepositoryResponse = {
  data?: {
    repository: GitHubRepositoryNode | null;
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

type GitHubPullRequestsResponse = {
  data?: {
    repository: {
      pullRequests: {
        nodes: Array<GitHubPullRequestNode | null>;
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

type GitHubIssuesConnection = NonNullable<
  NonNullable<GitHubIssuesResponse["data"]>["repository"]
>["issues"];
type GitHubPullRequestsConnection = NonNullable<
  NonNullable<GitHubPullRequestsResponse["data"]>["repository"]
>["pullRequests"];
type GitHubRepositoryProjectsConnection = NonNullable<
  NonNullable<GitHubRepositoryProjectsResponse["data"]>["repository"]
>["projectsV2"];
type GitHubProjectItemsConnection = NonNullable<
  NonNullable<GitHubProjectItemsResponse["data"]>["node"]
>["items"];

const repositoryQuery = `
  query Repository($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
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
      openPullRequests: pullRequests(first: 1, states: OPEN) {
        totalCount
      }
      owner {
        login
      }
      primaryLanguage {
        color
        name
      }
      projectsV2(first: 1) {
        totalCount
      }
      pullRequests(first: 1) {
        totalCount
      }
      pushedAt
      updatedAt
      url
      visibility
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
          bodyText
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

const pullRequestsQuery = `
  query PullRequests($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: 100
        after: $after
        states: OPEN
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          author {
            login
          }
          comments {
            totalCount
          }
          createdAt
          databaseId
          id
          isDraft
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

const labelStatusMap = new Map<string, string>([
  ["backlog", "Backlog"],
  ["ready", "Ready"],
  ["in progress", "In progress"],
  ["in-progress", "In progress"],
  ["in_progress", "In progress"],
  ["in review", "In review"],
  ["in-review", "In review"],
  ["in_review", "In review"],
  ["done", "Done"]
]);

function getStatusOptions(statusField: GitHubProjectFieldNode) {
  return (statusField.options ?? []).map((option) => ({
    id: option.id,
    name: option.name
  }));
}

function normalizeStatusName(value: string): string {
  return value.trim().toLowerCase();
}

function mapLabelsToPlanningStatus(labels: string[]): string | null {
  for (const label of labels) {
    const status = labelStatusMap.get(normalizeStatusName(label));

    if (status) {
      return status;
    }
  }

  return null;
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

async function fetchGitHubRepository({
  name,
  owner,
  token
}: {
  name: string;
  owner: string;
  token: string;
}): Promise<GitHubRepositoryNode> {
  const payload = await requestGitHubGraphql<GitHubRepositoryResponse>({
    query: repositoryQuery,
    requestName: `repository:${owner}/${name}`,
    token,
    variables: {
      name,
      owner
    }
  });
  const repository = payload.data?.repository;

  if (!repository) {
    throw new Error(`GitHub GraphQL response did not include ${owner}/${name}.`);
  }

  return repository;
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
    const payload: GitHubIssuesResponse = await requestGitHubGraphql<GitHubIssuesResponse>({
      query: issuesQuery,
      requestName: `issues:${owner}/${name}`,
      token,
      variables: {
        after,
        name,
        owner
      }
    });
    const connection: GitHubIssuesConnection | undefined = payload.data?.repository?.issues;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include issues for ${owner}/${name}.`);
    }

    issues.push(
      ...connection.nodes.filter((node: GitHubIssueNode | null): node is GitHubIssueNode => node !== null)
    );
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return issues;
}

async function fetchGitHubPullRequests({
  name,
  owner,
  token
}: {
  name: string;
  owner: string;
  token: string;
}): Promise<GitHubPullRequestNode[]> {
  const pullRequests: GitHubPullRequestNode[] = [];
  let after: string | null = null;

  do {
    const payload: GitHubPullRequestsResponse =
      await requestGitHubGraphql<GitHubPullRequestsResponse>({
        query: pullRequestsQuery,
        requestName: `pullRequests:${owner}/${name}`,
        token,
        variables: {
          after,
          name,
          owner
        }
      });
    const connection: GitHubPullRequestsConnection | undefined =
      payload.data?.repository?.pullRequests;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include pull requests for ${owner}/${name}.`);
    }

    pullRequests.push(
      ...connection.nodes.filter(
        (node: GitHubPullRequestNode | null): node is GitHubPullRequestNode => node !== null
      )
    );
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return pullRequests;
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
    const payload: GitHubRepositoryProjectsResponse =
      await requestGitHubGraphql<GitHubRepositoryProjectsResponse>({
      query: repositoryProjectsQuery,
      requestName: `projects:${owner}/${name}`,
      token,
      variables: {
        after,
        name,
        owner
      }
    });
    const connection: GitHubRepositoryProjectsConnection | undefined =
      payload.data?.repository?.projectsV2;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include projects for ${owner}/${name}.`);
    }

    projects.push(
      ...connection.nodes.filter(
        (node: GitHubRepositoryProjectNode | null): node is GitHubRepositoryProjectNode =>
          node !== null
      )
    );
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
    const payload: GitHubProjectItemsResponse =
      await requestGitHubGraphql<GitHubProjectItemsResponse>({
        query: projectItemsQuery,
        requestName: `projectItems:${projectId}`,
        token,
        variables: {
        after,
        projectId
      }
    });
    const connection: GitHubProjectItemsConnection | undefined = payload.data?.node?.items;

    if (!connection) {
      throw new Error(`GitHub GraphQL response did not include project items for ${projectId}.`);
    }

    items.push(
      ...connection.nodes.filter(
        (node: GitHubProjectItemNode | null): node is GitHubProjectItemNode => node !== null
      )
    );
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return items;
}

async function applyImportedProjectStatus(issueId: string): Promise<void> {
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

  const bestItem = pickPrimaryProjectItem(issue.projectItems);

  if (!bestItem) {
    return;
  }

  const planningStatus = bestItem.importedStatusName?.trim() || null;

  await prisma.gitHubIssue.update({
    data: {
      planningStatus,
      planningStatusSource: planningStatus === null ? "NONE" : "GITHUB_PROJECT",
      planningStatusUpdatedAt: planningStatus === null ? null : bestItem.importedAt
    },
    where: {
      id: issue.id
    }
  });
}

export async function syncRepositoryPlanningDataFromGitHub({
  name,
  owner,
  token
}: {
  name: string;
  owner: string;
  token: string;
}) {
  const [repository, issues, pullRequests, projects] = await Promise.all([
    fetchGitHubRepository({
      name,
      owner,
      token
    }),
    fetchGitHubIssues({
      name,
      owner,
      token
    }),
    fetchGitHubPullRequests({
      name,
      owner,
      token
    }),
    fetchGitHubRepositoryProjects({
      name,
      owner,
      token
    })
  ]);
  const syncedAt = new Date();
  const githubId = repository.databaseId?.toString() ?? repository.id;
  const linkedProjectCount = repository.projectsV2.totalCount;
  const issueCount = repository.issues.totalCount;
  const pullRequestCount = repository.pullRequests.totalCount;
  const openPullRequestCount = repository.openPullRequests.totalCount;
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
      openPullRequestCount,
      owner: repository.owner.login,
      primaryLanguageColor: repository.primaryLanguage?.color ?? null,
      primaryLanguageName: repository.primaryLanguage?.name ?? null,
      pullRequestCount,
      pullRequestsSyncedAt: syncedAt,
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
      openPullRequestCount,
      owner: repository.owner.login,
      primaryLanguageColor: repository.primaryLanguage?.color ?? null,
      primaryLanguageName: repository.primaryLanguage?.name ?? null,
      pullRequestCount,
      pullRequestsSyncedAt: syncedAt,
      pushedAt: parseGitHubDate(repository.pushedAt),
      syncedAt,
      url: repository.url,
      visibility: repository.visibility
    },
    where: {
      githubId
    }
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
    const labelPlanningStatusSource = labelPlanningStatus === null ? "NONE" : "GITHUB_LABEL";
    const persistedIssue = await prisma.gitHubIssue.upsert({
      create: {
        assignees,
        authorLogin: issue.author?.login ?? null,
        bodyText: issue.bodyText,
        closedAt: parseGitHubDate(issue.closedAt),
        commentCount: issue.comments.totalCount,
        createdAt: new Date(issue.createdAt),
        githubId: issue.databaseId?.toString() ?? issue.id,
        labels,
        nodeId: issue.id,
        number: issue.number,
        planningStatus: labelPlanningStatus,
        planningStatusSource: labelPlanningStatusSource,
        planningStatusUpdatedAt: labelPlanningStatus === null ? null : syncedAt,
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
        bodyText: issue.bodyText,
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
          planningStatusUpdatedAt: labelPlanningStatus === null ? null : syncedAt
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

  const syncedPullRequestNodeIds: string[] = [];

  for (const pullRequest of pullRequests) {
    syncedPullRequestNodeIds.push(pullRequest.id);

    await prisma.gitHubPullRequest.upsert({
      create: {
        authorLogin: pullRequest.author?.login ?? null,
        commentCount: pullRequest.comments.totalCount,
        createdAt: new Date(pullRequest.createdAt),
        githubId: pullRequest.databaseId?.toString() ?? pullRequest.id,
        isDraft: pullRequest.isDraft,
        nodeId: pullRequest.id,
        number: pullRequest.number,
        repositoryId: persistedRepository.id,
        state: pullRequest.state,
        syncedAt,
        title: pullRequest.title,
        updatedAt: new Date(pullRequest.updatedAt),
        url: pullRequest.url
      },
      update: {
        authorLogin: pullRequest.author?.login ?? null,
        commentCount: pullRequest.comments.totalCount,
        githubId: pullRequest.databaseId?.toString() ?? pullRequest.id,
        isDraft: pullRequest.isDraft,
        number: pullRequest.number,
        state: pullRequest.state,
        syncedAt,
        title: pullRequest.title,
        updatedAt: new Date(pullRequest.updatedAt),
        url: pullRequest.url
      },
      where: {
        repositoryId_number: {
          number: pullRequest.number,
          repositoryId: persistedRepository.id
        }
      }
    });
  }

  await prisma.gitHubPullRequest.deleteMany({
    where: {
      repositoryId: persistedRepository.id,
      ...(syncedPullRequestNodeIds.length > 0
        ? { nodeId: { notIn: syncedPullRequestNodeIds } }
        : {})
    }
  });

  const persistedProjectIds: string[] = [];

  for (const project of projects) {
    const statusField = project.fields.nodes.find((field) => {
      return field?.name === "Status" && Array.isArray(field.options);
    });

    if (!statusField) {
      continue;
    }

    const persistedProject = await prisma.gitHubProject.upsert({
      create: {
        importedAt: syncedAt,
        nodeId: project.id,
        owner: project.owner?.login ?? repository.owner.login,
        statusFieldNodeId: statusField.id,
        statusOptions: getStatusOptions(statusField),
        title: project.title,
        url: project.url
      },
      update: {
        importedAt: syncedAt,
        owner: project.owner?.login ?? repository.owner.login,
        statusFieldNodeId: statusField.id,
        statusOptions: getStatusOptions(statusField),
        title: project.title,
        url: project.url
      },
      where: {
        nodeId: project.id
      }
    });

    persistedProjectIds.push(persistedProject.id);

    await prisma.gitHubRepositoryProject.upsert({
      create: {
        importedAt: syncedAt,
        projectId: persistedProject.id,
        repositoryId: persistedRepository.id
      },
      update: {
        importedAt: syncedAt
      },
      where: {
        repositoryId_projectId: {
          projectId: persistedProject.id,
          repositoryId: persistedRepository.id
        }
      }
    });

    const items = await fetchGitHubProjectItems({
      projectId: project.id,
      token
    });
    const syncedItemNodeIds: string[] = [];

    for (const item of items) {
      if (!item.content) {
        continue;
      }

      const statusValue = item.fieldValueByName;

      if (isDraftIssueContent(item.content)) {
        syncedItemNodeIds.push(item.id);

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
            importedAt: syncedAt,
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
            importedAt: syncedAt,
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

        continue;
      }

      if (
        !isIssueContent(item.content) ||
        item.content.repository?.nameWithOwner !== repository.nameWithOwner
      ) {
        continue;
      }

      syncedItemNodeIds.push(item.id);

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
          importedAt: syncedAt,
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
          importedAt: syncedAt,
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

      await applyImportedProjectStatus(issue.id);
    }

    await prisma.gitHubProjectItem.deleteMany({
      where: {
        projectId: persistedProject.id,
        ...(syncedItemNodeIds.length > 0 ? { nodeId: { notIn: syncedItemNodeIds } } : {})
      }
    });
  }

  await prisma.gitHubRepositoryProject.deleteMany({
    where: {
      repositoryId: persistedRepository.id,
      ...(persistedProjectIds.length > 0 ? { projectId: { notIn: persistedProjectIds } } : {})
    }
  });

  return {
    issueCount: issues.length,
    projectCount: persistedProjectIds.length,
    pullRequestCount: pullRequests.length,
    syncedAt
  };
}
