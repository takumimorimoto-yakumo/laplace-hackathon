"use client";

import { useTranslations } from "next-intl";
import type { PortfolioSnapshot } from "@/lib/types";
import { formatCompactNumber } from "@/lib/format";
import { AreaChart } from "@/components/ui/area-chart";

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[];
  className?: string;
}

export function PortfolioChart({ snapshots, className }: PortfolioChartProps) {
  const t = useTranslations("portfolioChart");

  if (snapshots.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">{t("title")}</h3>
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("noData")}
        </p>
      </div>
    );
  }

  const values = snapshots.map((s) => s.value);
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
    />
  );
}
