"use client";

import { Search } from "lucide-react";
import Link from "next/link";
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
  owner: string;
  pushedAt: string | null;
  syncedAt: string | null;
  url: string;
  visibility: string;
};

function Tag({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-2.5 py-1 text-xs ${
        active
          ? "border border-primary text-primary"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </span>
  );
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
  repositories,
  title
}: {
  repositories: InventoryRepository[];
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {repositories.length} {repositories.length === 1 ? "repo" : "repos"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Repository
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
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {repositories.map((repository) => (
              <tr className="align-middle hover:bg-accent/40" key={repository.id}>
                <td className="px-3 py-2.5">
                  <FavoriteToggle favorite={repository.favorite} repositoryId={repository.id} />
                </td>
                <td className="px-3 py-2.5">
                  <a
                    className="font-medium text-foreground hover:text-primary"
                    href={repository.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {repository.fullName}
                  </a>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {repository.isArchived ? "Archived" : repository.isFork ? "Fork" : "Active"}
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
                  <Link
                    className="inline-flex rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                    href={`/${encodeURIComponent(repository.owner)}/${encodeURIComponent(
                      repository.name
                    )}/planning`}
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

  const repositoryCount = favoriteRepositories.length + otherRepositories.length;
  const otherRepositoryTitle =
    favoriteRepositories.length > 0 ? "All other repositories" : "Repositories";
  const hasSearchQuery = query.trim().length > 0;

  return (
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
        <RepositoryTable repositories={favoriteRepositories} title="Favorites" />
      ) : null}

      {filteredOtherRepositories.length > 0 ? (
        <RepositoryTable repositories={filteredOtherRepositories} title={otherRepositoryTitle} />
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
  );
}
