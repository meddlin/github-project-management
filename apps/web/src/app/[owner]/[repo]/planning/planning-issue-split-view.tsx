"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  MessageSquare,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  getRepositoryLabels,
  updatePlanningIssue,
  type PlanningStatusValue
} from "../../../actions";

export type PlanningIssue = {
  assignees: string[];
  authorLogin: string | null;
  bodyText: string;
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

const planningStatusOptions: Array<{ label: string; value: PlanningStatusValue }> = [
  { label: "No status", value: "NO_STATUS" },
  { label: "Backlog", value: "BACKLOG" },
  { label: "Ready", value: "READY" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Done", value: "DONE" }
];

function formatDate(value: string | null): string {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizePlanningStatus(status: string): PlanningStatusValue {
  return planningStatusOptions.some((option) => option.value === status)
    ? (status as PlanningStatusValue)
    : "NO_STATUS";
}

function parseCommaSeparated(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function buildLabelInputId(label: string): string {
  return `edit-issue-label-${label.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function StateBadge({ state }: { state: string }) {
  const isOpen = state.toUpperCase() === "OPEN";

  return (
    <Badge variant={isOpen ? "default" : "secondary"}>{isOpen ? "Open" : "Closed"}</Badge>
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
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function IssueEditSheet({
  issue,
  onOpenChange,
  open,
  owner,
  repo
}: {
  issue: PlanningIssue | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  owner: string;
  repo: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState("OPEN");
  const [planningStatus, setPlanningStatus] = useState<PlanningStatusValue>("NO_STATUS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignees, setAssignees] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasLoadedLabels, setHasLoadedLabels] = useState(false);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!issue) {
      return;
    }

    setTitle(issue.title);
    setDescription(issue.bodyText);
    setState(issue.state.toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN");
    setPlanningStatus(normalizePlanningStatus(issue.planningStatus));
    setStartDate(issue.planningStartDate ?? "");
    setEndDate(issue.planningEndDate ?? "");
    setAssignees(issue.assignees.join(", "));
    setSelectedLabels(issue.labels);
    setSubmitError(null);
  }, [issue]);

  useEffect(() => {
    if (!open || hasLoadedLabels || isLoadingLabels) {
      return;
    }

    setIsLoadingLabels(true);
    setLabelError(null);

    void getRepositoryLabels({ owner, repo })
      .then((repositoryLabels) => {
        setLabels(repositoryLabels);
        setHasLoadedLabels(true);
      })
      .catch((error: unknown) => {
        setLabelError(error instanceof Error ? error.message : "Unable to load labels.");
      })
      .finally(() => {
        setIsLoadingLabels(false);
      });
  }, [hasLoadedLabels, isLoadingLabels, open, owner, repo]);

  const selectedLabelSet = useMemo(() => new Set(selectedLabels), [selectedLabels]);

  function toggleLabel(label: string) {
    setSelectedLabels((currentLabels) =>
      currentLabels.includes(label)
        ? currentLabels.filter((currentLabel) => currentLabel !== label)
        : [...currentLabels, label]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!issue) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    void updatePlanningIssue({
      assignees: parseCommaSeparated(assignees),
      description,
      endDate,
      issueId: issue.id,
      labels: selectedLabels,
      owner,
      planningStatus,
      repo,
      startDate,
      state,
      title
    })
      .then(() => {
        onOpenChange(false);
        router.refresh();
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : "Unable to update issue.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {issue ? (
          <form className="flex min-h-full flex-col" onSubmit={handleSubmit}>
            <SheetHeader className="border-b px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted-foreground">#{issue.number}</span>
                <StateBadge state={state} />
              </div>
              <SheetTitle className="text-xl leading-7">Edit issue</SheetTitle>
              <SheetDescription>
                Update the GitHub issue fields and local planning metadata.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 px-6 py-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-issue-title">Title</FieldLabel>
                  <Input
                    disabled={isSubmitting}
                    id="edit-issue-title"
                    maxLength={256}
                    onChange={(event) => {
                      setTitle(event.target.value);
                    }}
                    required
                    value={title}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-issue-description">Description</FieldLabel>
                  <Textarea
                    className="min-h-48"
                    disabled={isSubmitting}
                    id="edit-issue-description"
                    onChange={(event) => {
                      setDescription(event.target.value);
                    }}
                    value={description}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>GitHub state</FieldLabel>
                    <Select disabled={isSubmitting} onValueChange={setState} value={state}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Planning status</FieldLabel>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={(value) => {
                        setPlanningStatus(value as PlanningStatusValue);
                      }}
                      value={planningStatus}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {planningStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="edit-issue-start">Start date</FieldLabel>
                    <Input
                      disabled={isSubmitting}
                      id="edit-issue-start"
                      onChange={(event) => {
                        setStartDate(event.target.value);
                      }}
                      type="date"
                      value={startDate}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-issue-end">End date</FieldLabel>
                    <Input
                      disabled={isSubmitting}
                      id="edit-issue-end"
                      onChange={(event) => {
                        setEndDate(event.target.value);
                      }}
                      type="date"
                      value={endDate}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="edit-issue-assignees">Assignees</FieldLabel>
                  <Input
                    disabled={isSubmitting}
                    id="edit-issue-assignees"
                    onChange={(event) => {
                      setAssignees(event.target.value);
                    }}
                    placeholder="login-one, login-two"
                    value={assignees}
                  />
                  <FieldDescription>Use comma-separated GitHub usernames.</FieldDescription>
                </Field>

                <FieldSet>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLegend variant="label">Labels</FieldLegend>
                    {isLoadingLabels ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 aria-hidden="true" className="animate-spin" />
                        Loading
                      </span>
                    ) : null}
                  </div>

                  {labelError ? (
                    <p className="rounded-md border border-warning-border bg-warning px-3 py-2 text-sm text-warning-foreground">
                      {labelError}
                    </p>
                  ) : null}

                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    {labels.length > 0 ? (
                      <div className="grid gap-1 p-2 sm:grid-cols-2">
                        {labels.map((label) => (
                          <Field key={label} orientation="horizontal">
                            <Checkbox
                              checked={selectedLabelSet.has(label)}
                              disabled={isSubmitting}
                              id={buildLabelInputId(label)}
                              onCheckedChange={() => {
                                toggleLabel(label);
                              }}
                            />
                            <FieldContent>
                              <FieldLabel
                                className="min-w-0 cursor-pointer"
                                htmlFor={buildLabelInputId(label)}
                              >
                                <span className="truncate">{label}</span>
                              </FieldLabel>
                            </FieldContent>
                          </Field>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {isLoadingLabels ? "Loading labels..." : "No labels available"}
                      </div>
                    )}
                  </div>
                </FieldSet>
              </FieldGroup>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <MetadataItem icon={UserRound}>
                  Author: {issue.authorLogin ?? "Unknown"}
                </MetadataItem>
                <MetadataItem icon={MessageSquare}>
                  {issue.commentCount} {issue.commentCount === 1 ? "comment" : "comments"}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Created {formatDate(issue.createdAt)}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Updated {formatDate(issue.updatedAt)}
                </MetadataItem>
                <MetadataItem icon={CalendarClock}>
                  Closed {formatDate(issue.closedAt)}
                </MetadataItem>
              </div>

              <Button asChild className="w-fit" type="button" variant="outline">
                <a href={issue.url} rel="noreferrer" target="_blank">
                  Open in GitHub
                  <ExternalLink aria-hidden="true" data-icon="inline-end" />
                </a>
              </Button>

              {submitError ? (
                <div className="rounded-md border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground">
                  {submitError}
                </div>
              ) : null}
            </div>

            <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                disabled={isSubmitting}
                onClick={() => {
                  onOpenChange(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                ) : null}
                Save changes
              </Button>
            </SheetFooter>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function PlanningIssueSplitView({
  issues,
  owner,
  repo
}: {
  issues: PlanningIssue[];
  owner: string;
  repo: string;
}) {
  const sortedIssues = useMemo(() => {
    return [...issues].sort((left, right) => {
      if (left.state !== right.state) {
        return left.state === "OPEN" ? -1 : 1;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [issues]);
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const selectedIssue =
    sortedIssues.find((issue) => issue.number === selectedIssueNumber) ?? null;

  function openIssue(issueNumber: number) {
    setSelectedIssueNumber(issueNumber);
    setIsSheetOpen(true);
  }

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
    <>
      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-card-foreground">Issues</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {sortedIssues.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-24 px-4 py-3 font-semibold">Issue</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="w-28 px-4 py-3 font-semibold">State</th>
                <th className="w-36 px-4 py-3 font-semibold">Planning</th>
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
                      openIssue(issue.number);
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{issue.number}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="block max-w-[34rem] truncate text-left font-medium text-card-foreground"
                        type="button"
                      >
                        {issue.title}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {issue.labels.slice(0, 3).map((label) => (
                          <Badge key={label} variant="outline">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={issue.state} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {
                        planningStatusOptions.find(
                          (option) => option.value === normalizePlanningStatus(issue.planningStatus)
                        )?.label
                      }
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

      <IssueEditSheet
        issue={selectedIssue}
        onOpenChange={setIsSheetOpen}
        open={isSheetOpen}
        owner={owner}
        repo={repo}
      />
    </>
  );
}
