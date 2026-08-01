"use server";

import { prisma } from "@gpm/db";
import { revalidatePath } from "next/cache";
import { syncRepositoryPlanningDataFromGitHub } from "./github-planning-sync";

type GitHubLabel = {
  name: string;
};

type GitHubIssueResponse = {
  assignees?: Array<{ login?: string | null }> | null;
  body?: string | null;
  closed_at?: string | null;
  comments?: number | null;
  created_at: string;
  html_url: string;
  id: number;
  labels?: Array<{ name?: string | null } | string> | null;
  node_id: string;
  number: number;
  state: string;
  title: string;
  updated_at: string;
  user?: { login?: string | null } | null;
};

export async function setRepositoryFavorite(repositoryId: string, favorite: boolean) {
  if (!repositoryId) {
    throw new Error("Repository id is required.");
  }

  if (typeof favorite !== "boolean") {
    throw new Error("Favorite must be a boolean.");
  }

  await prisma.gitHubRepository.update({
    data: favorite
      ? {
          favorite
        }
      : {
          favorite,
          favoriteOrder: null
        },
    where: {
      id: repositoryId
    }
  });

  revalidatePath("/");
  revalidatePath("/repos");
  revalidatePath("/projects");
}

export async function reorderFavoriteRepositories(repositoryIds: string[]) {
  if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
    throw new Error("Repository ids are required.");
  }

  const uniqueRepositoryIds = [...new Set(repositoryIds)];

  if (uniqueRepositoryIds.length !== repositoryIds.length) {
    throw new Error("Repository ids must be unique.");
  }

  const favoriteRepositories = await prisma.gitHubRepository.findMany({
    select: {
      id: true
    },
    where: {
      favorite: true,
      id: {
        in: repositoryIds
      }
    }
  });

  if (favoriteRepositories.length !== repositoryIds.length) {
    throw new Error("All reordered repositories must be favorites.");
  }

  await prisma.$transaction(
    repositoryIds.map((repositoryId, index) =>
      prisma.gitHubRepository.update({
        data: {
          favoriteOrder: index
        },
        where: {
          id: repositoryId
        }
      })
    )
  );

  revalidatePath("/projects");
}

const planningStatuses = [
  "NO_STATUS",
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE"
] as const;

export type PlanningStatusValue = (typeof planningStatuses)[number];

function requireGitHubToken() {
  const token = process.env.GITHUB_PAT;

  if (!token) {
    throw new Error("GITHUB_PAT is required to access GitHub.");
  }

  return token;
}

function buildGitHubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "github-project-management",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function normalizeDateInput(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Planning dates must use YYYY-MM-DD format.");
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeLabels(labels: string[]) {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

function getGitHubIssueLabelNames(labels: GitHubIssueResponse["labels"]) {
  if (!labels) {
    return [];
  }

  return labels
    .map((label) => (typeof label === "string" ? label : label.name ?? ""))
    .filter(Boolean);
}

async function readGitHubError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function getRepositoryLabels({ owner, repo }: { owner: string; repo: string }) {
  if (!owner || !repo) {
    throw new Error("Repository owner and name are required.");
  }

  const token = requireGitHubToken();
  const labels: string[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo
      )}/labels?per_page=100&page=${page}`,
      {
        headers: buildGitHubHeaders(token),
        method: "GET"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load repository labels from GitHub: ${await readGitHubError(response)}`
      );
    }

    const pageLabels = (await response.json()) as GitHubLabel[];
    labels.push(...pageLabels.map((label) => label.name).filter(Boolean));

    if (pageLabels.length < 100) {
      break;
    }

    page += 1;
  }

  return labels.sort((left, right) => left.localeCompare(right));
}

export async function createPlanningIssue({
  description,
  endDate,
  labels,
  owner,
  repo,
  startDate,
  title
}: {
  description: string;
  endDate?: string | null;
  labels: string[];
  owner: string;
  repo: string;
  startDate?: string | null;
  title: string;
}) {
  const normalizedTitle = title.trim();

  if (!owner || !repo) {
    throw new Error("Repository owner and name are required.");
  }

  if (!normalizedTitle) {
    throw new Error("Issue title is required.");
  }

  const planningStartDate = normalizeDateInput(startDate);
  const planningEndDate = normalizeDateInput(endDate);
  const selectedLabels = normalizeLabels(labels);
  const token = requireGitHubToken();
  const repository = await prisma.gitHubRepository.findFirst({
    where: {
      name: repo,
      owner
    }
  });

  if (!repository) {
    throw new Error(`Repository ${owner}/${repo} is not synced locally.`);
  }

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    {
      body: JSON.stringify({
        body: description.trim() || undefined,
        labels: selectedLabels,
        title: normalizedTitle
      }),
      headers: buildGitHubHeaders(token),
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to create GitHub issue: ${await readGitHubError(response)}`);
  }

  const issue = (await response.json()) as GitHubIssueResponse;
  const syncedAt = new Date();

  try {
    await prisma.$transaction([
      prisma.gitHubIssue.upsert({
        create: {
          assignees: issue.assignees?.map((assignee) => assignee.login ?? "").filter(Boolean) ?? [],
          authorLogin: issue.user?.login ?? null,
          bodyText: issue.body ?? description.trim(),
          closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          commentCount: issue.comments ?? 0,
          createdAt: new Date(issue.created_at),
          githubId: issue.id.toString(),
          labels: getGitHubIssueLabelNames(issue.labels),
          nodeId: issue.node_id,
          number: issue.number,
          planningEndDate,
          planningStartDate,
          planningStatus: "NO_STATUS",
          planningStatusSource: "NONE",
          planningStatusUpdatedAt: null,
          repositoryId: repository.id,
          state: issue.state.toUpperCase(),
          syncedAt,
          title: issue.title,
          updatedAt: new Date(issue.updated_at),
          url: issue.html_url
        },
        update: {
          assignees: issue.assignees?.map((assignee) => assignee.login ?? "").filter(Boolean) ?? [],
          authorLogin: issue.user?.login ?? null,
          bodyText: issue.body ?? description.trim(),
          closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          commentCount: issue.comments ?? 0,
          labels: getGitHubIssueLabelNames(issue.labels),
          planningEndDate,
          planningStartDate,
          state: issue.state.toUpperCase(),
          syncedAt,
          title: issue.title,
          updatedAt: new Date(issue.updated_at),
          url: issue.html_url
        },
        where: {
          repositoryId_githubId: {
            githubId: issue.id.toString(),
            repositoryId: repository.id
          }
        }
      }),
      prisma.gitHubRepository.update({
        data: {
          hasIssuesCreated: true,
          issueCount: {
            increment: 1
          },
          openIssueCount: {
            increment: issue.state.toUpperCase() === "OPEN" ? 1 : 0
          },
          syncedAt
        },
        where: {
          id: repository.id
        }
      })
    ]);
  } catch (error) {
    throw new Error(
      `GitHub issue #${issue.number} was created, but local persistence failed. Run the next sync to recover it. ${
        error instanceof Error ? error.message : ""
      }`.trim()
    );
  }

  revalidatePath(`/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning`);
  revalidatePath("/projects");

  return {
    number: issue.number,
    url: issue.html_url
  };
}

export async function updateIssuePlanningStatus({
  issueId,
  owner,
  repo,
  status
}: {
  issueId: string;
  owner: string;
  repo: string;
  status: PlanningStatusValue;
}) {
  if (!issueId) {
    throw new Error("Issue id is required.");
  }

  if (!planningStatuses.includes(status)) {
    throw new Error("Invalid planning status.");
  }

  await prisma.gitHubIssue.update({
    data: {
      planningStatus: status,
      planningStatusSource: "LOCAL",
      planningStatusUpdatedAt: new Date()
    },
    where: {
      id: issueId
    }
  });

  revalidatePath(`/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning`);
  revalidatePath("/projects");
}

export async function updatePlanningIssue({
  assignees,
  description,
  endDate,
  issueId,
  labels,
  owner,
  planningStatus,
  repo,
  startDate,
  state,
  title
}: {
  assignees: string[];
  description: string;
  endDate?: string | null;
  issueId: string;
  labels: string[];
  owner: string;
  planningStatus: PlanningStatusValue;
  repo: string;
  startDate?: string | null;
  state: string;
  title: string;
}) {
  const normalizedTitle = title.trim();
  const normalizedState = state.toLowerCase();

  if (!issueId) {
    throw new Error("Issue id is required.");
  }

  if (!owner || !repo) {
    throw new Error("Repository owner and name are required.");
  }

  if (!normalizedTitle) {
    throw new Error("Issue title is required.");
  }

  if (normalizedState !== "open" && normalizedState !== "closed") {
    throw new Error("Issue state must be open or closed.");
  }

  if (!planningStatuses.includes(planningStatus)) {
    throw new Error("Invalid planning status.");
  }

  const planningStartDate = normalizeDateInput(startDate);
  const planningEndDate = normalizeDateInput(endDate);
  const selectedLabels = normalizeLabels(labels);
  const selectedAssignees = normalizeLabels(assignees);
  const repositoryIssue = await prisma.gitHubIssue.findFirst({
    include: {
      repository: true
    },
    where: {
      id: issueId,
      repository: {
        name: repo,
        owner
      }
    }
  });

  if (!repositoryIssue) {
    throw new Error(`Issue was not found for ${owner}/${repo}.`);
  }

  const token = requireGitHubToken();
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/issues/${repositoryIssue.number}`,
    {
      body: JSON.stringify({
        assignees: selectedAssignees,
        body: description,
        labels: selectedLabels,
        state: normalizedState,
        title: normalizedTitle
      }),
      headers: buildGitHubHeaders(token),
      method: "PATCH"
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update GitHub issue: ${await readGitHubError(response)}`);
  }

  const issue = (await response.json()) as GitHubIssueResponse;
  const syncedAt = new Date();

  await prisma.gitHubIssue.update({
    data: {
      assignees: issue.assignees?.map((assignee) => assignee.login ?? "").filter(Boolean) ?? [],
      bodyText: issue.body ?? description,
      closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      commentCount: issue.comments ?? repositoryIssue.commentCount,
      labels: getGitHubIssueLabelNames(issue.labels),
      planningEndDate,
      planningStartDate,
      planningStatus,
      planningStatusSource: "LOCAL",
      planningStatusUpdatedAt: new Date(),
      state: issue.state.toUpperCase(),
      syncedAt,
      title: issue.title,
      updatedAt: new Date(issue.updated_at),
      url: issue.html_url
    },
    where: {
      id: issueId
    }
  });

  revalidatePath(`/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning`);
  revalidatePath("/projects");
}

export async function syncRepositoryPlanningData({
  owner,
  repo
}: {
  owner: string;
  repo: string;
}) {
  if (!owner || !repo) {
    throw new Error("Repository owner and name are required.");
  }

  const token = requireGitHubToken();
  const result = await syncRepositoryPlanningDataFromGitHub({
    name: repo,
    owner,
    token
  });

  revalidatePath("/projects");
  revalidatePath(`/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning`);

  return {
    issueCount: result.issueCount,
    projectCount: result.projectCount,
    syncedAt: result.syncedAt.toISOString()
  };
}
