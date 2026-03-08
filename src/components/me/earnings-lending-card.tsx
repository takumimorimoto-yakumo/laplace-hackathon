"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import type { OwnerDashboardSummary, LentAgent } from "@/lib/types";

interface EarningsLendingCardProps {
  data: OwnerDashboardSummary | null;
  lentAgents: LentAgent[];
  loading: boolean;
  lentLoading: boolean;
}

export function EarningsLendingCard({
  data,
  lentAgents,
  loading,
  lentLoading,
}: EarningsLendingCardProps) {
  const t = useTranslations("me");
  const tEarnings = useTranslations("earnings");

  if (loading || !data) return null;
  if (data.totalEarnings === 0 && lentAgents.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        {t("earningsAndLending")}
      </h2>

      {/* Earnings summary grid */}
      {data.totalEarnings > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: tEarnings("available"), value: `$${data.availableBalance.toFixed(2)}`, highlight: true },
            { label: tEarnings("totalEarned"), value: `$${data.totalEarnings.toFixed(2)}`, highlight: false },
            { label: tEarnings("withdrawn"), value: `$${data.totalWithdrawn.toFixed(2)}`, highlight: false },
            { label: tEarnings("pending"), value: `$${data.pendingWithdrawals.toFixed(2)}`, highlight: false },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className={`text-sm font-mono font-semibold ${item.highlight ? "text-bullish" : "text-foreground"}`}>
                {item.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lending agents list */}
      {!lentLoading && lentAgents.length > 0 && (
        <div className={data.totalEarnings > 0 ? "border-t border-border pt-3" : ""}>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            {t("lendingOut")}
          </h3>
          <div className="space-y-2.5">
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
        </div>
      )}

      {!lentLoading && lentAgents.length === 0 && data.totalEarnings === 0 && (
        <p className="text-sm text-muted-foreground">{t("noLending")}</p>
      )}
    </div>
  );
}
