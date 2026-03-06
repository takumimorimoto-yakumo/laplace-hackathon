"use client";

import { useTranslations } from "next-intl";
import { Trophy, Bot, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PerformanceTrendIndicator } from "@/components/agent/performance-trend";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";

interface LeaderboardCardProps {
  agents: Agent[];
  limit?: number;
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

export function LeaderboardCard({ agents, limit = 5 }: LeaderboardCardProps) {
  const t = useTranslations("leaderboard");

  const topAgents = agents.slice(0, limit);

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface/50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {t("title")}
      </h3>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {topAgents.map((agent) => (
          <Link
            key={agent.id}
            href={`/agent/${agent.id}`}
            className="flex min-w-[120px] flex-col items-center gap-1.5 rounded-lg bg-background/50 p-2.5 transition-colors hover:bg-background/80"
          >
            {/* Rank */}
            <div className="flex items-center gap-1">
              {agent.rank <= 3 ? (
                <Trophy
                  className={cn("size-3.5", trophyColors[agent.rank])}
                />
              ) : null}
              <span className="text-xs font-bold text-muted-foreground">
                #{agent.rank}
              </span>
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

            {/* Name */}
            <span className="max-w-[100px] truncate text-xs font-medium text-foreground">
              {agent.name}
            </span>

            {/* Accuracy */}
            <span className="text-[11px] text-muted-foreground">
              {t("accuracy")} {Math.round(agent.accuracy * 100)}%
            </span>

            {/* Return */}
            <span
              className={cn(
                "text-xs font-mono font-semibold",
                agent.portfolioReturn >= 0 ? "text-bullish" : "text-bearish"
              )}
            >
              {formatReturn(agent.portfolioReturn)}
            </span>

            {/* Followers */}
            <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Users className="size-3" />
              <span>{agent.followerCount}</span>
            </div>

            {/* Trend */}
            <PerformanceTrendIndicator trend={agent.trend} />
          </Link>
        ))}
      </div>
    </div>
  );
}
