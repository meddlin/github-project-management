"use client";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  createPlanningIssue,
  getRepositoryAssignees,
  getRepositoryLabels,
  getRepositoryMilestones,
  type GitHubMilestone
} from "./actions";

const NO_MILESTONE_VALUE = "NONE";

function buildCheckboxInputId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function CreateIssueSheet({
  owner,
  projectId,
  repo
}: {
  owner: string;
  projectId: string | null;
  repo: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<GitHubMilestone[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<string>(NO_MILESTONE_VALUE);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || hasLoadedMetadata || isLoadingMetadata) {
      return;
    }

    setIsLoadingMetadata(true);
    setMetadataError(null);

    void Promise.allSettled([
      getRepositoryLabels({ owner, repo }),
      getRepositoryAssignees({ owner, repo }),
      getRepositoryMilestones({ owner, repo })
    ]).then(([labelsResult, assigneesResult, milestonesResult]) => {
      const errors: string[] = [];

      if (labelsResult.status === "fulfilled") {
        setLabels(labelsResult.value);
      } else {
        errors.push("labels");
      }

      if (assigneesResult.status === "fulfilled") {
        setAssignees(assigneesResult.value);
      } else {
        errors.push("assignees");
      }

      if (milestonesResult.status === "fulfilled") {
        setMilestones(milestonesResult.value);
      } else {
        errors.push("milestones");
      }

      if (errors.length > 0) {
        setMetadataError(`Unable to load ${errors.join(", ")} from GitHub.`);
      }

      setHasLoadedMetadata(true);
      setIsLoadingMetadata(false);
    });
  }, [hasLoadedMetadata, isLoadingMetadata, isOpen, owner, repo]);

  const selectedLabelSet = useMemo(() => new Set(selectedLabels), [selectedLabels]);
  const selectedAssigneeSet = useMemo(() => new Set(selectedAssignees), [selectedAssignees]);

  function closeSheet() {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    setSubmitError(null);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setSelectedAssignees([]);
    setSelectedLabels([]);
    setSelectedMilestone(NO_MILESTONE_VALUE);
    setSubmitError(null);
    setSubmitWarning(null);
  }

  function toggleLabel(label: string) {
    setSelectedLabels((currentLabels) =>
      currentLabels.includes(label)
        ? currentLabels.filter((currentLabel) => currentLabel !== label)
        : [...currentLabels, label]
    );
  }

  function toggleAssignee(login: string) {
    setSelectedAssignees((currentAssignees) =>
      currentAssignees.includes(login)
        ? currentAssignees.filter((currentAssignee) => currentAssignee !== login)
        : [...currentAssignees, login]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitWarning(null);
    setIsSubmitting(true);

    void createPlanningIssue({
      assignees: selectedAssignees,
      description,
      endDate,
      labels: selectedLabels,
      milestone: selectedMilestone === NO_MILESTONE_VALUE ? null : Number(selectedMilestone),
      owner,
      projectId,
      repo,
      startDate,
      title
    })
      .then((result) => {
        if (result.projectAttachWarning) {
          setSubmitWarning(result.projectAttachWarning);
          setIsSubmitting(false);
          router.refresh();
          return;
        }

        resetForm();
        setIsOpen(false);
        router.refresh();
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : "Unable to create issue.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <>
      <Button
        onClick={() => {
          setIsOpen(true);
        }}
        type="button"
      >
        <Plus aria-hidden="true" data-icon="inline-start" />
        Create issue
      </Button>

      <Sheet
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setIsOpen(true);
          } else {
            closeSheet();
          }
        }}
        open={isOpen}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <form className="flex min-h-full flex-col" onSubmit={handleSubmit}>
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle className="text-xl leading-7">Create issue</SheetTitle>
              <SheetDescription>
                {owner}/{repo}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 px-6 py-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="create-issue-title">Title</FieldLabel>
                  <Input
                    disabled={isSubmitting}
                    id="create-issue-title"
                    maxLength={256}
                    onChange={(event) => {
                      setTitle(event.target.value);
                    }}
                    required
                    value={title}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="create-issue-description">Description</FieldLabel>
                  <Textarea
                    className="min-h-48"
                    disabled={isSubmitting}
                    id="create-issue-description"
                    onChange={(event) => {
                      setDescription(event.target.value);
                    }}
                    value={description}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="create-issue-start">Start date</FieldLabel>
                    <Input
                      disabled={isSubmitting}
                      id="create-issue-start"
                      onChange={(event) => {
                        setStartDate(event.target.value);
                      }}
                      type="date"
                      value={startDate}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="create-issue-end">End date</FieldLabel>
                    <Input
                      disabled={isSubmitting}
                      id="create-issue-end"
                      onChange={(event) => {
                        setEndDate(event.target.value);
                      }}
                      type="date"
                      value={endDate}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Milestone</FieldLabel>
                  <Select
                    disabled={isSubmitting}
                    onValueChange={setSelectedMilestone}
                    value={selectedMilestone}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={NO_MILESTONE_VALUE}>No milestone</SelectItem>
                        {milestones.map((milestone) => (
                          <SelectItem key={milestone.number} value={milestone.number.toString()}>
                            {milestone.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {metadataError ? (
                  <p className="rounded-md border border-warning-border bg-warning px-3 py-2 text-sm text-warning-foreground">
                    {metadataError}
                  </p>
                ) : null}

                <FieldSet>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLegend variant="label">Assignees</FieldLegend>
                    {isLoadingMetadata ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 aria-hidden="true" className="animate-spin" />
                        Loading
                      </span>
                    ) : null}
                  </div>

                  <div className="max-h-44 overflow-y-auto rounded-md border">
                    {assignees.length > 0 ? (
                      <div className="grid gap-1 p-2 sm:grid-cols-2">
                        {assignees.map((login) => (
                          <Field key={login} orientation="horizontal">
                            <Checkbox
                              checked={selectedAssigneeSet.has(login)}
                              disabled={isSubmitting}
                              id={buildCheckboxInputId("create-issue-assignee", login)}
                              onCheckedChange={() => {
                                toggleAssignee(login);
                              }}
                            />
                            <FieldContent>
                              <FieldLabel
                                className="min-w-0 cursor-pointer"
                                htmlFor={buildCheckboxInputId("create-issue-assignee", login)}
                              >
                                <span className="truncate">{login}</span>
                              </FieldLabel>
                            </FieldContent>
                          </Field>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {isLoadingMetadata ? "Loading assignees..." : "No assignable users available"}
                      </div>
                    )}
                  </div>
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Labels</FieldLegend>

                  <div className="max-h-44 overflow-y-auto rounded-md border">
                    {labels.length > 0 ? (
                      <div className="grid gap-1 p-2 sm:grid-cols-2">
                        {labels.map((label) => (
                          <Field key={label} orientation="horizontal">
                            <Checkbox
                              checked={selectedLabelSet.has(label)}
                              disabled={isSubmitting}
                              id={buildCheckboxInputId("create-issue-label", label)}
                              onCheckedChange={() => {
                                toggleLabel(label);
                              }}
                            />
                            <FieldContent>
                              <FieldLabel
                                className="min-w-0 cursor-pointer"
                                htmlFor={buildCheckboxInputId("create-issue-label", label)}
                              >
                                <span className="truncate">{label}</span>
                              </FieldLabel>
                            </FieldContent>
                          </Field>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {isLoadingMetadata ? "Loading labels..." : "No labels available"}
                      </div>
                    )}
                  </div>
                  <FieldDescription>
                    {projectId
                      ? "The issue will be attached to the linked GitHub Project immediately."
                      : "This repository has no linked GitHub Project; the issue will be created in the repository only."}
                  </FieldDescription>
                </FieldSet>
              </FieldGroup>

              {submitWarning ? (
                <div className="rounded-md border border-warning-border bg-warning px-3 py-2 text-sm text-warning-foreground">
                  {submitWarning}
                </div>
              ) : null}

              {submitError ? (
                <div className="rounded-md border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground">
                  {submitError}
                </div>
              ) : null}
            </div>

            <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                disabled={isSubmitting}
                onClick={closeSheet}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                ) : null}
                Create issue
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
