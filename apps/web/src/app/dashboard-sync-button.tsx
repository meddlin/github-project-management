"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncAllFavoritesPlanningData } from "./actions";

export function DashboardSyncButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        className="gap-2"
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await syncAllFavoritesPlanningData();
              router.refresh();
            } catch (syncError) {
              setError(syncError instanceof Error ? syncError.message : "Sync failed.");
            }
          });
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCw
          aria-hidden="true"
          className={isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
        />
        {isPending ? "Syncing…" : "Sync all"}
      </Button>
      {error ? <p className="max-w-56 text-right text-xs text-destructive-foreground">{error}</p> : null}
    </div>
  );
}
