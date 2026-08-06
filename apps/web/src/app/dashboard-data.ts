import { prisma } from "@gpm/db";
import { parseProjectStatusOptions, type ProjectStatusOption } from "./planning-project";

export type Stage = "notStarted" | "inProgress" | "done";
export type DashboardView = "overview" | "calendar";

export type DashboardStageCounts = {
  done: number;
  inProgress: number;
  notStarted: number;
};

export type DashboardStats = {
  dueThisWeekCount: number;
  favoriteProjectCount: number;
  needsAttentionCount: number;
  openIssueCount: number;
  organizationCount: number;
};

export type DashboardProjectCard = {
  fullName: string;
  id: string;
  name: string;
  nextDue: { dueLabel: string; isOverdue: boolean; number: number; title: string } | null;
  openIssueCount: number;
  owner: string;
  planningHref: string;
  statusCounts: DashboardStageCounts;
};

export type DashboardAttentionItem = {
  assigneeLabel: string;
  dueLabel: string;
  issueId: string;
  isOverdue: boolean;
  planningHref: string;
  repoName: string;
  title: string;
};

export type DashboardActivityItem = {
  id: string;
  relativeTime: string;
  text: string;
};

export type DashboardCalendarItem = {
  endDate: string;
  id: string;
  number: number;
  repositoryFullName: string;
  startDate: string;
  state: string;
  title: string;
  url: string;
};

export type DashboardViewModel = {
  activityItems: DashboardActivityItem[];
  attentionItems: DashboardAttentionItem[];
  calendarItems: DashboardCalendarItem[];
  error: string | null;
  greeting: string;
  projectCards: DashboardProjectCard[];
  stats: DashboardStats;
  syncStatusLabel: string;
};

const STALLED_AFTER_DAYS = 9;
const DUE_SOON_DAYS = 7;
const EMPTY_STATS: DashboardStats = {
  dueThisWeekCount: 0,
  favoriteProjectCount: 0,
  needsAttentionCount: 0,
  openIssueCount: 0,
  organizationCount: 0
};

type FavoriteOpenIssue = {
  assignees: string[];
  id: string;
  number: number;
  planningEndDate: Date | null;
  planningStatus: string | null;
  repositoryId: string;
  title: string;
  updatedAt: Date;
};

export function getGreeting(hour: number): string {
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function isOverdue(
  issue: { planningEndDate: Date | null },
  today: Date
): boolean {
  return issue.planningEndDate !== null && issue.planningEndDate.getTime() < today.getTime();
}

export function getIssueStage(
  planningStatus: string | null,
  orderedStatusOptions: Array<{ name: string }>
): Stage {
  if (orderedStatusOptions.length === 0) {
    if (!planningStatus) {
      return "notStarted";
    }

    return planningStatus.trim().toLowerCase() === "done" ? "done" : "inProgress";
  }

  if (!planningStatus) {
    return "notStarted";
  }

  const index = orderedStatusOptions.findIndex((option) => option.name === planningStatus);

  if (index === -1) {
    return "inProgress";
  }

  if (index === 0) {
    return "notStarted";
  }

  if (index === orderedStatusOptions.length - 1) {
    return "done";
  }

  return "inProgress";
}

export function isStalled(
  issue: { planningEndDate: Date | null; updatedAt: Date },
  stage: Stage,
  today: Date,
  now: Date
): boolean {
  if (isOverdue(issue, today)) {
    return false;
  }

  if (stage !== "inProgress") {
    return false;
  }

  return daysBetween(issue.updatedAt, now) >= STALLED_AFTER_DAYS;
}

export function needsAttention(
  issue: { planningEndDate: Date | null; updatedAt: Date },
  stage: Stage,
  today: Date,
  now: Date
): boolean {
  return isOverdue(issue, today) || isStalled(issue, stage, today, now);
}

export function isDueThisWeek(issue: { planningEndDate: Date | null }, today: Date): boolean {
  if (issue.planningEndDate === null) {
    return false;
  }

  const diffDays = daysBetween(today, issue.planningEndDate);

  return diffDays >= 0 && diffDays < DUE_SOON_DAYS;
}

export function formatDueLabel(planningEndDate: Date | null, today: Date): string | null {
  if (!planningEndDate) {
    return null;
  }

  const diffDays = daysBetween(today, planningEndDate);

  if (diffDays < 0) {
    return "Overdue";
  }

  if (diffDays === 0) {
    return "Due today";
  }

  return `Due in ${diffDays}d`;
}

export function formatRelativeTime(timestamp: Date, now: Date): string {
  const diffMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays}d ago`;
}

function buildNextDueByRepo(issues: FavoriteOpenIssue[]): Map<string, FavoriteOpenIssue> {
  const nextDueByRepo = new Map<string, FavoriteOpenIssue>();

  for (const issue of issues) {
    if (issue.planningEndDate === null) {
      continue;
    }

    const existing = nextDueByRepo.get(issue.repositoryId);

    if (!existing || (existing.planningEndDate && issue.planningEndDate < existing.planningEndDate)) {
      nextDueByRepo.set(issue.repositoryId, issue);
    }
  }

  return nextDueByRepo;
}

async function buildOrderedStatusOptionsByRepo(
  favoriteRepositoryIds: string[]
): Promise<Map<string, ProjectStatusOption[]>> {
  const [repositoryProjects, projectItemCounts] = await Promise.all([
    prisma.gitHubRepositoryProject.findMany({
      include: { project: true },
      orderBy: { importedAt: "asc" },
      where: { repositoryId: { in: favoriteRepositoryIds } }
    }),
    prisma.gitHubProjectItem.groupBy({
      _count: { _all: true },
      by: ["projectId"],
      where: { issue: { repositoryId: { in: favoriteRepositoryIds } } }
    })
  ]);

  const itemCountByProjectId = new Map(
    projectItemCounts.map((row) => [row.projectId, row._count._all])
  );
  const linksByRepo = new Map<string, typeof repositoryProjects>();

  for (const link of repositoryProjects) {
    const links = linksByRepo.get(link.repositoryId) ?? [];

    links.push(link);
    linksByRepo.set(link.repositoryId, links);
  }

  const orderedStatusOptionsByRepo = new Map<string, ProjectStatusOption[]>();

  for (const [repositoryId, links] of linksByRepo) {
    const sortedLinks = [...links].sort((left, right) => {
      const leftCount = itemCountByProjectId.get(left.projectId) ?? 0;
      const rightCount = itemCountByProjectId.get(right.projectId) ?? 0;

      if (leftCount !== rightCount) {
        return rightCount - leftCount;
      }

      return left.importedAt.getTime() - right.importedAt.getTime();
    });
    const primaryProject = sortedLinks[0]?.project ?? null;

    orderedStatusOptionsByRepo.set(
      repositoryId,
      primaryProject ? parseProjectStatusOptions(primaryProject.statusOptions) : []
    );
  }

  return orderedStatusOptionsByRepo;
}

function buildStageCounts(
  issues: Array<{ planningStatus: string | null; repositoryId: string }>,
  repositoryId: string,
  orderedStatusOptions: ProjectStatusOption[]
): DashboardStageCounts {
  const counts: DashboardStageCounts = { done: 0, inProgress: 0, notStarted: 0 };

  for (const issue of issues) {
    if (issue.repositoryId !== repositoryId) {
      continue;
    }

    counts[getIssueStage(issue.planningStatus, orderedStatusOptions)] += 1;
  }

  return counts;
}

export async function getDashboardViewModel(
  view: DashboardView = "overview"
): Promise<DashboardViewModel> {
  const now = new Date();
  const today = startOfUtcDay(now);
  const greeting = getGreeting(now.getHours());

  try {
    const favoriteRepositories = await prisma.gitHubRepository.findMany({
      orderBy: [{ favoriteOrder: { nulls: "last", sort: "asc" } }, { fullName: "asc" }],
      where: { favorite: true }
    });

    if (favoriteRepositories.length === 0) {
      return {
        activityItems: [],
        attentionItems: [],
        calendarItems: [],
        error: null,
        greeting,
        projectCards: [],
        stats: EMPTY_STATS,
        syncStatusLabel: "No favorite repositories yet"
      };
    }

    const favoriteRepositoryIds = favoriteRepositories.map((repository) => repository.id);

    if (view === "calendar") {
      const datedIssues = await prisma.gitHubIssue.findMany({
        orderBy: [
          { planningStartDate: "asc" },
          { planningEndDate: "asc" },
          { repositoryId: "asc" },
          { number: "asc" }
        ],
        select: {
          id: true,
          number: true,
          planningEndDate: true,
          planningStartDate: true,
          repository: { select: { fullName: true } },
          state: true,
          title: true,
          url: true
        },
        where: {
          planningEndDate: { not: null },
          planningStartDate: { not: null },
          repositoryId: { in: favoriteRepositoryIds }
        }
      });
      const calendarItems = datedIssues.flatMap((issue): DashboardCalendarItem[] => {
        if (
          issue.planningStartDate === null ||
          issue.planningEndDate === null ||
          issue.planningEndDate < issue.planningStartDate
        ) {
          return [];
        }

        return [
          {
            endDate: formatDateOnly(issue.planningEndDate),
            id: issue.id,
            number: issue.number,
            repositoryFullName: issue.repository.fullName,
            startDate: formatDateOnly(issue.planningStartDate),
            state: issue.state,
            title: issue.title,
            url: issue.url
          }
        ];
      });
      const oldestSyncedAt = favoriteRepositories.reduce<Date | null>((oldest, repository) => {
        if (!oldest || repository.syncedAt < oldest) {
          return repository.syncedAt;
        }

        return oldest;
      }, null);

      return {
        activityItems: [],
        attentionItems: [],
        calendarItems,
        error: null,
        greeting,
        projectCards: [],
        stats: {
          ...EMPTY_STATS,
          favoriteProjectCount: favoriteRepositories.length,
          openIssueCount: favoriteRepositories.reduce(
            (sum, repository) => sum + repository.openIssueCount,
            0
          ),
          organizationCount: new Set(favoriteRepositories.map((repository) => repository.owner)).size
        },
        syncStatusLabel: oldestSyncedAt
          ? `Last synced ${formatRelativeTime(oldestSyncedAt, now)}`
          : "No sync has run yet"
      };
    }

    const [openFavoriteIssues, allFavoriteIssues, recentlyClosedIssues, recentSyncRuns, orderedStatusOptionsByRepo] =
      await Promise.all([
        prisma.gitHubIssue.findMany({
          select: {
            assignees: true,
            id: true,
            number: true,
            planningEndDate: true,
            planningStatus: true,
            repositoryId: true,
            title: true,
            updatedAt: true
          },
          where: { repositoryId: { in: favoriteRepositoryIds }, state: "OPEN" }
        }),
        prisma.gitHubIssue.findMany({
          select: { planningStatus: true, repositoryId: true },
          where: { repositoryId: { in: favoriteRepositoryIds } }
        }),
        prisma.gitHubIssue.findMany({
          orderBy: { closedAt: "desc" },
          select: { closedAt: true, id: true, number: true, repositoryId: true, title: true },
          take: 8,
          where: { closedAt: { not: null }, repositoryId: { in: favoriteRepositoryIds }, state: "CLOSED" }
        }),
        prisma.gitHubRepositorySyncRun.findMany({
          orderBy: { finishedAt: "desc" },
          take: 5,
          where: { status: "success" }
        }),
        buildOrderedStatusOptionsByRepo(favoriteRepositoryIds)
      ]);

    const repoById = new Map(favoriteRepositories.map((repository) => [repository.id, repository]));
    const nextDueByRepo = buildNextDueByRepo(openFavoriteIssues);
    const stageByIssueId = new Map(
      openFavoriteIssues.map((issue) => [
        issue.id,
        getIssueStage(issue.planningStatus, orderedStatusOptionsByRepo.get(issue.repositoryId) ?? [])
      ])
    );

    const stats: DashboardStats = {
      dueThisWeekCount: openFavoriteIssues.filter((issue) => isDueThisWeek(issue, today)).length,
      favoriteProjectCount: favoriteRepositories.length,
      needsAttentionCount: openFavoriteIssues.filter((issue) =>
        needsAttention(issue, stageByIssueId.get(issue.id) ?? "notStarted", today, now)
      ).length,
      openIssueCount: favoriteRepositories.reduce(
        (sum, repository) => sum + repository.openIssueCount,
        0
      ),
      organizationCount: new Set(favoriteRepositories.map((repository) => repository.owner)).size
    };

    const projectCards: DashboardProjectCard[] = favoriteRepositories.map((repository) => {
      const nextDueIssue = nextDueByRepo.get(repository.id) ?? null;
      const orderedStatusOptions = orderedStatusOptionsByRepo.get(repository.id) ?? [];

      return {
        fullName: repository.fullName,
        id: repository.id,
        name: repository.name,
        nextDue: nextDueIssue
          ? {
              dueLabel: formatDueLabel(nextDueIssue.planningEndDate, today) ?? "No due date",
              isOverdue: isOverdue(nextDueIssue, today),
              number: nextDueIssue.number,
              title: nextDueIssue.title
            }
          : null,
        openIssueCount: repository.openIssueCount,
        owner: repository.owner,
        planningHref: `/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/planning`,
        statusCounts: buildStageCounts(allFavoriteIssues, repository.id, orderedStatusOptions)
      };
    });

    const attentionItems: DashboardAttentionItem[] = openFavoriteIssues
      .filter((issue) => needsAttention(issue, stageByIssueId.get(issue.id) ?? "notStarted", today, now))
      .sort((a, b) => {
        const aOverdue = isOverdue(a, today);
        const bOverdue = isOverdue(b, today);

        if (aOverdue !== bOverdue) {
          return aOverdue ? -1 : 1;
        }

        if (aOverdue && a.planningEndDate && b.planningEndDate) {
          return a.planningEndDate.getTime() - b.planningEndDate.getTime();
        }

        return a.updatedAt.getTime() - b.updatedAt.getTime();
      })
      .slice(0, 6)
      .map((issue) => {
        const repository = repoById.get(issue.repositoryId);
        const dueLabel = formatDueLabel(issue.planningEndDate, today) ?? "Stalled";

        return {
          assigneeLabel:
            issue.assignees.length > 0 ? `Assigned to ${issue.assignees.join(", ")}` : "Unassigned",
          dueLabel,
          issueId: issue.id,
          isOverdue: dueLabel === "Overdue",
          planningHref: repository
            ? `/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/planning`
            : "/projects",
          repoName: repository?.name ?? "unknown",
          title: issue.title
        };
      });

    const updatedActivity = [...openFavoriteIssues]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8)
      .map((issue) => ({
        id: `updated-${issue.id}`,
        text: `${repoById.get(issue.repositoryId)?.name ?? "unknown"} #${issue.number} updated — ${issue.title}`,
        timestamp: issue.updatedAt
      }));

    const closedActivity = recentlyClosedIssues
      .filter((issue): issue is typeof issue & { closedAt: Date } => issue.closedAt !== null)
      .map((issue) => ({
        id: `closed-${issue.id}`,
        text: `${repoById.get(issue.repositoryId)?.name ?? "unknown"} #${issue.number} closed — ${issue.title}`,
        timestamp: issue.closedAt
      }));

    const syncActivity = recentSyncRuns
      .filter((run): run is typeof run & { finishedAt: Date } => run.finishedAt !== null)
      .map((run) => ({
        id: `sync-${run.id}`,
        text: `Repository sync completed — ${run.repositoryCount} repos`,
        timestamp: run.finishedAt
      }));

    const activityItems: DashboardActivityItem[] = [...updatedActivity, ...closedActivity, ...syncActivity]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        relativeTime: formatRelativeTime(item.timestamp, now),
        text: item.text
      }));

    const oldestSyncedAt = favoriteRepositories.reduce<Date | null>((oldest, repository) => {
      if (!oldest || repository.syncedAt < oldest) {
        return repository.syncedAt;
      }

      return oldest;
    }, null);

    const syncStatusLabel = oldestSyncedAt
      ? `Last synced ${formatRelativeTime(oldestSyncedAt, now)}`
      : "No sync has run yet";

    return {
      activityItems,
      attentionItems,
      calendarItems: [],
      error: null,
      greeting,
      projectCards,
      stats,
      syncStatusLabel
    };
  } catch (error) {
    return {
      activityItems: [],
      attentionItems: [],
      calendarItems: [],
      error: error instanceof Error ? error.message : "Unable to load dashboard data.",
      greeting,
      projectCards: [],
      stats: EMPTY_STATS,
      syncStatusLabel: "No sync has run yet"
    };
  }
}
