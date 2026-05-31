import { prisma, type Prisma } from "@gpm/db";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
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
      orderBy: [{ state: "desc" }, { updatedAt: "desc" }]
    }
  }
} satisfies Prisma.GitHubRepositoryDefaultArgs;

type RepositoryWithIssues = Prisma.GitHubRepositoryGetPayload<typeof repositoryWithIssues>;

type PlanningData = {
  error: string | null;
  repository: RepositoryWithIssues | null;
};

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

function serializeIssue(issue: NonNullable<PlanningData["repository"]>["issues"][number]): PlanningIssue {
  return {
    assignees: issue.assignees,
    authorLogin: issue.authorLogin,
    closedAt: issue.closedAt?.toISOString() ?? null,
    commentCount: issue.commentCount,
    createdAt: issue.createdAt.toISOString(),
    id: issue.id,
    labels: issue.labels,
    number: issue.number,
    planningStatus: issue.planningStatus,
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

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <Link className="text-sm font-medium text-primary hover:underline" href="/">
              Repository inventory
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
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                  <Link className="font-medium text-primary hover:underline" href="/">
                    repository inventory
                  </Link>{" "}
                  to choose an available repository.
                </p>
              </div>
            </div>
          ) : null}

          {repository ? (
            <>
              <div className="mb-4 inline-flex rounded-md border bg-card p-1">
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
                />
              ) : (
                <PlanningIssueSplitView issues={repository.issues.map(serializeIssue)} />
              )}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
