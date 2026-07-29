"use client";

import {
  CalendarClock,
  ExternalLink,
  MessageSquare,
  UserRound,
  type LucideIcon
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

export type PlanningIssue = {
  assignees: string[];
  authorLogin: string | null;
  closedAt: string | null;
  commentCount: number;
  createdAt: string;
  id: string;
  labels: string[];
  number: number;
  planningEndDate: string | null;
  planningStartDate: string | null;
  planningStatus: string;
  planningStatusSource: string;
  state: string;
  title: string;
  updatedAt: string;
  url: string;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function StateBadge({ state }: { state: string }) {
  const isOpen = state.toUpperCase() === "OPEN";

  return (
    <span
      className={`inline-flex min-w-16 items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
        isOpen
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"
      }`}
    >
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}

function MetadataItem({
  children,
  icon: Icon
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function PlanningIssueSplitView({ issues }: { issues: PlanningIssue[] }) {
  const sortedIssues = useMemo(() => {
    return [...issues].sort((left, right) => {
      if (left.state !== right.state) {
        return left.state === "OPEN" ? -1 : 1;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [issues]);
  const [selectedIssueNumber, setSelectedIssueNumber] = useState(sortedIssues[0]?.number ?? null);
  const selectedIssue =
    sortedIssues.find((issue) => issue.number === selectedIssueNumber) ?? sortedIssues[0] ?? null;

  if (sortedIssues.length === 0) {
    return (
      <section className="flex min-h-80 items-center justify-center rounded-md border border-dashed bg-card px-6 text-center">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">No issues synced</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            This repository has no persisted issues yet. Run the repository sync command to refresh
            planning data.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-card-foreground">Issues</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {sortedIssues.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-24 px-4 py-3 font-semibold">Issue</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="w-28 px-4 py-3 font-semibold">State</th>
                <th className="w-40 px-4 py-3 font-semibold">Assignees</th>
                <th className="w-44 px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedIssues.map((issue) => {
                const isSelected = issue.number === selectedIssue?.number;

                return (
                  <tr
                    className={`cursor-pointer align-middle transition ${
                      isSelected ? "bg-muted" : "hover:bg-muted/60"
                    }`}
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssueNumber(issue.number);
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{issue.number}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="block max-w-[28rem] truncate text-left font-medium text-card-foreground"
                        type="button"
                      >
                        {issue.title}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {issue.labels.slice(0, 3).map((label) => (
                          <span
                            className="rounded-md border bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
                            key={label}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={issue.state} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.assignees.length > 0 ? issue.assignees.join(", ") : "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(issue.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="rounded-md border bg-card">
        {selectedIssue ? (
          <div className="flex h-full flex-col">
            <div className="border-b px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-muted-foreground">
                  #{selectedIssue.number}
                </span>
                <StateBadge state={selectedIssue.state} />
              </div>
              <h2 className="text-xl font-semibold leading-7 text-card-foreground">
                {selectedIssue.title}
              </h2>
              <a
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                href={selectedIssue.url}
                rel="noreferrer"
                target="_blank"
              >
                Open in GitHub
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3">
                <MetadataItem icon={UserRound}>
                  Author: {selectedIssue.authorLogin ?? "Unknown"}
                </MetadataItem>
                <MetadataItem icon={UserRound}>
                  Assignees:{" "}
                  {selectedIssue.assignees.length > 0
                    ? selectedIssue.assignees.join(", ")
                    : "Unassigned"}
                </MetadataItem>
                <MetadataItem icon={MessageSquare}>
                  {selectedIssue.commentCount}{" "}
                  {selectedIssue.commentCount === 1 ? "comment" : "comments"}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Created {formatDate(selectedIssue.createdAt)}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Start {formatDateOnly(selectedIssue.planningStartDate)}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  End {formatDateOnly(selectedIssue.planningEndDate)}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Updated {formatDate(selectedIssue.updatedAt)}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Closed {formatDate(selectedIssue.closedAt)}
                </MetadataItem>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Labels</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedIssue.labels.length > 0 ? (
                    selectedIssue.labels.map((label) => (
                      <span
                        className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground"
                        key={label}
                      >
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No labels</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
