import Link from "next/link";
import type {
  DashboardActivityItem,
  DashboardAttentionItem,
  DashboardProjectCard,
  DashboardStageCounts,
  DashboardStats
} from "./dashboard-data";

const STAGE_SEGMENT_CLASS: Record<keyof DashboardStageCounts, string> = {
  done: "bg-primary/70",
  inProgress: "bg-muted-foreground/50",
  notStarted: "bg-muted-foreground/20"
};

const STAGE_LABELS: Record<keyof DashboardStageCounts, string> = {
  done: "Done",
  inProgress: "In progress",
  notStarted: "Not started"
};

const STAGE_ORDER: Array<keyof DashboardStageCounts> = ["notStarted", "inProgress", "done"];

function Tag({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-2.5 py-1 text-xs ${
        active ? "border border-primary text-primary" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function StatTile({
  accent,
  description,
  label,
  value
}: {
  accent?: boolean;
  description: string;
  label: string;
  value: number;
}) {
  return (
    <div
      className={`rounded-md border bg-card p-4 ${accent ? "shadow-[0_0_0_1px_var(--primary)]" : ""}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? "text-primary" : "text-card-foreground"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function StatTiles({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        description={`Across ${stats.organizationCount} organization${
          stats.organizationCount === 1 ? "" : "s"
        }`}
        label="Favorite projects"
        value={stats.favoriteProjectCount}
      />
      <StatTile description="Across all favorites" label="Open issues" value={stats.openIssueCount} />
      <StatTile
        description="Planning end dates set"
        label="Due this week"
        value={stats.dueThisWeekCount}
      />
      <StatTile
        accent
        description="Overdue or stalled"
        label="Needs attention"
        value={stats.needsAttentionCount}
      />
    </div>
  );
}

function ProgressBar({ statusCounts }: { statusCounts: DashboardStageCounts }) {
  const total = STAGE_ORDER.reduce((sum, stage) => sum + statusCounts[stage], 0);

  if (total === 0) {
    return <div className="h-1.5 w-full rounded-full bg-muted-foreground/10" />;
  }

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {STAGE_ORDER.filter((stage) => statusCounts[stage] > 0).map((stage) => (
        <div
          className={STAGE_SEGMENT_CLASS[stage]}
          key={stage}
          style={{ width: `${(statusCounts[stage] / total) * 100}%` }}
          title={`${STAGE_LABELS[stage]}: ${statusCounts[stage]}`}
        />
      ))}
    </div>
  );
}

export function ProjectsGrid({ projectCards }: { projectCards: DashboardProjectCard[] }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Your projects</h2>
        <Link className="text-sm text-primary hover:underline" href="/projects">
          View all projects →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projectCards.map((card) => (
          <Link
            className="block rounded-md border bg-card p-4 transition hover:border-primary/60"
            href={card.planningHref}
            key={card.id}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {card.owner}
                </p>
                <h3 className="mt-0.5 truncate text-sm font-medium text-card-foreground">{card.name}</h3>
              </div>
              <Tag active={card.openIssueCount > 0}>{card.openIssueCount} open</Tag>
            </div>
            <div className="mt-3">
              <ProgressBar statusCounts={card.statusCounts} />
            </div>
            <p className="mt-2 truncate text-xs text-muted-foreground">
              {card.nextDue ? (
                <>
                  Next due: {card.nextDue.title} —{" "}
                  <span className={card.nextDue.isOverdue ? "text-primary" : ""}>
                    {card.nextDue.dueLabel}
                  </span>
                </>
              ) : (
                "No upcoming due dates"
              )}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function NeedsAttentionList({ items }: { items: DashboardAttentionItem[] }) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-medium text-card-foreground">Needs attention</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Nothing needs attention right now.</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.issueId}>
              <Link
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-accent/40"
                href={item.planningHref}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Tag active>{item.repoName}</Tag>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-card-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.assigneeLabel}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    item.isOverdue ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.dueLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ActivityFeed({ items }: { items: DashboardActivityItem[] }) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-medium text-card-foreground">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No recent activity yet.</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li className="flex items-start gap-3 px-4 py-3" key={item.id}>
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm text-card-foreground">{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.relativeTime}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
