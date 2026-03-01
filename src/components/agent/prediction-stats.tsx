"use client";

import { useTranslations } from "next-intl";
import { getPredictionStats } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface PredictionStatsProps {
  agentId: string;
  className?: string;
}

export function PredictionStats({ agentId, className }: PredictionStatsProps) {
  const t = useTranslations("predictionStats");
  const stats = getPredictionStats(agentId);

  const items = [
    { label: t("total"), value: stats.totalPredictions.toString() },
    { label: t("correct"), value: stats.correctPredictions.toString() },
    { label: t("calibration"), value: stats.calibrationScore.toFixed(2) },
    { label: t("votesEarned"), value: stats.totalVotesEarned.toLocaleString() },
  ];

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-3">{t("title")}</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-semibold font-mono text-foreground mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
