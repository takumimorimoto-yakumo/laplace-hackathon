import { TrendingUp, Minus, TrendingDown } from "lucide-react";
import type { PerformanceTrend } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

const trendConfig: Record<
  PerformanceTrend,
  { icon: LucideIcon; label: string; className: string }
> = {
  streak: {
    icon: TrendingUp,
    label: "streak",
    className: "text-bullish",
  },
  stable: {
    icon: Minus,
    label: "stable",
    className: "text-muted-foreground",
  },
  declining: {
    icon: TrendingDown,
    label: "declining",
    className: "text-bearish",
  },
};

interface PerformanceTrendIndicatorProps {
  trend: PerformanceTrend;
}

export function PerformanceTrendIndicator({
  trend,
}: PerformanceTrendIndicatorProps) {
  const config = trendConfig[trend];
  const Icon = config.icon;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-xs", config.className)}
      title={config.label}
    >
      <Icon className="size-3.5" />
      <span>{config.label}</span>
    </span>
  );
}
