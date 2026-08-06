export type ProjectStatusOption = {
  id: string;
  name: string;
};

export type PlanningStatusMode =
  | { mode: "project"; statusOptions: ProjectStatusOption[] }
  | { mode: "local" };

export function parseProjectStatusOptions(value: unknown): ProjectStatusOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((option): option is ProjectStatusOption => {
    if (!option || typeof option !== "object") {
      return false;
    }

    const candidate = option as Partial<ProjectStatusOption>;

    return typeof candidate.id === "string" && typeof candidate.name === "string";
  });
}

export function pickPrimaryProjectItem<
  T extends {
    itemUpdatedAt: Date | null;
    importedAt: Date;
    project: { title: string; nodeId: string };
  }
>(items: T[]): T | null {
  return (
    [...items].sort((left, right) => {
      const leftTime = left.itemUpdatedAt?.getTime() ?? left.importedAt.getTime();
      const rightTime = right.itemUpdatedAt?.getTime() ?? right.importedAt.getTime();

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      const titleCompare = left.project.title.localeCompare(right.project.title);

      if (titleCompare !== 0) {
        return titleCompare;
      }

      return left.project.nodeId.localeCompare(right.project.nodeId);
    })[0] ?? null
  );
}

export const NO_STATUS_COLUMN_ID = "NO_STATUS";

export const LOCAL_STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "READY", label: "Ready" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "IN_REVIEW", label: "In review" },
  { id: "DONE", label: "Done" }
];

export function normalizeLocalStatusValue(planningStatus: string | null): string {
  if (!planningStatus) {
    return NO_STATUS_COLUMN_ID;
  }

  const match = LOCAL_STATUS_OPTIONS.find(
    (option) => option.label.toLowerCase() === planningStatus.trim().toLowerCase()
  );

  return match?.id ?? NO_STATUS_COLUMN_ID;
}

export function resolveIssueStatusValue(
  issue: { planningStatus: string | null; planningStatusOptionId: string | null },
  statusMode: PlanningStatusMode
): string {
  if (statusMode.mode === "project") {
    return issue.planningStatusOptionId ?? NO_STATUS_COLUMN_ID;
  }

  return normalizeLocalStatusValue(issue.planningStatus);
}
