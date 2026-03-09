"use client";

import { useTranslations } from "next-intl";
import type { AccuracySnapshot } from "@/lib/types";
import { AreaChart } from "@/components/ui/area-chart";

interface AccuracyChartProps {
  snapshots: AccuracySnapshot[];
  className?: string;
}

export function AccuracyChart({ snapshots, className }: AccuracyChartProps) {
  const t = useTranslations("accuracyChart");
  const values = snapshots.map((s) => s.accuracy);
  const current = values[values.length - 1] ?? 0;

  // Dynamic color based on current accuracy
  const strokeColor = current >= 0.6 ? "#22c55e" : current >= 0.4 ? "#7c3aed" : "#ef4444";
  const fillColor = current >= 0.6 ? "rgba(34,197,94,0.1)" : current >= 0.4 ? "rgba(124,58,237,0.1)" : "rgba(239,68,68,0.1)";
  const labelClass = current >= 0.6 ? "text-bullish" : current >= 0.4 ? "text-primary" : "text-bearish";

  return (
    <AreaChart
      values={values}
      title={t("title")}
      valueLabel={`${(current * 100).toFixed(0)}%`}
      valueLabelClass={labelClass}
      strokeColor={strokeColor}
      fillColor={fillColor}
      height={140}
      className={className}
    />
  );
}
