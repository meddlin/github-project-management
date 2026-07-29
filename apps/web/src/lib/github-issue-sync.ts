import { prisma } from "@gpm/db";
import { revalidatePath } from "next/cache";

type GitHubPageInfo = {
  endCursor: string | null;
  hasNextPage: boolean;
};

type GitHubRepositoryIssuesResponse = {
  data?: {
    repository: {
      databaseId: number | null;
      defaultBranchRef: { name: string } | null;
      id: string;
      isArchived: boolean;
      isFork: boolean;
      isPrivate: boolean;
      issues: {
        nodes: Array<GitHubIssueNode | null>;
        pageInfo: GitHubPageInfo;
        totalCount: number;
      };
      name: string;
      nameWithOwner: string;
      openIssues: {
        totalCount: number;
      };
      owner: {
        login: string;
      };
      projectsV2: {
        totalCount: number;
      };
      pushedAt: string | null;
      updatedAt: string | null;
      url: string;
      visibility: string;
    } | null;
  };
  errors?: Array<{ message: string }>;
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

const repositoryIssuesQuery = `
  query RepositoryIssues($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      databaseId
      defaultBranchRef {
        name
      }
      id
      isArchived
      isFork
      isPrivate
      issues(
        first: 100
        after: $after
        states: [OPEN, CLOSED]
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
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
  }
`;

function requireGitHubToken() {
  const token = process.env.GITHUB_PAT;

  if (!token) {
    throw new Error("GITHUB_PAT is required to sync GitHub issues.");
  }

  return token;
}

function parseGitHubDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function buildPlanningPath(owner: string, repo: string) {
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning`;
}

async function fetchRepositoryIssues({
  name,
  owner,
  token
}: {
  name: string;
  owner: string;
  token: string;
}) {
  const issues: GitHubIssueNode[] = [];
  let after: string | null = null;
  let repository: NonNullable<GitHubRepositoryIssuesResponse["data"]>["repository"] = null;

  do {
    const response = await fetch("https://api.github.com/graphql", {
      body: JSON.stringify({
        query: repositoryIssuesQuery,
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
        `GitHub issues sync failed for ${owner}/${name}: ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as GitHubRepositoryIssuesResponse;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    repository = payload.data?.repository ?? null;

    if (!repository) {
      throw new Error(`GitHub repository ${owner}/${name} was not found.`);
    }

    issues.push(...repository.issues.nodes.filter((issue): issue is GitHubIssueNode => issue !== null));
    after = repository.issues.pageInfo.hasNextPage ? repository.issues.pageInfo.endCursor : null;
  } while (after);

  return {
    issues,
    repository
  };
}

export async function syncRepositoryIssues({ owner, repo }: { owner: string; repo: string }) {
  if (!owner || !repo) {
    throw new Error("Repository owner and name are required.");
  }

  const token = requireGitHubToken();
  const { issues, repository } = await fetchRepositoryIssues({
    name: repo,
    owner,
    token
  });
  const syncedAt = new Date();
  const githubId = repository.databaseId?.toString() ?? repository.id;
  const linkedProjectCount = repository.projectsV2.totalCount;
  const syncedIssueNodeIds: string[] = [];

  const persistedRepository = await prisma.gitHubRepository.upsert({
    create: {
      defaultBranch: repository.defaultBranchRef?.name,
      fullName: repository.nameWithOwner,
      githubId,
      githubUpdatedAt: parseGitHubDate(repository.updatedAt),
      hasIssuesCreated: repository.issues.totalCount > 0,
      hasLinkedProject: linkedProjectCount > 0,
      isArchived: repository.isArchived,
      isFork: repository.isFork,
      isPrivate: repository.isPrivate,
      issueCount: repository.issues.totalCount,
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
      hasIssuesCreated: repository.issues.totalCount > 0,
      hasLinkedProject: linkedProjectCount > 0,
      isArchived: repository.isArchived,
      isFork: repository.isFork,
      isPrivate: repository.isPrivate,
      issueCount: repository.issues.totalCount,
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

  for (const issue of issues) {
    syncedIssueNodeIds.push(issue.id);

    const labels = issue.labels.nodes
      .filter((label): label is { name: string } => label !== null)
      .map((label) => label.name);
    const assignees = issue.assignees.nodes
      .filter((assignee): assignee is { login: string } => assignee !== null)
      .map((assignee) => assignee.login);

    await prisma.gitHubIssue.upsert({
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
        planningStatus: "NO_STATUS",
        planningStatusSource: "NONE",
        planningStatusUpdatedAt: null,
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
        nodeId: issue.id,
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
  }

  await prisma.gitHubIssue.deleteMany({
    where: {
      repositoryId: persistedRepository.id,
      ...(syncedIssueNodeIds.length > 0 ? { nodeId: { notIn: syncedIssueNodeIds } } : {})
    }
  });

  revalidatePath(buildPlanningPath(repository.owner.login, repository.name));

  return {
    issueCount: issues.length,
    owner: repository.owner.login,
    repo: repository.name
  };
}
