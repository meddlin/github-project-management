import { prisma, type Prisma } from "@gpm/db";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { CreateIssueSheet } from "../../../create-issue-sheet";
import {
  parseProjectStatusOptions,
  pickPrimaryProjectItem,
  type PlanningStatusMode
} from "../../../planning-project";
import {
  PlanningIssueSplitView,
  type PlanningIssue
} from "./planning-issue-split-view";
import { PlanningKanbanBoard } from "./planning-kanban-board";

export const dynamic = "force-dynamic";

type PlanningPageProps = {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
  searchParams?: Promise<{
    view?: string | string[];
  }>;
};

const repositoryWithIssues = {
  include: {
    issues: {
      include: {
        projectItems: {
          include: {
            project: true
          }
        }
      },
      orderBy: [{ state: "desc" }, { updatedAt: "desc" }]
    },
    projects: {
      include: {
        project: true
      }
    }
  }
} satisfies Prisma.GitHubRepositoryDefaultArgs;

type RepositoryWithIssues = Prisma.GitHubRepositoryGetPayload<typeof repositoryWithIssues>;

type PlanningData = {
  error: string | null;
  repository: RepositoryWithIssues | null;
};

function pickPrimaryProject(
  repository: RepositoryWithIssues
): RepositoryWithIssues["projects"][number]["project"] | null {
  if (repository.projects.length === 0) {
    return null;
  }

  const itemCountByProjectId = new Map<string, number>();

  for (const issue of repository.issues) {
    for (const item of issue.projectItems) {
      itemCountByProjectId.set(item.projectId, (itemCountByProjectId.get(item.projectId) ?? 0) + 1);
    }
  }

  const sortedLinks = [...repository.projects].sort((left, right) => {
    const leftCount = itemCountByProjectId.get(left.projectId) ?? 0;
    const rightCount = itemCountByProjectId.get(right.projectId) ?? 0;

    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }

    return left.importedAt.getTime() - right.importedAt.getTime();
  });

  return sortedLinks[0]?.project ?? null;
}

function resolveStatusMode(
  project: RepositoryWithIssues["projects"][number]["project"] | null
): PlanningStatusMode {
  if (!project?.statusFieldNodeId) {
    return { mode: "local" };
  }

  const statusOptions = parseProjectStatusOptions(project.statusOptions);

  if (statusOptions.length === 0) {
    return { mode: "local" };
  }

  return { mode: "project", statusOptions };
}

async function getPlanningData(owner: string, name: string): Promise<PlanningData> {
  try {
    const repository = await prisma.gitHubRepository.findFirst({
      ...repositoryWithIssues,
      where: {
        name,
        owner
      }
    });

    return {
      error: null,
      repository
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load planning data.",
      repository: null
    };
  }
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

function serializeIssue(issue: NonNullable<PlanningData["repository"]>["issues"][number]): PlanningIssue {
  const primaryItem = pickPrimaryProjectItem(
    issue.projectItems.filter((item) => item.contentType === "ISSUE")
  );

  return {
    assignees: issue.assignees,
    authorLogin: issue.authorLogin,
    bodyText: issue.bodyText,
    closedAt: issue.closedAt?.toISOString() ?? null,
    commentCount: issue.commentCount,
    createdAt: issue.createdAt.toISOString(),
    id: issue.id,
    labels: issue.labels,
    number: issue.number,
    planningEndDate: formatDateOnly(issue.planningEndDate),
    planningStartDate: formatDateOnly(issue.planningStartDate),
    planningStatus: issue.planningStatus,
    planningStatusOptionId: primaryItem?.importedStatusOption ?? null,
    planningStatusSource: issue.planningStatusSource,
    state: issue.state,
    title: issue.title,
    updatedAt: issue.updatedAt.toISOString(),
    url: issue.url
  };
}

function buildPlanningHref({
  owner,
  repo,
  view
}: {
  owner: string;
  repo: string;
  view: "list" | "board";
}) {
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning?view=${view}`;
}

function PlanningTab({
  href,
  isActive,
  label
}: {
  href: string;
  isActive: boolean;
  label: string;
}) {
  return (
    <Link
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        isActive
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

export default async function PlanningPage({ params, searchParams }: PlanningPageProps) {
  const { owner, repo } = await params;
  const resolvedSearchParams = await searchParams;
  const viewValue = Array.isArray(resolvedSearchParams?.view)
    ? resolvedSearchParams.view[0]
    : resolvedSearchParams?.view;
  const activeView = viewValue === "board" ? "board" : "list";
  const decodedOwner = decodeURIComponent(owner);
  const decodedRepo = decodeURIComponent(repo);
  const { error, repository } = await getPlanningData(decodedOwner, decodedRepo);
  const primaryProject = repository ? pickPrimaryProject(repository) : null;
  const statusMode = repository ? resolveStatusMode(primaryProject) : null;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-[5%] flex min-h-screen max-w-none flex-col py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <Link className="text-sm font-medium text-primary hover:underline" href="/repos">
              Repos
            </Link>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              {decodedOwner}/{decodedRepo} planning
            </h1>
          </div>
          {repository ? (
            <a
              className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              href={repository.url}
              rel="noreferrer"
              target="_blank"
            >
              View repository
            </a>
          ) : null}
        </header>

        <div className="py-8">
          {error ? (
            <div className="mb-4 rounded-md border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground">
              Unable to load planning data from Postgres. Check `DATABASE_URL` and ensure the
              Prisma migration has been applied.
            </div>
          ) : null}

          {!error && !repository ? (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">Repository not found</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  No synced repository matches {decodedOwner}/{decodedRepo}. Return to{" "}
                  <Link className="font-medium text-primary hover:underline" href="/repos">
                    repos
                  </Link>{" "}
                  to choose an available repository.
                </p>
              </div>
            </div>
          ) : null}

          {repository ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-md border bg-card p-1">
                  <PlanningTab
                    href={buildPlanningHref({
                      owner: decodedOwner,
                      repo: decodedRepo,
                      view: "list"
                    })}
                    isActive={activeView === "list"}
                    label="List"
                  />
                  <PlanningTab
                    href={buildPlanningHref({
                      owner: decodedOwner,
                      repo: decodedRepo,
                      view: "board"
                    })}
                    isActive={activeView === "board"}
                    label="Board"
                  />
                </div>
                <CreateIssueSheet
                  owner={decodedOwner}
                  projectId={primaryProject?.id ?? null}
                  repo={decodedRepo}
                />
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-card-foreground">
                  <CircleAlert aria-hidden="true" className="h-4 w-4 text-primary" />
                  Planning data
                </div>
                <div className="text-muted-foreground">
                  {repository.issues.length} issues synced - repo synced{" "}
                  {formatDate(repository.syncedAt)}
                </div>
              </div>

              {activeView === "board" ? (
                <PlanningKanbanBoard
                  issues={repository.issues.map(serializeIssue)}
                  owner={decodedOwner}
                  repo={decodedRepo}
                  statusMode={statusMode ?? { mode: "local" }}
                />
              ) : (
                <PlanningIssueSplitView
                  issues={repository.issues.map(serializeIssue)}
                  owner={decodedOwner}
                  repo={decodedRepo}
                  statusMode={statusMode ?? { mode: "local" }}
                />
              )}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
