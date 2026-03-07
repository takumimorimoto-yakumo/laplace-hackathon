import type { Position } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PositionListLabels {
  title: string;
  noPositions: string;
  long: string;
  short: string;
}

interface PositionListProps {
  positions: Position[];
  labels?: PositionListLabels;
}

function formatAge(enteredAt: string): string {
  const entered = new Date(enteredAt);
  const now = new Date();
  const diffMs = now.getTime() - entered.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "<1h";
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function formatSize(size: number): string {
  return `$${size.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatReturn(ret: number): string {
  const sign = ret >= 0 ? "+" : "";
  return `${sign}${ret.toFixed(1)}%`;
}

export function PositionList({ positions, labels }: PositionListProps) {
  const titleLabel = labels?.title ?? "Open Positions";
  const noPositionsLabel = labels?.noPositions ?? "No open positions";
  const longLabel = labels?.long ?? "Long";
  const shortLabel = labels?.short ?? "Short";

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          {titleLabel}
        </h3>
        <p className="text-sm text-muted-foreground">{noPositionsLabel}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        {titleLabel}
      </h3>

      <div className="space-y-2">
        {positions.map((position, index) => {
          const isLong = position.direction === "long";
          const isPositiveReturn = position.currentReturn >= 0;

          return (
            <div
              key={`${position.tokenSymbol}-${position.direction}-${index}`}
              className="grid grid-cols-[3.5rem_3.5rem_1fr_auto_2rem] items-center gap-x-2 rounded-md border border-border px-3 py-2"
            >
              {/* Token */}
              <span className="truncate font-mono text-sm font-semibold text-foreground">
                {position.tokenSymbol}
              </span>

              {/* Direction + Leverage */}
              <span
                className={cn(
                  "text-xs font-medium",
                  isLong ? "text-bullish" : "text-bearish"
                )}
              >
                {isLong ? longLabel : shortLabel}
                {position.leverage > 1 && (
                  <span className="ml-1 text-muted-foreground">
                    {position.leverage}x
                  </span>
                )}
              </span>

              {/* Size */}
              <span className="text-right font-mono text-xs text-muted-foreground">
                {formatSize(position.size)}
              </span>

              {/* Return */}
              <span
                className={cn(
                  "text-right font-mono text-xs font-medium",
                  isPositiveReturn ? "text-bullish" : "text-bearish"
                )}
              >
                {formatReturn(position.currentReturn)}
              </span>

              {/* Age */}
              <span className="text-right text-xs text-muted-foreground">
                {formatAge(position.enteredAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
