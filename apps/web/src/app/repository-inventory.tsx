"use client";

import {
  CircleDot,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Search
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FavoriteToggle } from "./favorite-toggle";

export type InventoryRepository = {
  defaultBranch: string | null;
  favorite: boolean;
  fullName: string;
  hasIssuesCreated: boolean;
  hasLinkedProject: boolean;
  id: string;
  isArchived: boolean;
  isFork: boolean;
  issueCount: number;
  linkedProjectCount: number;
  name: string;
  openIssueCount: number;
  openPullRequestCount: number;
  owner: string;
  primaryLanguageColor: string | null;
  primaryLanguageName: string | null;
  pullRequestCount: number;
  pullRequestsSyncedAt: string | null;
  pushedAt: string | null;
  syncedAt: string | null;
  url: string;
  visibility: string;
};

type DetailTab = "issues" | "pullRequests";

type RepositoryIssueItem = {
  assignees: string[];
  authorLogin: string | null;
  commentCount: number;
  createdAt: string;
  labels: string[];
  number: number;
  state: string;
  title: string;
  updatedAt: string;
  url: string;
};

type RepositoryPullRequestItem = {
  authorLogin: string | null;
  commentCount: number;
  createdAt: string;
  isDraft: boolean;
  number: number;
  state: string;
  title: string;
  updatedAt: string;
  url: string;
};

type DetailCollection<T> = {
  cursor: string | null;
  error: string | null;
  items: T[];
  loaded: boolean;
  loading: boolean;
};

type RepositoryDetailsState = {
  error: string | null;
  issues: DetailCollection<RepositoryIssueItem>;
  pullRequests: DetailCollection<RepositoryPullRequestItem>;
  summary: InventoryRepository | null;
};

type SummaryChunk = {
  repository: InventoryRepository;
  type: "summary";
};

type ItemsChunk =
  | {
      cursor: string | null;
      items: RepositoryIssueItem[];
      tab: "issues";
      type: "items";
    }
  | {
      cursor: string | null;
      items: RepositoryPullRequestItem[];
      tab: "pullRequests";
      type: "items";
    };

type DetailsChunk = ItemsChunk | SummaryChunk;

function createEmptyCollection<T>(): DetailCollection<T> {
  return {
    cursor: null,
    error: null,
    items: [],
    loaded: false,
    loading: false
  };
}

function createInitialDetails(summary: InventoryRepository): RepositoryDetailsState {
  return {
    error: null,
    issues: createEmptyCollection<RepositoryIssueItem>(),
    pullRequests: createEmptyCollection<RepositoryPullRequestItem>(),
    summary
  };
}

function updateCollection(
  details: RepositoryDetailsState,
  tab: DetailTab,
  updater: (
    collection:
      | DetailCollection<RepositoryIssueItem>
      | DetailCollection<RepositoryPullRequestItem>
  ) => DetailCollection<RepositoryIssueItem> | DetailCollection<RepositoryPullRequestItem>
): RepositoryDetailsState {
  if (tab === "issues") {
    return {
      ...details,
      issues: updater(details.issues) as DetailCollection<RepositoryIssueItem>
    };
  }

  return {
    ...details,
    pullRequests: updater(details.pullRequests) as DetailCollection<RepositoryPullRequestItem>
  };
}

function Tag({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <Badge variant={active ? "outline" : "secondary"}>
      {children}
    </Badge>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function getRepositoryState(repository: InventoryRepository) {
  if (repository.isArchived) {
    return "Archived";
  }

  if (repository.isFork) {
    return "Fork";
  }

  return "Active";
}

function getLanguageColor(value: string | null) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "var(--muted-foreground)";
}

function stopRowClick(event: React.MouseEvent) {
  event.stopPropagation();
}

function SegmentedFilter({
  filterAllHref,
  filterIssuesHref,
  filterProjectsHref,
  hasActiveFilter,
  hasIssueFilter,
  hasProjectFilter
}: {
  filterAllHref: string;
  filterIssuesHref: string;
  filterProjectsHref: string;
  hasActiveFilter: boolean;
  hasIssueFilter: boolean;
  hasProjectFilter: boolean;
}) {
  const options: Array<{ href: string; isActive: boolean; label: string }> = [
    { href: filterAllHref, isActive: !hasActiveFilter, label: "All repos" },
    { href: filterIssuesHref, isActive: hasIssueFilter, label: "Has issues" },
    { href: filterProjectsHref, isActive: hasProjectFilter, label: "Has projects" }
  ];

  return (
    <div
      aria-label="Filter repositories"
      className="inline-flex overflow-hidden rounded-md border"
      role="radiogroup"
    >
      {options.map((option, index) => (
        <Link
          aria-current={option.isActive ? "true" : undefined}
          className={`whitespace-nowrap px-3 py-1.5 text-sm transition-colors ${
            index > 0 ? "border-l" : ""
          } ${
            option.isActive
              ? "bg-accent text-primary shadow-[inset_0_0_0_1px_var(--primary)]"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          href={option.href}
          key={option.href}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function RepositoryTable({
  onSelectRepository,
  repositories,
  title
}: {
  onSelectRepository: (repository: InventoryRepository) => void;
  repositories: InventoryRepository[];
  title: string;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, repository: InventoryRepository) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectRepository(repository);
    }
  }

  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {repositories.length} {repositories.length === 1 ? "repo" : "repos"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Repository
              </th>
              <th className="w-28 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Language
              </th>
              <th className="w-24 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Visibility
              </th>
              <th className="w-32 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Projects
              </th>
              <th className="w-36 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Issues
              </th>
              <th className="w-36 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Pull Requests
              </th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {repositories.map((repository) => (
              <tr
                className="cursor-pointer align-middle outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/50"
                key={repository.id}
                onClick={() => {
                  onSelectRepository(repository);
                }}
                onKeyDown={(event) => {
                  handleKeyDown(event, repository);
                }}
                role="button"
                tabIndex={0}
              >
                <td className="px-3 py-2.5" onClick={stopRowClick}>
                  <FavoriteToggle favorite={repository.favorite} repositoryId={repository.id} />
                </td>
                <td className="px-3 py-2.5">
                  <a
                    className="font-medium text-foreground hover:text-primary"
                    href={repository.url}
                    onClick={stopRowClick}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {repository.fullName}
                  </a>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {getRepositoryState(repository)}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: getLanguageColor(repository.primaryLanguageColor)
                      }}
                    />
                    <span className="truncate">
                      {repository.primaryLanguageName ?? "Unknown"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 capitalize text-muted-foreground">
                  {repository.visibility.toLowerCase()}
                </td>
                <td className="px-3 py-2.5">
                  <Tag active={repository.hasLinkedProject}>
                    {repository.hasLinkedProject ? `${repository.linkedProjectCount} linked` : "None"}
                  </Tag>
                </td>
                <td className="px-3 py-2.5">
                  <Tag active={repository.openIssueCount > 0}>{repository.issueCount} total</Tag>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {repository.openIssueCount} open
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {repository.pullRequestsSyncedAt ? (
                    <>
                      <Tag active={repository.openPullRequestCount > 0}>
                        {repository.pullRequestCount} total
                      </Tag>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {repository.openPullRequestCount} open
                      </div>
                    </>
                  ) : (
                    <Badge variant="secondary">Not synced</Badge>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    className="inline-flex rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                    href={`/${encodeURIComponent(repository.owner)}/${encodeURIComponent(
                      repository.name
                    )}/planning`}
                    onClick={stopRowClick}
                  >
                    Planning
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 min-h-5 text-sm font-medium text-card-foreground">{value}</div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}

function IssueList({
  collection,
  onLoadMore
}: {
  collection: DetailCollection<RepositoryIssueItem>;
  onLoadMore: () => void;
}) {
  if (collection.loading && collection.items.length === 0) {
    return <LoadingRows />;
  }

  if (collection.error) {
    return <div className="rounded-md border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground">{collection.error}</div>;
  }

  if (collection.loaded && collection.items.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No synced issues for this repository.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {collection.items.map((issue) => (
          <a
            className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent/40"
            href={issue.url}
            key={issue.number}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-card-foreground">
                  #{issue.number} {issue.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={issue.state === "OPEN" ? "outline" : "secondary"}>
                    {issue.state.toLowerCase()}
                  </Badge>
                  <span>Updated {formatShortDate(issue.updatedAt)}</span>
                  {issue.authorLogin ? <span>by {issue.authorLogin}</span> : null}
                  <span>{issue.commentCount} comments</span>
                </div>
              </div>
              <ExternalLink aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
            </div>
          </a>
        ))}
      </div>
      {collection.cursor ? (
        <Button
          disabled={collection.loading}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {collection.loading ? "Loading" : "Load more issues"}
        </Button>
      ) : null}
    </div>
  );
}

function PullRequestList({
  collection,
  hasSyncedPullRequests,
  onLoadMore
}: {
  collection: DetailCollection<RepositoryPullRequestItem>;
  hasSyncedPullRequests: boolean;
  onLoadMore: () => void;
}) {
  if (!hasSyncedPullRequests) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Pull request data has not been synced yet.
      </div>
    );
  }

  if (collection.loading && collection.items.length === 0) {
    return <LoadingRows />;
  }

  if (collection.error) {
    return <div className="rounded-md border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground">{collection.error}</div>;
  }

  if (collection.loaded && collection.items.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No open pull requests for this repository.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {collection.items.map((pullRequest) => (
          <a
            className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent/40"
            href={pullRequest.url}
            key={pullRequest.number}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-card-foreground">
                  #{pullRequest.number} {pullRequest.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{pullRequest.state.toLowerCase()}</Badge>
                  {pullRequest.isDraft ? <Badge variant="secondary">draft</Badge> : null}
                  <span>Updated {formatShortDate(pullRequest.updatedAt)}</span>
                  {pullRequest.authorLogin ? <span>by {pullRequest.authorLogin}</span> : null}
                  <span>{pullRequest.commentCount} comments</span>
                </div>
              </div>
              <ExternalLink aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
            </div>
          </a>
        ))}
      </div>
      {collection.cursor ? (
        <Button
          disabled={collection.loading}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {collection.loading ? "Loading" : "Load more pull requests"}
        </Button>
      ) : null}
    </div>
  );
}

function RepositoryDetailsSheet({
  activeTab,
  details,
  onLoadMore,
  onOpenChange,
  onTabChange,
  open,
  repository
}: {
  activeTab: DetailTab;
  details: RepositoryDetailsState | null;
  onLoadMore: (tab: DetailTab) => void;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: DetailTab) => void;
  open: boolean;
  repository: InventoryRepository | null;
}) {
  const summary = details?.summary ?? repository;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-[min(94vw,780px)] overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{summary?.fullName ?? "Repository details"}</SheetTitle>
          <SheetDescription>
            Quick view of repository activity from the local sync store.
          </SheetDescription>
        </SheetHeader>

        {summary ? (
          <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryItem
                label="Language"
                value={
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: getLanguageColor(summary.primaryLanguageColor)
                      }}
                    />
                    {summary.primaryLanguageName ?? "Unknown"}
                  </span>
                }
              />
              <SummaryItem label="Visibility" value={summary.visibility.toLowerCase()} />
              <SummaryItem label="State" value={getRepositoryState(summary)} />
              <SummaryItem
                label="Default branch"
                value={
                  <span className="flex items-center gap-1.5">
                    <GitBranch aria-hidden="true" />
                    {summary.defaultBranch ?? "Unknown"}
                  </span>
                }
              />
              <SummaryItem
                label="Issues"
                value={`${summary.openIssueCount} open / ${summary.issueCount} total`}
              />
              <SummaryItem
                label="Pull requests"
                value={
                  summary.pullRequestsSyncedAt
                    ? `${summary.openPullRequestCount} open / ${summary.pullRequestCount} total`
                    : "Not synced yet"
                }
              />
              <SummaryItem label="Projects" value={`${summary.linkedProjectCount} linked`} />
              <SummaryItem label="Last pushed" value={formatDate(summary.pushedAt)} />
              <SummaryItem label="Last synced" value={formatDate(summary.syncedAt)} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={summary.url} rel="noreferrer" target="_blank">
                  <ExternalLink data-icon="inline-start" />
                  View repository
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/${encodeURIComponent(summary.owner)}/${encodeURIComponent(summary.name)}/planning`}>
                  <CircleDot data-icon="inline-start" />
                  Planning
                </Link>
              </Button>
              {summary.pullRequestsSyncedAt ? (
                <Badge variant="secondary">PR data synced {formatShortDate(summary.pullRequestsSyncedAt)}</Badge>
              ) : (
                <Badge variant="secondary">Run repos sync for PR data</Badge>
              )}
            </div>

            {details?.error ? (
              <div className="rounded-md border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground">
                {details.error}
              </div>
            ) : null}

            <Tabs
              className="min-h-0 flex-1"
              onValueChange={(value) => {
                onTabChange(value === "pullRequests" ? "pullRequests" : "issues");
              }}
              value={activeTab}
            >
              <TabsList>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="pullRequests">
                  <GitPullRequest aria-hidden="true" />
                  Pull Requests
                </TabsTrigger>
              </TabsList>
              <TabsContent value="issues">
                {details ? (
                  <IssueList
                    collection={details.issues}
                    onLoadMore={() => {
                      onLoadMore("issues");
                    }}
                  />
                ) : (
                  <LoadingRows />
                )}
              </TabsContent>
              <TabsContent value="pullRequests">
                {details ? (
                  <PullRequestList
                    collection={details.pullRequests}
                    hasSyncedPullRequests={summary.pullRequestsSyncedAt !== null}
                    onLoadMore={() => {
                      onLoadMore("pullRequests");
                    }}
                  />
                ) : (
                  <LoadingRows />
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <LoadingRows />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function RepositoryInventory({
  favoriteRepositories,
  filterAllHref,
  filterIssuesHref,
  filterProjectsHref,
  hasActiveFilter,
  hasIssueFilter,
  hasProjectFilter,
  otherRepositories,
  totalRepositoryCount
}: {
  favoriteRepositories: InventoryRepository[];
  filterAllHref: string;
  filterIssuesHref: string;
  filterProjectsHref: string;
  hasActiveFilter: boolean;
  hasIssueFilter: boolean;
  hasProjectFilter: boolean;
  otherRepositories: InventoryRepository[];
  totalRepositoryCount: number;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState<InventoryRepository | null>(null);
  const [details, setDetails] = useState<RepositoryDetailsState | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("issues");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const loadRepositoryDetails = useCallback(
    async ({
      cursor,
      repository,
      tab
    }: {
      cursor?: string | null;
      repository: InventoryRepository;
      tab: DetailTab;
    }) => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setDetails((current) => {
        const base = current ?? createInitialDetails(repository);

        return updateCollection(base, tab, (collection) => ({
          ...collection,
          error: null,
          loading: true
        }));
      });

      try {
        const params = new URLSearchParams({
          limit: "50",
          tab
        });

        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`/api/repositories/${encodeURIComponent(repository.id)}?${params}`, {
          cache: "no-store",
          signal: abortController.signal
        });

        if (!response.ok || !response.body) {
          throw new Error("Repository details are unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bufferedText = "";

        while (true) {
          const { done, value } = await reader.read();

          bufferedText += decoder.decode(value, { stream: !done });
          const lines = bufferedText.split("\n");
          bufferedText = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) {
              continue;
            }

            const chunk = JSON.parse(line) as DetailsChunk;

            if (chunk.type === "summary") {
              setDetails((current) => ({
                ...(current ?? createInitialDetails(chunk.repository)),
                summary: chunk.repository
              }));
            } else {
              setDetails((current) => {
                const base = current ?? createInitialDetails(repository);

                if (chunk.tab === "issues") {
                  return {
                    ...base,
                    issues: {
                      ...base.issues,
                      cursor: chunk.cursor,
                      items: cursor ? [...base.issues.items, ...chunk.items] : chunk.items,
                      loaded: true
                    }
                  };
                }

                return {
                  ...base,
                  pullRequests: {
                    ...base.pullRequests,
                    cursor: chunk.cursor,
                    items: cursor ? [...base.pullRequests.items, ...chunk.items] : chunk.items,
                    loaded: true
                  }
                };
              });
            }
          }

          if (done) {
            break;
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setDetails((current) => {
          const base = current ?? createInitialDetails(repository);

          return updateCollection(
            {
              ...base,
              error: error instanceof Error ? error.message : "Repository details are unavailable."
            },
            tab,
            (collection) => ({
              ...collection,
              error: error instanceof Error ? error.message : "Repository details are unavailable."
            })
          );
        });
      } finally {
        if (!abortController.signal.aborted) {
          setDetails((current) => {
            const base = current ?? createInitialDetails(repository);

            return updateCollection(base, tab, (collection) => ({
              ...collection,
              loading: false
            }));
          });
        }

        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    []
  );

  function openRepositoryDetails(repository: InventoryRepository) {
    setSelectedRepository(repository);
    setActiveTab("issues");
    setDetails(createInitialDetails(repository));
    void loadRepositoryDetails({ repository, tab: "issues" });
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSelectedRepository(null);
    setDetails(null);
  }

  function handleTabChange(tab: DetailTab) {
    setActiveTab(tab);

    if (!selectedRepository) {
      return;
    }

    const collection = tab === "issues" ? details?.issues : details?.pullRequests;

    if (!collection?.loaded && !collection?.loading) {
      void loadRepositoryDetails({ repository: selectedRepository, tab });
    }
  }

  function handleLoadMore(tab: DetailTab) {
    if (!selectedRepository || !details) {
      return;
    }

    const collection = tab === "issues" ? details.issues : details.pullRequests;

    if (collection.cursor && !collection.loading) {
      void loadRepositoryDetails({
        cursor: collection.cursor,
        repository: selectedRepository,
        tab
      });
    }
  }

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const filteredOtherRepositories = useMemo(() => {
    if (!normalizedQuery) {
      return otherRepositories;
    }

    return otherRepositories.filter((repository) => {
      return (
        repository.fullName.toLowerCase().includes(normalizedQuery) ||
        repository.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, otherRepositories]);

  const repositoryCount = favoriteRepositories.length + otherRepositories.length;
  const otherRepositoryTitle =
    favoriteRepositories.length > 0 ? "All other repositories" : "Repositories";
  const hasSearchQuery = query.trim().length > 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedFilter
            filterAllHref={filterAllHref}
            filterIssuesHref={filterIssuesHref}
            filterProjectsHref={filterProjectsHref}
            hasActiveFilter={hasActiveFilter}
            hasIssueFilter={hasIssueFilter}
            hasProjectFilter={hasProjectFilter}
          />

          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              Showing {repositoryCount} of {totalRepositoryCount} synced repos
            </p>
            <div className="relative w-full sm:w-70">
              <label className="sr-only" htmlFor="repository-search">
                Search repositories
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                className="h-9 w-full rounded-md border bg-card pl-8 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary"
                id="repository-search"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search repositories"
                type="search"
                value={query}
              />
            </div>
          </div>
        </div>

        {favoriteRepositories.length > 0 ? (
          <RepositoryTable
            onSelectRepository={openRepositoryDetails}
            repositories={favoriteRepositories}
            title="Favorites"
          />
        ) : null}

        {filteredOtherRepositories.length > 0 ? (
          <RepositoryTable
            onSelectRepository={openRepositoryDetails}
            repositories={filteredOtherRepositories}
            title={otherRepositoryTitle}
          />
        ) : (
          <section className="rounded-md border border-dashed bg-card px-6 py-10 text-center">
            <h2 className="text-sm font-medium text-card-foreground">
              No repositories match this search
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasSearchQuery
                ? "Clear the search box to restore all other repositories."
                : "No repositories are available outside Favorites."}
            </p>
          </section>
        )}
      </div>

      <RepositoryDetailsSheet
        activeTab={activeTab}
        details={details}
        onLoadMore={handleLoadMore}
        onOpenChange={handleOpenChange}
        onTabChange={handleTabChange}
        open={selectedRepository !== null}
        repository={selectedRepository}
      />
    </>
  );
}
