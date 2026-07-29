"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncRepositoryPlanningData } from "../actions";

type SyncState = {
  error: string | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Waiting for first refresh";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ProjectsAutoRefresh({
  owner,
  repo
}: {
  owner: string | null;
  repo: string | null;
}) {
  const router = useRouter();
  const [syncState, setSyncState] = useState<SyncState>({
    error: null,
    isSyncing: false,
    lastSyncedAt: null
  });

  useEffect(() => {
    if (!owner || !repo) {
      return;
    }

    let isMounted = true;
    let isRunning = false;

    async function refreshPlanningData() {
      if (isRunning || !owner || !repo) {
        return;
      }

      isRunning = true;
      setSyncState((currentState) => ({
        ...currentState,
        error: null,
        isSyncing: true
      }));

      try {
        const result = await syncRepositoryPlanningData({
          owner,
          repo
        });

        if (!isMounted) {
          return;
        }

        setSyncState({
          error: null,
          isSyncing: false,
          lastSyncedAt: result.syncedAt
        });
        router.refresh();
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSyncState((currentState) => ({
          error: error instanceof Error ? error.message : "Unable to refresh GitHub data.",
          isSyncing: false,
          lastSyncedAt: currentState.lastSyncedAt
        }));
      } finally {
        isRunning = false;
      }
    }

    void refreshPlanningData();
    const intervalId = window.setInterval(() => {
      void refreshPlanningData();
    }, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [owner, repo, router]);

  if (!owner || !repo) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-card-foreground">
        <RefreshCw
          aria-hidden="true"
          className={`h-4 w-4 text-primary ${syncState.isSyncing ? "animate-spin" : ""}`}
        />
        Watching GitHub
      </div>
      <div className={syncState.error ? "text-destructive-foreground" : "text-muted-foreground"}>
        {syncState.error
          ? syncState.error
          : syncState.isSyncing
            ? "Refreshing project and issue data"
            : `Last refresh ${formatDate(syncState.lastSyncedAt)}`}
      </div>
    </div>
  );
}
