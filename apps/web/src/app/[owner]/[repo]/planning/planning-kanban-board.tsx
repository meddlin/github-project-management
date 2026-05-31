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
import { useMemo, useState, useTransition } from "react";
import {
  updateIssuePlanningStatus,
  type PlanningStatusValue
} from "../../../actions";
import type { PlanningIssue } from "./planning-issue-split-view";

const columns: Array<{ label: string; status: PlanningStatusValue }> = [
  { label: "No status", status: "NO_STATUS" },
  { label: "Backlog", status: "BACKLOG" },
  { label: "Ready", status: "READY" },
  { label: "In progress", status: "IN_PROGRESS" },
  { label: "In review", status: "IN_REVIEW" },
  { label: "Done", status: "DONE" }
];

type KanbanDragData =
  | {
      issueId: string;
      status: PlanningStatusValue;
      type: "card";
    }
  | {
      status: PlanningStatusValue;
      type: "column";
    };

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

function normalizeIssueStatus(status: string): PlanningStatusValue {
  return columns.some((column) => column.status === status)
    ? (status as PlanningStatusValue)
    : "NO_STATUS";
}

function getKanbanDragData(value: unknown): KanbanDragData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<KanbanDragData>;

  if (data.type === "card" && data.issueId && data.status) {
    return {
      issueId: data.issueId,
      status: normalizeIssueStatus(data.status),
      type: "card"
    };
  }

  if (data.type === "column" && data.status) {
    return {
      status: normalizeIssueStatus(data.status),
      type: "column"
    };
  }

  return null;
}

function GitHubStateBadge({ state }: { state: string }) {
  const isOpen = state.toUpperCase() === "OPEN";

  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
        isOpen
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"
      }`}
    >
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}

function KanbanCard({
  isOverlay = false,
  issue,
  status
}: {
  isOverlay?: boolean;
  issue: PlanningIssue;
  status: PlanningStatusValue;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    data: {
      issueId: issue.id,
      status,
      type: "card"
    },
    disabled: isOverlay,
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
        <button
          aria-label={`Drag issue ${issue.number}`}
          className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{issue.number}</span>
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
          {issue.assignees.length > 0 ? issue.assignees.join(", ") : "Unassigned"}
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
        <span className="inline-flex items-center gap-1">
          <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
          {issue.commentCount}
        </span>
        <a
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          href={issue.url}
          rel="noreferrer"
          target="_blank"
        >
          GitHub
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

function KanbanColumn({
  issues,
  label,
  status
}: {
  issues: PlanningIssue[];
  label: string;
  status: PlanningStatusValue;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: {
      status,
      type: "column"
    },
    id: status
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
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {issues.map((issue) => (
            <KanbanCard issue={issue} key={issue.id} status={status} />
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
  repo
}: {
  issues: PlanningIssue[];
  owner: string;
  repo: string;
}) {
  const [localIssues, setLocalIssues] = useState(issues);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
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
  const activeIssue = localIssues.find((issue) => issue.id === activeIssueId) ?? null;
  const issuesByStatus = useMemo(() => {
    return columns.reduce<Record<PlanningStatusValue, PlanningIssue[]>>(
      (groupedIssues, column) => {
        groupedIssues[column.status] = localIssues
          .filter((issue) => normalizeIssueStatus(issue.planningStatus) === column.status)
          .sort(
            (left, right) =>
              new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
          );

        return groupedIssues;
      },
      {
        BACKLOG: [],
        DONE: [],
        IN_PROGRESS: [],
        IN_REVIEW: [],
        NO_STATUS: [],
        READY: []
      }
    );
  }, [localIssues]);

  function handleDragStart(event: DragStartEvent) {
    setActiveIssueId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveIssueId(null);

    if (!event.over) {
      return;
    }

    const issueId = String(event.active.id);
    const activeData = getKanbanDragData(event.active.data.current);
    const overData = getKanbanDragData(event.over.data.current);
    const currentStatus = activeData?.status;
    const nextStatus = overData?.status;

    if (!nextStatus || currentStatus === nextStatus) {
      return;
    }

    setLocalIssues((currentIssues) =>
      currentIssues.map((issue) =>
        issue.id === issueId
          ? {
              ...issue,
              planningStatus: nextStatus,
              planningStatusSource: "LOCAL"
            }
          : issue
      )
    );

    startTransition(() => {
      void updateIssuePlanningStatus({
        issueId,
        owner,
        repo,
        status: nextStatus
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
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => (
            <KanbanColumn
              issues={issuesByStatus[column.status]}
              key={column.status}
              label={column.label}
              status={column.status}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeIssue ? (
          <KanbanCard
            isOverlay
            issue={activeIssue}
            status={normalizeIssueStatus(activeIssue.planningStatus)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
