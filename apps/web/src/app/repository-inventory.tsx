"use client";

import { CheckCircle2, CircleX, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  pushedAt: string | null;
  syncedAt: string | null;
  url: string;
  visibility: string;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

function RepositoryTable({
  repositories,
  title
}: {
  repositories: InventoryRepository[];
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {repositories.length} {repositories.length === 1 ? "repo" : "repos"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3 font-semibold">Star</th>
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
                  <FavoriteToggle favorite={repository.favorite} repositoryId={repository.id} />
                </td>
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
    </section>
  );
}

export function RepositoryInventory({
  favoriteRepositories,
  otherRepositories
}: {
  favoriteRepositories: InventoryRepository[];
  otherRepositories: InventoryRepository[];
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

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

  const otherRepositoryTitle =
    favoriteRepositories.length > 0 ? "All other repositories" : "Repositories";
  const hasSearchQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <label className="text-sm font-medium text-card-foreground" htmlFor="repository-search">
          Search repositories
        </label>
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
            id="repository-search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Filter all other repositories"
            type="search"
            value={query}
          />
        </div>
      </div>

      {favoriteRepositories.length > 0 ? (
        <RepositoryTable repositories={favoriteRepositories} title="Favorites" />
      ) : null}

      {filteredOtherRepositories.length > 0 ? (
        <RepositoryTable repositories={filteredOtherRepositories} title={otherRepositoryTitle} />
      ) : (
        <section className="rounded-md border border-dashed bg-card px-6 py-10 text-center">
          <h2 className="text-sm font-semibold text-card-foreground">
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
  );
}
