"use client";

import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, ExternalLink, GripVertical, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  updateIssueLocalPlanningStatus,
  updateIssuePlanningStatus
} from "../../../actions";
import {
  LOCAL_STATUS_OPTIONS,
  NO_STATUS_COLUMN_ID,
  resolveIssueStatusValue,
  type PlanningStatusMode
} from "../../../planning-project";
import type { PlanningIssue } from "./planning-issue-split-view";

export type PlanningKanbanCard = Omit<PlanningIssue, "bodyText" | "number" | "url"> & {
  contentType?: "ISSUE" | "DRAFT_ISSUE";
  number: number | null;
  url: string | null;
};

type KanbanColumnDef = { id: string; label: string };

type KanbanDragData =
  | {
      columnId: string;
      issueId: string;
      type: "card";
    }
  | {
      columnId: string;
      type: "column";
    };

function buildColumns(statusMode: PlanningStatusMode): KanbanColumnDef[] {
  if (statusMode.mode === "project") {
    return [
      { id: NO_STATUS_COLUMN_ID, label: "No status" },
      ...statusMode.statusOptions.map((option) => ({ id: option.id, label: option.name }))
    ];
  }

  return [
    { id: NO_STATUS_COLUMN_ID, label: "No status" },
    ...LOCAL_STATUS_OPTIONS.map((option) => ({ id: option.id, label: option.label }))
  ];
}

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  const intersectionCollisions = rectIntersection(args);

  if (intersectionCollisions.length > 0) {
    return intersectionCollisions;
  }

  return closestCorners(args);
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
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

function normalizeColumnId(columnId: string | null | undefined, columns: KanbanColumnDef[]): string {
  return columns.some((column) => column.id === columnId) ? (columnId as string) : NO_STATUS_COLUMN_ID;
}

function getKanbanDragData(value: unknown, columns: KanbanColumnDef[]): KanbanDragData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<{ columnId: string; issueId: string; type: string }>;

  if (data.type === "card" && data.issueId) {
    return {
      columnId: normalizeColumnId(data.columnId, columns),
      issueId: data.issueId,
      type: "card"
    };
  }

  if (data.type === "column") {
    return {
      columnId: normalizeColumnId(data.columnId, columns),
      type: "column"
    };
  }

  return null;
}

function GitHubStateBadge({ state }: { state: string }) {
  if (state.toUpperCase() === "DRAFT") {
    return (
      <span className="rounded-md border border-warning-border bg-warning px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
        Draft
      </span>
    );
  }

  const isOpen = state.toUpperCase() === "OPEN";

  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
        isOpen
          ? "border-success-border bg-success text-success-foreground"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}

function KanbanCard({
  columnId,
  isOverlay = false,
  issue
}: {
  columnId: string;
  isOverlay?: boolean;
  issue: PlanningKanbanCard;
}) {
  const isDraft = issue.contentType === "DRAFT_ISSUE";
  const canDrag = !isOverlay && !isDraft;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    data: {
      columnId,
      issueId: issue.id,
      type: "card"
    },
    disabled: !canDrag,
    id: issue.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      className={`rounded-md border bg-background p-3 shadow-sm transition ${
        isDragging ? "opacity-40" : ""
      } ${isOverlay ? "w-72 shadow-lg" : ""}`}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-2">
        {isDraft ? (
          <span className="mt-1 rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Draft
          </span>
        ) : (
          <button
            aria-label={`Drag issue ${issue.number}`}
            className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {issue.number ? `#${issue.number}` : "Draft issue"}
            </span>
            <GitHubStateBadge state={issue.state} />
          </div>
          <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-5 text-card-foreground">
            {issue.title}
          </h3>
        </div>
      </div>

      {issue.labels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((label) => (
            <span
              className="rounded-md border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">
          {issue.assignees.length > 0
            ? issue.assignees.join(", ")
            : issue.authorLogin
              ? `By ${issue.authorLogin}`
              : "Unassigned"}
        </span>
        <span className="shrink-0">{formatDate(issue.updatedAt)}</span>
      </div>
      {issue.planningStartDate || issue.planningEndDate ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {formatDateOnly(issue.planningStartDate)} - {formatDateOnly(issue.planningEndDate)}
          </span>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {issue.contentType === "DRAFT_ISSUE" ? (
          <span className="font-medium text-muted-foreground">Project draft</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
              {issue.commentCount}
            </span>
            {issue.url ? (
              <a
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                href={issue.url}
                rel="noreferrer"
                target="_blank"
              >
                GitHub
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function KanbanColumn({
  columnId,
  issues,
  label
}: {
  columnId: string;
  issues: PlanningKanbanCard[];
  label: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: {
      columnId,
      type: "column"
    },
    id: columnId
  });

  return (
    <section
      className={`flex max-h-[calc(100vh-15rem)] min-h-[520px] w-72 shrink-0 flex-col rounded-md border bg-card ${
        isOver ? "border-primary" : ""
      }`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">{label}</h2>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {issues.length}
        </span>
      </div>
      <SortableContext
        items={issues.map((issue) => issue.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          {issues.map((issue) => (
            <KanbanCard columnId={columnId} issue={issue} key={issue.id} />
          ))}
          <div
            className={`flex min-h-16 items-center justify-center rounded-md border border-dashed text-xs font-medium ${
              isOver
                ? "border-primary bg-muted text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            Drop here
          </div>
        </div>
      </SortableContext>
    </section>
  );
}

export function PlanningKanbanBoard({
  issues,
  owner,
  repo,
  statusMode
}: {
  issues: PlanningKanbanCard[];
  owner: string;
  repo: string;
  statusMode: PlanningStatusMode;
}) {
  const [localIssues, setLocalIssues] = useState(issues);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLocalIssues(issues);
  }, [issues]);
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
  const columns = useMemo(() => buildColumns(statusMode), [statusMode]);
  const activeIssue = localIssues.find((issue) => issue.id === activeIssueId) ?? null;
  const issuesByColumn = useMemo(() => {
    const groupedIssues: Record<string, PlanningKanbanCard[]> = Object.fromEntries(
      columns.map((column) => [column.id, []])
    );

    for (const issue of localIssues) {
      const columnId = resolveIssueStatusValue(issue, statusMode);
      const targetColumnId = groupedIssues[columnId] ? columnId : NO_STATUS_COLUMN_ID;

      groupedIssues[targetColumnId]?.push(issue);
    }

    for (const columnIssues of Object.values(groupedIssues)) {
      columnIssues.sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    }

    return groupedIssues;
  }, [columns, localIssues, statusMode]);

  function handleDragStart(event: DragStartEvent) {
    setActiveIssueId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveIssueId(null);

    if (!event.over) {
      return;
    }

    const issueId = String(event.active.id);
    const draggedIssue = localIssues.find((issue) => issue.id === issueId);

    if (draggedIssue?.contentType === "DRAFT_ISSUE") {
      return;
    }

    const activeData = getKanbanDragData(event.active.data.current, columns);
    const overData = getKanbanDragData(event.over.data.current, columns);
    const currentColumnId = activeData?.columnId;
    const nextColumnId = overData?.columnId;

    if (!currentColumnId || !nextColumnId || currentColumnId === nextColumnId) {
      return;
    }

    setStatusError(null);

    const nextOptionId = nextColumnId === NO_STATUS_COLUMN_ID ? null : nextColumnId;
    const nextLocalLabel =
      nextColumnId === NO_STATUS_COLUMN_ID
        ? null
        : (LOCAL_STATUS_OPTIONS.find((option) => option.id === nextColumnId)?.label ?? null);

    setLocalIssues((currentIssues) =>
      currentIssues.map((issue) =>
        issue.id === issueId
          ? statusMode.mode === "project"
            ? { ...issue, planningStatusOptionId: nextOptionId, planningStatusSource: "LOCAL" }
            : { ...issue, planningStatus: nextLocalLabel, planningStatusSource: "LOCAL" }
          : issue
      )
    );

    startTransition(() => {
      const updatePromise =
        statusMode.mode === "project"
          ? updateIssuePlanningStatus({ issueId, owner, repo, status: nextOptionId })
          : updateIssueLocalPlanningStatus({ issueId, owner, repo, status: nextColumnId === NO_STATUS_COLUMN_ID ? null : nextColumnId });

      void updatePromise.catch((error: unknown) => {
        setLocalIssues((currentIssues) =>
          currentIssues.map((issue) =>
            issue.id === issueId
              ? statusMode.mode === "project"
                ? {
                    ...issue,
                    planningStatusOptionId: draggedIssue?.planningStatusOptionId ?? null,
                    planningStatusSource:
                      draggedIssue?.planningStatusSource ?? issue.planningStatusSource
                  }
                : {
                    ...issue,
                    planningStatus: draggedIssue?.planningStatus ?? issue.planningStatus,
                    planningStatusSource:
                      draggedIssue?.planningStatusSource ?? issue.planningStatusSource
                  }
              : issue
          )
        );
        setStatusError(
          error instanceof Error
            ? error.message
            : "Unable to update GitHub Project status. Sync planning data and try again."
        );
      });
    });
  }

  if (issues.length === 0) {
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
    <DndContext
      collisionDetection={kanbanCollisionDetection}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {statusError ? (
        <div className="mb-4 rounded-md border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          {statusError}
        </div>
      ) : null}
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => (
            <KanbanColumn
              columnId={column.id}
              issues={issuesByColumn[column.id] ?? []}
              key={column.id}
              label={column.label}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeIssue ? (
          <KanbanCard
            columnId={resolveIssueStatusValue(activeIssue, statusMode)}
            isOverlay
            issue={activeIssue}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
