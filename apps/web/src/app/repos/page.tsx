import { prisma } from "@gpm/db";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { RepositoryInventory, type InventoryRepository } from "../repository-inventory";

export const dynamic = "force-dynamic";

type RepositoryData = {
  error: string | null;
  latestSyncRun: Awaited<ReturnType<typeof prisma.gitHubRepositorySyncRun.findFirst>>;
  repositories: Awaited<ReturnType<typeof prisma.gitHubRepository.findMany>>;
  totalRepositoryCount: number;
};

type ReposProps = {
  searchParams?: Promise<{
    issues?: string | string[];
    projects?: string | string[];
  }>;
};

function buildRepositoryWhere(hasIssueFilter: boolean, hasProjectFilter: boolean) {
  if (!hasIssueFilter && !hasProjectFilter) {
    return undefined;
  }

  return {
    ...(hasIssueFilter ? { hasIssuesCreated: true } : {}),
    ...(hasProjectFilter ? { hasLinkedProject: true } : {})
  };
}

async function getRepositoryData(
  hasIssueFilter: boolean,
  hasProjectFilter: boolean
): Promise<RepositoryData> {
  try {
    const [repositories, latestSyncRun, totalRepositoryCount] = await Promise.all([
      prisma.gitHubRepository.findMany({
        where: buildRepositoryWhere(hasIssueFilter, hasProjectFilter),
        orderBy: [{ favorite: "desc" }, { fullName: "asc" }]
      }),
      prisma.gitHubRepositorySyncRun.findFirst({
        orderBy: {
          startedAt: "desc"
        }
      }),
      prisma.gitHubRepository.count()
    ]);

    return {
      error: null,
      latestSyncRun,
      repositories,
      totalRepositoryCount
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load repository inventory.",
      latestSyncRun: null,
      repositories: [],
      totalRepositoryCount: 0
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

function buildFilterHref({
  hasIssueFilter,
  hasProjectFilter
}: {
  hasIssueFilter: boolean;
  hasProjectFilter: boolean;
}) {
  const params = new URLSearchParams();

  if (hasIssueFilter) {
    params.set("issues", "with");
  }

  if (hasProjectFilter) {
    params.set("projects", "with");
  }

  const query = params.toString();

  return query ? `/repos?${query}` : "/repos";
}

function buildSyncStatusLabel(latestSyncRun: RepositoryData["latestSyncRun"]): string {
  if (!latestSyncRun) {
    return "No sync has run yet";
  }

  const when = formatDate(latestSyncRun.finishedAt ?? latestSyncRun.startedAt);

  return `${latestSyncRun.status} · ${latestSyncRun.repositoryCount} repos · ${when}`;
}

function serializeRepository(
  repository: RepositoryData["repositories"][number]
): InventoryRepository {
  return {
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
    owner: repository.owner,
    pushedAt: repository.pushedAt?.toISOString() ?? null,
    syncedAt: repository.syncedAt?.toISOString() ?? null,
    url: repository.url,
    visibility: repository.visibility
  };
}

export default async function ReposPage({ searchParams }: ReposProps) {
  const params = await searchParams;
  const issueFilterValue = Array.isArray(params?.issues) ? params.issues[0] : params?.issues;
  const projectFilterValue = Array.isArray(params?.projects)
    ? params.projects[0]
    : params?.projects;
  const hasIssueFilter = issueFilterValue === "with";
  const hasProjectFilter = projectFilterValue === "with";
  const hasActiveFilter = hasIssueFilter || hasProjectFilter;
  const { error, latestSyncRun, repositories, totalRepositoryCount } = await getRepositoryData(
    hasIssueFilter,
    hasProjectFilter
  );
  const favoriteRepositories = repositories
    .filter((repository) => repository.favorite)
    .map(serializeRepository);
  const otherRepositories = repositories
    .filter((repository) => !repository.favorite)
    .map(serializeRepository);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-[5%] flex min-h-screen max-w-none flex-col py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
              Repository inventory
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground">Repos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {buildSyncStatusLabel(latestSyncRun)}
          </p>
        </header>

        <div className="flex flex-col gap-6 py-8">
          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground">
              <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
              Unable to load repository inventory from Postgres. Check `DATABASE_URL` and ensure
              the Prisma migration has been applied.
            </div>
          ) : null}

          {totalRepositoryCount === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
              <div>
                <h2 className="text-lg font-medium text-card-foreground">No repositories synced</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Run{" "}
                  <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    pnpm --filter @gpm/cli dev -- repos sync
                  </code>{" "}
                  to load repositories visible to the configured GitHub PAT.
                </p>
              </div>
            </div>
          ) : repositories.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
              <div>
                <h2 className="text-lg font-medium text-card-foreground">
                  No repositories match this filter
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Switch back to{" "}
                  <Link className="font-medium text-primary hover:underline" href="/repos">
                    All repos
                  </Link>{" "}
                  to view the full repository inventory.
                </p>
              </div>
            </div>
          ) : (
            <RepositoryInventory
              favoriteRepositories={favoriteRepositories}
              filterAllHref="/repos"
              filterIssuesHref={buildFilterHref({
                hasIssueFilter: !hasIssueFilter,
                hasProjectFilter
              })}
              filterProjectsHref={buildFilterHref({
                hasIssueFilter,
                hasProjectFilter: !hasProjectFilter
              })}
              hasActiveFilter={hasActiveFilter}
              hasIssueFilter={hasIssueFilter}
              hasProjectFilter={hasProjectFilter}
              otherRepositories={otherRepositories}
              totalRepositoryCount={totalRepositoryCount}
            />
          )}
        </div>
      </section>
    </main>
  );
}
