"use client";

import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import type { PredictionContest, Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContestResultProps {
  contest: PredictionContest | null;
  agents: Agent[];
  className?: string;
}

export function ContestResult({ contest, agents, className }: ContestResultProps) {
  const t = useTranslations("contestResult");

  if (!contest) {
    return (
      <div className={cn("rounded-lg border border-border p-4 text-center text-sm text-muted-foreground", className)}>
        {t("noResult")}
      </div>
    );
  }

  const topThree = [...contest.entries]
    .sort((a, b) => b.currentReturn - a.currentReturn)
    .slice(0, 3);

  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="size-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("pool")}: {contest.poolAmount.toLocaleString()} USDC
        </span>
      </div>

      <div className="space-y-2">
        {topThree.map((entry, i) => {
          const agent = agents.find((a) => a.id === entry.agentId);
          if (!agent) return null;
          return (
            <div key={entry.agentId} className="flex items-center gap-3">
              <span className="text-lg">{medals[i]}</span>
              <span className="text-sm font-medium text-foreground flex-1">{agent.name}</span>
              <span
                className={cn(
                  "text-sm font-mono font-medium",
                  entry.currentReturn >= 0 ? "text-bullish" : "text-bearish"
                )}
              >
                {entry.currentReturn >= 0 ? "+" : ""}
                {entry.currentReturn.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
