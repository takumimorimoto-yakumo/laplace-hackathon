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

  return (
    <AreaChart
      values={values}
      title={t("title")}
      valueLabel={`${(current * 100).toFixed(0)}%`}
      height={140}
      className={className}
    />
  );
}
