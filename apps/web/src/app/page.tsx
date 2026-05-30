import { prisma } from "@gpm/db";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type RepositoryData = {
  error: string | null;
  latestSyncRun: Awaited<ReturnType<typeof prisma.gitHubRepositorySyncRun.findFirst>>;
  repositories: Awaited<ReturnType<typeof prisma.gitHubRepository.findMany>>;
  totalRepositoryCount: number;
};

type HomeProps = {
  searchParams?: Promise<{
    issues?: string | string[];
  }>;
};

async function getRepositoryData(hasIssueFilter: boolean): Promise<RepositoryData> {
  try {
    const [repositories, latestSyncRun, totalRepositoryCount] = await Promise.all([
      prisma.gitHubRepository.findMany({
        where: hasIssueFilter ? { hasIssuesCreated: true } : undefined,
        orderBy: {
          fullName: "asc"
        }
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

function IndicatorBadge({
  count,
  isActive,
  label
}: {
  count: number;
  isActive: boolean;
  label: string;
}) {
  const Icon = isActive ? CheckCircle2 : CircleX;

  return (
    <span
      className={`inline-flex min-w-24 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {isActive ? "Yes" : "No"} ({count} {label})
    </span>
  );
}

function FilterLink({
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

export default async function Home({ searchParams }: HomeProps) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GitHub Project Management";
  const params = await searchParams;
  const issueFilterValue = Array.isArray(params?.issues) ? params.issues[0] : params?.issues;
  const hasIssueFilter = issueFilterValue === "with";
  const { error, latestSyncRun, repositories, totalRepositoryCount } =
    await getRepositoryData(hasIssueFilter);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b pb-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Repository inventory</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              {appName}
            </h1>
          </div>
          <div className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground">
            {repositories.length} {hasIssueFilter ? "matching" : "repos"}
          </div>
        </header>

        <div className="py-8">
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Unable to load repository inventory from Postgres. Check `DATABASE_URL` and ensure
              the Prisma migration has been applied.
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-card-foreground">
              <CircleAlert aria-hidden="true" className="h-4 w-4 text-primary" />
              Latest sync
            </div>
            <div className="text-muted-foreground">
              {latestSyncRun
                ? `${latestSyncRun.status} - ${latestSyncRun.repositoryCount} repos - ${formatDate(
                    latestSyncRun.finishedAt ?? latestSyncRun.startedAt
                  )}`
                : "No sync has run yet"}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-md border bg-card p-1">
              <FilterLink href="/" isActive={!hasIssueFilter} label="All repos" />
              <FilterLink href="/?issues=with" isActive={hasIssueFilter} label="Has issues" />
            </div>
            <p className="text-sm text-muted-foreground">
              Showing {repositories.length} of {totalRepositoryCount} synced repos
            </p>
          </div>

          {totalRepositoryCount === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">No repositories synced</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Run{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    pnpm --filter @gpm/cli dev -- repos sync
                  </code>{" "}
                  to load repositories visible to the configured GitHub PAT.
                </p>
              </div>
            </div>
          ) : repositories.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  No repositories match this filter
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Switch back to{" "}
                  <Link className="font-medium text-primary hover:underline" href="/">
                    All repos
                  </Link>{" "}
                  to view the full repository inventory.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Repository</th>
                      <th className="px-4 py-3 font-semibold">Visibility</th>
                      <th className="px-4 py-3 font-semibold">Default branch</th>
                      <th className="px-4 py-3 font-semibold">Projects</th>
                      <th className="px-4 py-3 font-semibold">Issues</th>
                      <th className="px-4 py-3 font-semibold">Last pushed</th>
                      <th className="px-4 py-3 font-semibold">Last synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {repositories.map((repository) => (
                      <tr key={repository.id} className="align-middle">
                        <td className="px-4 py-3">
                          <a
                            className="font-medium text-primary hover:underline"
                            href={repository.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {repository.fullName}
                          </a>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {repository.isArchived ? "Archived" : "Active"}
                            {repository.isFork ? " - Fork" : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {repository.visibility.toLowerCase()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {repository.defaultBranch ?? "None"}
                        </td>
                        <td className="px-4 py-3">
                          <IndicatorBadge
                            count={repository.linkedProjectCount}
                            isActive={repository.hasLinkedProject}
                            label="linked"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <IndicatorBadge
                            count={repository.issueCount}
                            isActive={repository.hasIssuesCreated}
                            label="total"
                          />
                          <div className="mt-1 text-xs text-muted-foreground">
                            {repository.openIssueCount} open
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(repository.pushedAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(repository.syncedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
