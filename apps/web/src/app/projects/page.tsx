import { prisma, type Prisma } from "@gpm/db";
import { CircleAlert, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  PlanningKanbanBoard,
  type PlanningKanbanCard
} from "../[owner]/[repo]/planning/planning-kanban-board";
import { ProjectsAutoRefresh } from "./projects-auto-refresh";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams?: Promise<{
    repo?: string | string[];
  }>;
};

const favoriteRepositoryArgs = {
  include: {
    projects: {
      include: {
        project: {
          include: {
            items: {
              include: {
                issue: true
              },
              orderBy: {
                importedAt: "desc"
              }
            }
          }
        }
      },
      orderBy: {
        importedAt: "desc"
      }
    }
  }
} satisfies Prisma.GitHubRepositoryDefaultArgs;

type FavoriteRepository = Prisma.GitHubRepositoryGetPayload<typeof favoriteRepositoryArgs>;

type ProjectsData = {
  error: string | null;
  favoriteRepositories: FavoriteRepository[];
  latestSyncRun: Awaited<ReturnType<typeof prisma.gitHubRepositorySyncRun.findFirst>>;
};

async function getProjectsData(): Promise<ProjectsData> {
  try {
    const [favoriteRepositories, latestSyncRun] = await Promise.all([
      prisma.gitHubRepository.findMany({
        ...favoriteRepositoryArgs,
        orderBy: {
          fullName: "asc"
        },
        where: {
          favorite: true
        }
      }),
      prisma.gitHubRepositorySyncRun.findFirst({
        orderBy: {
          startedAt: "desc"
        }
      })
    ]);

    return {
      error: null,
      favoriteRepositories,
      latestSyncRun
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load projects data.",
      favoriteRepositories: [],
      latestSyncRun: null
    };
  }
}

function getSelectedRepositoryKey(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildProjectsHref(fullName: string) {
  return `/projects?repo=${encodeURIComponent(fullName)}`;
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapProjectStatus(value: string | null): PlanningKanbanCard["planningStatus"] {
  switch (value?.trim().toLowerCase()) {
    case "backlog":
      return "BACKLOG";
    case "ready":
      return "READY";
    case "in progress":
      return "IN_PROGRESS";
    case "in review":
      return "IN_REVIEW";
    case "done":
      return "DONE";
    default:
      return "NO_STATUS";
  }
}

type ProjectItem = FavoriteRepository["projects"][number]["project"]["items"][number];

function serializeIssueCard(item: ProjectItem): PlanningKanbanCard | null {
  const issue = item.issue;

  if (!issue) {
    return null;
  }

  return {
    assignees: issue.assignees,
    authorLogin: issue.authorLogin,
    closedAt: issue.closedAt?.toISOString() ?? null,
    commentCount: issue.commentCount,
    createdAt: issue.createdAt.toISOString(),
    id: issue.id,
    labels: issue.labels,
    number: issue.number,
    planningEndDate: formatDateOnly(issue.planningEndDate),
    planningStartDate: formatDateOnly(issue.planningStartDate),
    planningStatus: issue.planningStatus,
    planningStatusSource: issue.planningStatusSource,
    state: issue.state,
    title: issue.title,
    updatedAt: issue.updatedAt.toISOString(),
    url: issue.url,
    contentType: "ISSUE"
  };
}

function serializeDraftCard(item: ProjectItem): PlanningKanbanCard | null {
  if (!item.draftTitle || !item.draftCreatedAt || !item.draftUpdatedAt) {
    return null;
  }

  return {
    assignees: item.draftAssignees,
    authorLogin: item.draftAuthorLogin,
    closedAt: null,
    commentCount: 0,
    contentType: "DRAFT_ISSUE",
    createdAt: item.draftCreatedAt.toISOString(),
    id: item.id,
    labels: [],
    number: null,
    planningEndDate: null,
    planningStartDate: null,
    planningStatus: mapProjectStatus(item.importedStatusName),
    planningStatusSource: item.importedStatusName ? "GITHUB_PROJECT" : "NONE",
    state: "DRAFT",
    title: item.draftTitle,
    updatedAt: item.draftUpdatedAt.toISOString(),
    url: null
  };
}

function serializeProjectItemCard(
  item: ProjectItem,
  repository: FavoriteRepository
): PlanningKanbanCard | null {
  if (item.contentType === "DRAFT_ISSUE") {
    return serializeDraftCard(item);
  }

  if (item.issue?.repositoryId !== repository.id) {
    return null;
  }

  return serializeIssueCard(item);
}

function getProjectBoardCards(repository: FavoriteRepository) {
  const seenCardIds = new Set<string>();
  const cards: PlanningKanbanCard[] = [];

  for (const projectLink of repository.projects) {
    for (const item of projectLink.project.items) {
      const card = serializeProjectItemCard(item, repository);

      if (!card || seenCardIds.has(card.id)) {
        continue;
      }

      seenCardIds.add(card.id);
      cards.push(card);
    }
  }

  return cards;
}

function RepositoryMenuItem({
  isSelected,
  repository
}: {
  isSelected: boolean;
  repository: FavoriteRepository;
}) {
  return (
    <Link
      aria-current={isSelected ? "page" : undefined}
      className={`block rounded-md border px-3 py-3 text-sm transition ${
        isSelected
          ? "border-primary bg-muted text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
      }`}
      href={buildProjectsHref(repository.fullName)}
    >
      <span className="block truncate font-medium">{repository.name}</span>
      <span className="mt-1 block truncate text-xs">{repository.owner}</span>
      <span className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span>
          {repository.projects.length || repository.linkedProjectCount}{" "}
          {(repository.projects.length || repository.linkedProjectCount) === 1
            ? "project"
            : "projects"}
        </span>
        <span>{repository.openIssueCount} open</span>
      </span>
    </Link>
  );
}

function EmptyState({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{children}</p>
      </div>
    </section>
  );
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const selectedRepositoryKey = getSelectedRepositoryKey(params?.repo);
  const { error, favoriteRepositories, latestSyncRun } = await getProjectsData();
  const selectedRepository =
    favoriteRepositories.find((repository) => repository.fullName === selectedRepositoryKey) ??
    favoriteRepositories[0] ??
    null;
  const projectBoardCards = selectedRepository ? getProjectBoardCards(selectedRepository) : [];
  const selectedProjects = selectedRepository?.projects.map((projectLink) => projectLink.project) ?? [];
  const selectedProjectUrl = selectedProjects[0]?.url ?? null;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-[5%] flex min-h-screen max-w-none flex-col py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Project workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              Projects
            </h1>
          </div>
          {selectedProjectUrl ? (
            <a
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              href={selectedProjectUrl}
              rel="noreferrer"
              target="_blank"
            >
              GitHub project
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          ) : selectedRepository ? (
            <a
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              href={`${selectedRepository.url}/projects`}
              rel="noreferrer"
              target="_blank"
            >
              Repository projects
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          ) : null}
        </header>

        <div className="flex flex-col gap-4 py-8">
          {error ? (
            <div className="rounded-md border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground">
              Unable to load project data from Postgres. Check `DATABASE_URL` and ensure the Prisma
              migrations have been applied.
            </div>
          ) : null}

          <ProjectsAutoRefresh
            owner={selectedRepository?.owner ?? null}
            repo={selectedRepository?.name ?? null}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-card-foreground">
              <CircleAlert aria-hidden="true" className="h-4 w-4 text-primary" />
              Stored data
            </div>
            <div className="text-muted-foreground">
              {latestSyncRun
                ? `${latestSyncRun.status} - ${latestSyncRun.repositoryCount} repos - ${formatDate(
                    latestSyncRun.finishedAt ?? latestSyncRun.startedAt
                  )}`
                : "No repository sync has run yet"}
            </div>
          </div>

          {favoriteRepositories.length === 0 ? (
            <EmptyState title="No favorite repositories">
              Star repositories on the{" "}
              <Link className="font-medium text-primary hover:underline" href="/repos">
                Repos
              </Link>{" "}
              page to make their GitHub Projects available here.
            </EmptyState>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <aside className="rounded-md border bg-background">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">Favorite repos</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {favoriteRepositories.length} available
                  </p>
                </div>
                <nav aria-label="Favorite repositories" className="flex flex-col gap-2 p-3">
                  {favoriteRepositories.map((repository) => (
                    <RepositoryMenuItem
                      isSelected={repository.id === selectedRepository?.id}
                      key={repository.id}
                      repository={repository}
                    />
                  ))}
                </nav>
              </aside>

              <section className="min-w-0">
                {selectedRepository ? (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-md border bg-card px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-muted-foreground">
                            {selectedRepository.owner}
                          </p>
                          <h2 className="mt-1 truncate text-2xl font-semibold text-card-foreground">
                            {selectedRepository.name}
                          </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span className="rounded-md border bg-background px-2 py-1">
                            {projectBoardCards.length} project cards
                          </span>
                          <span className="rounded-md border bg-background px-2 py-1">
                            {selectedRepository.openIssueCount} open
                          </span>
                          <span className="rounded-md border bg-background px-2 py-1">
                            Repo synced {formatDate(selectedRepository.syncedAt)}
                          </span>
                        </div>
                      </div>

                      {selectedProjects.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedProjects.map((project) => (
                            <a
                              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted"
                              href={project.url}
                              key={project.id}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {project.title}
                              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {selectedProjects.length === 0 ? (
                      <EmptyState title="No linked GitHub project imported">
                        The selected favorite repo does not have a stored GitHub Projects v2 board
                        yet. The watcher will import linked projects when GitHub exposes them for
                        this repository.
                      </EmptyState>
                    ) : projectBoardCards.length === 0 ? (
                      <EmptyState title="No project cards imported">
                        The linked GitHub project has no stored issue or draft cards yet. The
                        watcher will update this board after project items are available.
                      </EmptyState>
                    ) : (
                      <PlanningKanbanBoard
                        issues={projectBoardCards}
                        owner={selectedRepository.owner}
                        repo={selectedRepository.name}
                      />
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
