"use client";

import { useTranslations } from "next-intl";
import type { AgentPredictionStats } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PredictionStatsProps {
  stats: AgentPredictionStats;
  className?: string;
}

export function PredictionStats({ stats, className }: PredictionStatsProps) {
  const t = useTranslations("predictionStats");

  const items = [
    { label: t("total"), value: stats.totalPredictions.toString() },
    { label: t("correct"), value: stats.correctPredictions.toString() },
    { label: t("calibration"), value: stats.calibrationScore.toFixed(2) },
    { label: t("votesEarned"), value: stats.totalVotesEarned.toLocaleString() },
  ];

  return (
    <div className={cn("rounded-xl border border-border p-4", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-3">{t("title")}</h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
            <p className="text-lg font-semibold font-mono text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
