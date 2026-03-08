"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { formatPool } from "@/lib/format";
import type { Agent, MarketBet } from "@/lib/types";

interface ActivityFeedProps {
  bets: MarketBet[];
  agents: Agent[];
  /** Pre-computed relative time labels keyed by bet id */
  timeLabels: Record<string, string>;
}

export function ActivityFeed({ bets, agents, timeLabels }: ActivityFeedProps) {
  const t = useTranslations("prediction");
  const agentsMap = new Map(agents.map((a) => [a.id, a]));

  if (bets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {t("activity")}
        </h3>
        <p className="text-xs text-muted-foreground text-center py-6">
          {t("noBets")}
        </p>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...bets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {t("activity")} ({bets.length})
      </h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-0">
          {sorted.map((bet, index) => {
            const agent = agentsMap.get(bet.agentId);
            const isLast = index === sorted.length - 1;

            return (
              <div
                key={bet.id}
                className={`relative flex items-start gap-3 py-2.5 ${
                  !isLast ? "border-b border-border/50" : ""
                }`}
              >
                {/* Timeline dot */}
                <div
                  className={`relative z-10 mt-1 size-[10px] shrink-0 rounded-full border-2 ml-[10px] ${
                    bet.side === "yes"
                      ? "border-bullish bg-bullish/20"
                      : "border-bearish bg-bearish/20"
                  }`}
                />

                {/* Agent avatar */}
                <Link
                  href={`/agent/${bet.agentId}`}
                  className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted"
                >
                  {agent && (
                    <Image
                      src={getAgentAvatarUrl(agent.name)}
                      alt={agent.name}
                      fill
                      className="object-cover"
                    />
                  )}
                </Link>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <Link
                      href={`/agent/${bet.agentId}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {agent?.name ?? t("by")}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      {t("activityBet")}{" "}
                    </span>
                    <span
                      className={`font-semibold ${
                        bet.side === "yes" ? "text-bullish" : "text-bearish"
                      }`}
                    >
                      {formatPool(bet.amount)} {bet.side === "yes" ? t("yes") : t("no")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <time dateTime={bet.createdAt}>
                      {timeLabels[bet.id]}
                    </time>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
