import { CircleAlert } from "lucide-react";
import loadDynamic from "next/dynamic";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed, NeedsAttentionList, ProjectsGrid, StatTiles } from "./dashboard-overview";
import { getDashboardViewModel, type DashboardView } from "./dashboard-data";
import { DashboardSyncButton } from "./dashboard-sync-button";

export const dynamic = "force-dynamic";

const DashboardCalendar = loadDynamic(() =>
  import("./dashboard-calendar").then((module) => module.DashboardCalendar)
);

type DashboardPageProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

function resolveDashboardView(view: string | string[] | undefined): DashboardView {
  const value = Array.isArray(view) ? view[0] : view;

  return value === "calendar" ? "calendar" : "overview";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeView = resolveDashboardView(resolvedSearchParams.view);
  const {
    activityItems,
    attentionItems,
    calendarItems,
    error,
    greeting,
    projectCards,
    stats,
    syncStatusLabel
  } = await getDashboardViewModel(activeView);
  const hasFavorites = stats.favoriteProjectCount > 0;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-[5%] flex min-h-screen max-w-none flex-col py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
              Cross-project overview
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground">{greeting}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Tabs value={activeView}>
              <TabsList aria-label="Dashboard view">
                <TabsTrigger asChild value="overview">
                  <Link href="/">Overview</Link>
                </TabsTrigger>
                <TabsTrigger asChild value="calendar">
                  <Link href="/?view=calendar">Calendar</Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-sm text-muted-foreground">{syncStatusLabel}</p>
            <DashboardSyncButton disabled={!hasFavorites} />
          </div>
        </header>

        <div className="flex flex-col gap-6 py-8">
          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground">
              <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
              Unable to load dashboard data from Postgres. Check `DATABASE_URL` and ensure the
              Prisma migration has been applied.
            </div>
          ) : null}

          {!error && !hasFavorites ? (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
              <div>
                <h2 className="text-lg font-medium text-card-foreground">No favorite repositories yet</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Star repositories on the{" "}
                  <Link className="font-medium text-primary hover:underline" href="/repos">
                    Repos
                  </Link>{" "}
                  page to see their stats, planning progress, and activity here.
                </p>
              </div>
            </div>
          ) : null}

          {!error && hasFavorites && activeView === "calendar" ? (
            <DashboardCalendar items={calendarItems} />
          ) : null}

          {!error && hasFavorites && activeView === "overview" ? (
            <>
              <StatTiles stats={stats} />
              <ProjectsGrid projectCards={projectCards} />
              <div className="grid gap-5 lg:grid-cols-2">
                <NeedsAttentionList items={attentionItems} />
                <ActivityFeed items={activityItems} />
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
