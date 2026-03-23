"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PortfolioSnapshot } from "@/lib/types";
import { formatCompactNumber } from "@/lib/format";
import { AreaChart } from "@/components/ui/area-chart";
import { cn } from "@/lib/utils";

type ChartTimeframe = "1D" | "1W" | "1M";

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[];
  hourlySnapshots?: PortfolioSnapshot[];
  className?: string;
}

export function PortfolioChart({ snapshots, hourlySnapshots, className }: PortfolioChartProps) {
  const t = useTranslations("portfolioChart");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1W");

  const timeframes: ChartTimeframe[] = ["1D", "1W", "1M"];

  const activeSnapshots = getSnapshotsForTimeframe(timeframe, snapshots, hourlySnapshots);

  if (activeSnapshots.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
          <TimeframeSelector
            timeframes={timeframes}
            selected={timeframe}
            onChange={setTimeframe}
          />
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("noData")}
        </p>
      </div>
    );
  }

  const values = activeSnapshots.map((s) => s.value);
  const lastValue = values[values.length - 1] ?? 0;
  const firstValue = values[0] ?? 0;
  const isPositive = lastValue >= firstValue;

  return (
    <AreaChart
      values={values}
      title={t("title")}
      valueLabel={formatCompactNumber(lastValue)}
      valueLabelClass={isPositive ? "text-bullish" : "text-bearish"}
      strokeColor={isPositive ? "#22c55e" : "#ef4444"}
      fillColor={isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}
      height={160}
      className={className}
      headerRight={
        <TimeframeSelector
          timeframes={timeframes}
          selected={timeframe}
          onChange={setTimeframe}
        />
      }
    />
  );
}

function TimeframeSelector({
  timeframes,
  selected,
  onChange,
}: {
  timeframes: ChartTimeframe[];
  selected: ChartTimeframe;
  onChange: (tf: ChartTimeframe) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
            selected === tf
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

function getSnapshotsForTimeframe(
  timeframe: ChartTimeframe,
  dailySnapshots: PortfolioSnapshot[],
  hourlySnapshots?: PortfolioSnapshot[],
): PortfolioSnapshot[] {
  switch (timeframe) {
    case "1D":
      return hourlySnapshots ?? [];
    case "1W": {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return dailySnapshots.filter((s) => s.date >= weekAgo);
    }
    case "1M":
      return dailySnapshots;
    default:
      return dailySnapshots;
  }
}
