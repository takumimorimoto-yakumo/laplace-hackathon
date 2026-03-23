"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, Bot, Users, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PerformanceTrendIndicator } from "@/components/agent/performance-trend";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { Agent, ReturnPeriod } from "@/lib/types";
import type { RankingSortField } from "@/components/timeline/ranking-sort";

const PAGE_SIZE = 50;

interface AgentRankingListProps {
  agents: Agent[];
  sortField?: RankingSortField;
  returnPeriod?: ReturnPeriod;
}

const trophyColors: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-zinc-400",
  3: "text-amber-700",
};

function formatReturn(returnPercent: number): string {
  const sign = returnPercent >= 0 ? "+" : "";
  return `${sign}${(returnPercent * 100).toFixed(1)}%`;
}

function getReturnForPeriod(agent: Agent, period: ReturnPeriod = "all"): number {
  switch (period) {
    case "1d": return agent.return24h;
    case "1w": return agent.return7d;
    case "1m": return agent.return30d;
    default: return agent.portfolioReturn;
  }
}

function getSortValue(
  agent: Agent,
  sortField: RankingSortField,
  returnPeriod: ReturnPeriod = "all"
): string {
  switch (sortField) {
    case "return":
      return formatReturn(getReturnForPeriod(agent, returnPeriod));
    case "accuracy":
      return `${Math.round(agent.accuracy * 100)}%`;
    case "followers":
      return `${agent.followerCount}`;
    case "predictions":
      return `${agent.totalPredictions}`;
    default:
      return formatReturn(agent.portfolioReturn);
  }
}

function getSortValueColor(
  agent: Agent,
  sortField: RankingSortField,
  returnPeriod: ReturnPeriod = "all"
): string {
  if (sortField === "return") {
    const val = getReturnForPeriod(agent, returnPeriod);
    return val >= 0 ? "text-bullish" : "text-bearish";
  }
  return "text-foreground";
}

export function AgentRankingList({
  agents,
  sortField = "rank",
  returnPeriod = "all",
}: AgentRankingListProps) {
  const t = useTranslations("leaderboard");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const isRankSort = sortField === "rank";

  const visibleAgents = agents.slice(0, visibleCount);
  const hasMore = visibleCount < agents.length;
  const remaining = agents.length - visibleCount;

  return (
    <div>
      <div className="divide-y divide-border">
        {visibleAgents.map((agent, index) => (
          <Link
            key={agent.id}
            href={`/agent/${agent.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface/50 cursor-pointer"
          >
            {/* Rank / Position */}
            <div className="flex w-8 shrink-0 items-center justify-center">
              {isRankSort && agent.rank <= 3 ? (
                <Trophy
                  className={cn("size-4", trophyColors[agent.rank])}
                />
              ) : (
                <span className="text-sm font-bold text-muted-foreground">
                  {isRankSort ? agent.rank : index + 1}
                </span>
              )}
            </div>

            {/* Avatar */}
            <Avatar size="default">
              <AvatarImage
                src={getAgentAvatarUrl(agent.name)}
                alt={agent.name}
              />
              <AvatarFallback>
                <Bot className="size-4" />
              </AvatarFallback>
            </Avatar>

            {/* Name + Trend */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {agent.name}
                </span>
                <PerformanceTrendIndicator trend={agent.trend} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {t("accuracy")} {Math.round(agent.accuracy * 100)}%
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-0.5">
                  <Users className="size-3" />
                  {agent.followerCount}
                </span>
              </div>
            </div>

            {/* Sort value */}
            <span
              className={cn(
                "shrink-0 text-sm font-mono font-semibold",
                getSortValueColor(agent, sortField, returnPeriod)
              )}
            >
              {getSortValue(agent, sortField, returnPeriod)}
            </span>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface/80 hover:text-foreground"
          >
            <ChevronDown className="size-3.5" />
            {t("loadMore")} ({remaining})
          </button>
        </div>
      )}
    </div>
  );
}
