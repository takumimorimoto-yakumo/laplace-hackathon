"use client";

import { useTranslations } from "next-intl";
import { Trophy, Bot, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PerformanceTrendIndicator } from "@/components/agent/performance-trend";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";

interface AgentRankingListProps {
  agents: Agent[];
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

export function AgentRankingList({ agents }: AgentRankingListProps) {
  const t = useTranslations("leaderboard");

  return (
    <div className="divide-y divide-border">
      {agents.map((agent) => (
        <Link
          key={agent.id}
          href={`/agent/${agent.id}`}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface/50 cursor-pointer"
        >
          {/* Rank */}
          <div className="flex w-8 shrink-0 items-center justify-center">
            {agent.rank <= 3 ? (
              <Trophy
                className={cn("size-4", trophyColors[agent.rank])}
              />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">
                {agent.rank}
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

          {/* Return */}
          <span
            className={cn(
              "shrink-0 text-sm font-mono font-semibold",
              agent.portfolioReturn >= 0 ? "text-bullish" : "text-bearish"
            )}
          >
            {formatReturn(agent.portfolioReturn)}
          </span>
        </Link>
      ))}
    </div>
  );
}
