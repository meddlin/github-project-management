"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPlanningIssue, getRepositoryLabels } from "../../../actions";

export function CreateIssueDialog({ owner, repo }: { owner: string; repo: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasLoadedLabels, setHasLoadedLabels] = useState(false);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || hasLoadedLabels || isLoadingLabels) {
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
  }, [hasLoadedLabels, isLoadingLabels, isOpen, owner, repo]);

  const selectedLabelSet = useMemo(() => new Set(selectedLabels), [selectedLabels]);

  function closeDialog() {
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
    setSelectedLabels([]);
    setSubmitError(null);
  }

  function toggleLabel(label: string) {
    setSelectedLabels((currentLabels) =>
      currentLabels.includes(label)
        ? currentLabels.filter((currentLabel) => currentLabel !== label)
        : [...currentLabels, label]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    setIsSubmitting(true);

    void createPlanningIssue({
      description,
      endDate,
      labels: selectedLabels,
      owner,
      repo,
      startDate,
      title
    })
      .then(() => {
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
      <button
        className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        onClick={() => {
          setIsOpen(true);
        }}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Create issue
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-md border bg-background shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create issue</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {owner}/{repo}
                </p>
              </div>
              <button
                aria-label="Close create issue dialog"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                disabled={isSubmitting}
                onClick={closeDialog}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="issue-title">
                  Title
                </label>
                <input
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  disabled={isSubmitting}
                  id="issue-title"
                  maxLength={256}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  required
                  value={title}
                />
              </div>

              <div>
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="issue-description"
                >
                  Description
                </label>
                <textarea
                  className="mt-2 min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  disabled={isSubmitting}
                  id="issue-description"
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  value={description}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="issue-start">
                    Start date
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    disabled={isSubmitting}
                    id="issue-start"
                    onChange={(event) => {
                      setStartDate(event.target.value);
                    }}
                    type="date"
                    value={startDate}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="issue-end">
                    End date
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    disabled={isSubmitting}
                    id="issue-end"
                    onChange={(event) => {
                      setEndDate(event.target.value);
                    }}
                    type="date"
                    value={endDate}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">Labels</span>
                  {isLoadingLabels ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      Loading
                    </span>
                  ) : null}
                </div>

                {labelError ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {labelError}
                  </p>
                ) : null}

                <div className="mt-2 max-h-44 overflow-y-auto rounded-md border">
                  {labels.length > 0 ? (
                    <div className="grid gap-1 p-2 sm:grid-cols-2">
                      {labels.map((label) => (
                        <label
                          className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                          key={label}
                        >
                          <input
                            checked={selectedLabelSet.has(label)}
                            className="h-4 w-4"
                            disabled={isSubmitting}
                            onChange={() => {
                              toggleLabel(label);
                            }}
                            type="checkbox"
                          />
                          <span className="truncate">{label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {isLoadingLabels ? "Loading labels..." : "No labels available"}
                    </div>
                  )}
                </div>
              </div>

              {submitError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <button
                  className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting}
                  onClick={closeDialog}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : null}
                  Create issue
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
