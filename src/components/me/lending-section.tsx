"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import type { LentAgent } from "@/lib/types";

interface LendingSectionProps {
  lentAgents: LentAgent[];
  loading: boolean;
}

export function LendingSection({ lentAgents, loading }: LendingSectionProps) {
  const t = useTranslations("me");

  if (loading) return null;

  return (
    <div className="rounded-lg border border-border p-4 mb-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        {t("lendingOut")}
      </h2>
      {lentAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noLending")}</p>
      ) : (
        <div className="space-y-3">
          {lentAgents.map((agent) => (
            <div
              key={agent.agentId}
              className="flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {agent.agentName}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="size-3" />
                  {agent.subscriberCount} {t("subscribers")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-medium text-bullish">
                  ${agent.monthlyRevenue.toFixed(2)}
                </p>
                {agent.nextExpiration && (
                  <p className="text-[10px] text-muted-foreground">
                    {t("nextExpiration")}: {new Date(agent.nextExpiration).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
