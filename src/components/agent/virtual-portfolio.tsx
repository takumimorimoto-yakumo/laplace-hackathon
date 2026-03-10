import { cn } from "@/lib/utils";

interface PeriodReturnLabels {
  period24h: string;
  period7d: string;
  period30d: string;
}

interface VirtualPortfolioLabels {
  title: string;
  initial: string;
  current: string;
  periodReturns?: PeriodReturnLabels;
}

interface VirtualPortfolioProps {
  initialValue: number;
  currentValue: number;
  returnPercent: number;
  return24h?: number;
  return7d?: number;
  return30d?: number;
  labels?: VirtualPortfolioLabels;
}

function formatDollar(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatReturn(value: number, initial: number): string {
  const diff = value - initial;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${formatDollar(diff)}`;
}

function formatReturnPercent(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${(percent * 100).toFixed(1)}%`;
}

export function VirtualPortfolio({
  initialValue,
  currentValue,
  returnPercent,
  return24h,
  return7d,
  return30d,
  labels,
}: VirtualPortfolioProps) {
  const isPositive = returnPercent >= 0;
  const titleLabel = labels?.title ?? "Virtual Portfolio";
  const initialLabel = labels?.initial ?? "Initial";
  const currentLabel = labels?.current ?? "Current";
  const periodLabels = labels?.periodReturns;

  const hasPeriodReturns =
    return24h !== undefined || return7d !== undefined || return30d !== undefined;

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        {titleLabel}
      </h3>

      <div className="mb-1 flex items-baseline gap-2 font-mono text-sm">
        <span className="text-muted-foreground">
          {initialLabel}: {formatDollar(initialValue)}
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          &rarr;
        </span>
        <span className="font-semibold text-foreground">
          {currentLabel}: {formatDollar(currentValue)}
        </span>
      </div>

      <p
        className={cn(
          "font-mono text-sm font-semibold",
          isPositive ? "text-bullish" : "text-bearish"
        )}
      >
        {formatReturn(currentValue, initialValue)} ({formatReturnPercent(returnPercent)})
      </p>

      {hasPeriodReturns && (
        <div className="mt-3 flex gap-2">
          {return24h !== undefined && (
            <PeriodBadge label={periodLabels?.period24h ?? "24h"} value={return24h} />
          )}
          {return7d !== undefined && (
            <PeriodBadge label={periodLabels?.period7d ?? "7d"} value={return7d} />
          )}
          {return30d !== undefined && (
            <PeriodBadge label={periodLabels?.period30d ?? "30d"} value={return30d} />
          )}
        </div>
      )}
    </div>
  );
}

function PeriodBadge({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 font-mono text-xs",
        value >= 0 ? "text-bullish" : "text-bearish"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      {formatReturnPercent(value)}
    </span>
  );
}
