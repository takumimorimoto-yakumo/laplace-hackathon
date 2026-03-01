import { cn } from "@/lib/utils";

interface VirtualPortfolioLabels {
  title: string;
  initial: string;
  current: string;
}

interface VirtualPortfolioProps {
  initialValue: number;
  currentValue: number;
  returnPercent: number;
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
  labels,
}: VirtualPortfolioProps) {
  const isPositive = returnPercent >= 0;
  const titleLabel = labels?.title ?? "Virtual Portfolio";
  const initialLabel = labels?.initial ?? "Initial";
  const currentLabel = labels?.current ?? "Current";

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
    </div>
  );
}
