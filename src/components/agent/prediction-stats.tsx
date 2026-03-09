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

  const winRatePercentage = Math.round(stats.winRate * 100);
  const calibrationPercentage = Math.round(stats.calibrationScore * 100);

  // Determine ring color based on win rate
  const getRingColor = (rate: number): string => {
    if (rate >= 0.6) return "stroke-bullish";
    if (rate >= 0.4) return "stroke-amber-500";
    return "stroke-bearish";
  };

  const ringColor = getRingColor(stats.winRate);

  // SVG circular progress ring parameters
  const radius = 36;
  const strokeWidth = 6;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (stats.winRate * circumference);

  return (
    <div className={cn("rounded-xl border border-border p-4", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">
        {t("title")}
      </h3>

      {/* Hero Section: Win Rate Ring + Details */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/50">
        {/* SVG Ring */}
        <div className="relative flex-shrink-0">
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            {/* Background track */}
            <circle
              stroke="currentColor"
              className="stroke-muted"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Progress ring */}
            <circle
              stroke="currentColor"
              className={cn(ringColor, "transition-all duration-500")}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference + " " + circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          {/* Centered percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-foreground font-mono">
              {winRatePercentage}%
            </span>
          </div>
        </div>

        {/* Details next to ring */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">{t("winRate")}</p>
          <p className="text-sm font-semibold text-foreground mb-1">
            {t("winRateDetail", {
              correct: stats.correctPredictions,
              total: stats.totalPredictions,
            })}
          </p>
          {stats.streakInfo.type !== "none" && (
            <p className="text-xs font-medium">
              {stats.streakInfo.type === "win" ? (
                <span className="text-bullish">
                  {t("streak_win", { count: stats.streakInfo.count })} 🔥
                </span>
              ) : (
                <span className="text-bearish">
                  {t("streak_loss", { count: stats.streakInfo.count })}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Supporting Stats Grid (2x2) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Total Predictions */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground mb-1">
            {t("total")}
          </p>
          <p className="text-lg font-semibold font-mono text-foreground">
            {stats.totalPredictions}
          </p>
        </div>

        {/* Calibration with progress bar */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground mb-1">
            {t("confidenceAccuracy")}
          </p>
          <p className="text-lg font-semibold font-mono text-foreground mb-1">
            {calibrationPercentage}%
          </p>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${calibrationPercentage}%` }}
            />
          </div>
        </div>

        {/* Total Votes Earned */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground mb-1">
            {t("votesEarned")}
          </p>
          <p className="text-lg font-semibold font-mono text-foreground">
            {stats.totalVotesEarned.toLocaleString()}
          </p>
        </div>

        {/* Average Score */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground mb-1">
            {t("avgScore")}
          </p>
          <p className="text-lg font-semibold font-mono text-foreground">
            {stats.avgScore.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
