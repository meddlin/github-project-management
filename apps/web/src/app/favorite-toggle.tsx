"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setRepositoryFavorite } from "./actions";

type FavoriteToggleProps = {
  favorite: boolean;
  repositoryId: string;
};

export function FavoriteToggle({ favorite, repositoryId }: FavoriteToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(favorite);
  const nextFavorite = !optimisticFavorite;

  return (
    <button
      aria-label={optimisticFavorite ? "Remove from favorites" : "Add to favorites"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
        optimisticFavorite
          ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100"
          : "border-zinc-200 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-70`}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          setOptimisticFavorite(nextFavorite);
          try {
            await setRepositoryFavorite(repositoryId, nextFavorite);
          } catch {
            setOptimisticFavorite(favorite);
          } finally {
            router.refresh();
          }
        });
      }}
      title={optimisticFavorite ? "Remove from favorites" : "Add to favorites"}
      type="button"
    >
      <Star
        aria-hidden="true"
        className="h-4 w-4"
        fill={optimisticFavorite ? "currentColor" : "none"}
      />
    </button>
  );
}
