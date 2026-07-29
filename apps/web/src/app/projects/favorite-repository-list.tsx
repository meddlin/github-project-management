"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "../../lib/utils";
import { reorderFavoriteRepositories } from "../actions";

export type FavoriteRepositoryListItem = {
  fullName: string;
  id: string;
  linkedProjectCount: number;
  name: string;
  openIssueCount: number;
  owner: string;
  projectCount: number;
};

function buildProjectsHref(fullName: string) {
  return `/projects?repo=${encodeURIComponent(fullName)}`;
}

function RepositoryMenuItemLink({
  isSelected,
  repository
}: {
  isSelected: boolean;
  repository: FavoriteRepositoryListItem;
}) {
  const projectCount = repository.projectCount || repository.linkedProjectCount;
  return (
    <Link
      aria-current={isSelected ? "page" : undefined}
      className="min-w-0 flex-1 px-1 py-3 pr-3"
      href={buildProjectsHref(repository.fullName)}
    >
      <span className="block truncate font-medium">{repository.name}</span>
      <span className="mt-1 block truncate text-xs">{repository.owner}</span>
      <span className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span>
          {projectCount} {projectCount === 1 ? "project" : "projects"}
        </span>
        <span>{repository.openIssueCount} open</span>
      </span>
    </Link>
  );
}

function SortableRepositoryMenuItem({
  isSelected,
  repository
}: {
  isSelected: boolean;
  repository: FavoriteRepositoryListItem;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: repository.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      className={cn(
        "flex rounded-md border text-sm transition",
        isSelected
          ? "border-primary bg-muted text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
        isDragging && "opacity-40"
      )}
      ref={setNodeRef}
      style={style}
    >
      <button
        aria-label={`Drag ${repository.fullName}`}
        className="flex shrink-0 cursor-grab items-start rounded-l-md px-2 py-3 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      <RepositoryMenuItemLink isSelected={isSelected} repository={repository} />
    </div>
  );
}

function RepositoryMenuItemOverlay({
  isSelected,
  repository
}: {
  isSelected: boolean;
  repository: FavoriteRepositoryListItem;
}) {
  const projectCount = repository.projectCount || repository.linkedProjectCount;

  return (
    <div
      className={cn(
        "flex w-72 rounded-md border border-border bg-background text-sm shadow-lg",
        isSelected ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <div className="flex shrink-0 items-start rounded-l-md px-2 py-3 text-muted-foreground">
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 px-1 py-3 pr-3">
        <span className="block truncate font-medium">{repository.name}</span>
        <span className="mt-1 block truncate text-xs">{repository.owner}</span>
        <span className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span>
            {projectCount} {projectCount === 1 ? "project" : "projects"}
          </span>
          <span>{repository.openIssueCount} open</span>
        </span>
      </div>
    </div>
  );
}

export function FavoriteRepositoryList({
  repositories,
  selectedRepositoryId
}: {
  repositories: FavoriteRepositoryListItem[];
  selectedRepositoryId: string | null;
}) {
  const [localRepositories, setLocalRepositories] = useState(repositories);
  const [activeRepositoryId, setActiveRepositoryId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const repositoryIds = useMemo(
    () => localRepositories.map((repository) => repository.id),
    [localRepositories]
  );
  const activeRepository =
    localRepositories.find((repository) => repository.id === activeRepositoryId) ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    setLocalRepositories(repositories);
  }, [repositories]);

  function handleDragStart(event: DragStartEvent) {
    setActiveRepositoryId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRepositoryId(null);

    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    const activeIndex = localRepositories.findIndex(
      (repository) => repository.id === event.active.id
    );
    const overIndex = localRepositories.findIndex((repository) => repository.id === event.over?.id);

    if (activeIndex < 0 || overIndex < 0) {
      return;
    }

    const nextRepositories = arrayMove(localRepositories, activeIndex, overIndex);
    const nextRepositoryIds = nextRepositories.map((repository) => repository.id);

    setLocalRepositories(nextRepositories);

    startTransition(() => {
      void reorderFavoriteRepositories(nextRepositoryIds).catch(() => {
        setLocalRepositories(repositories);
      });
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
      <SortableContext items={repositoryIds} strategy={verticalListSortingStrategy}>
        <nav aria-label="Favorite repositories" className="flex flex-col gap-2 p-3">
          {localRepositories.map((repository) => (
            <SortableRepositoryMenuItem
              isSelected={repository.id === selectedRepositoryId}
              key={repository.id}
              repository={repository}
            />
          ))}
        </nav>
      </SortableContext>
      <DragOverlay>
        {activeRepository ? (
          <RepositoryMenuItemOverlay
            isSelected={activeRepository.id === selectedRepositoryId}
            repository={activeRepository}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
