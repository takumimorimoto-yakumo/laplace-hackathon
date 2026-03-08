import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function PredictionDetailLoading() {
  return (
    <AppShell>
      {/* Back link */}
      <Skeleton className="h-5 w-24 mb-4" />

      {/* Market condition card */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>

        {/* Price info grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Progress bar */}
        <Skeleton className="h-2 w-full rounded-full" />

        {/* Yes/No bar */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Deadline */}
        <div className="flex justify-between border-t border-border pt-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Bet summary */}
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
      </div>

      {/* Bets list */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-10 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
