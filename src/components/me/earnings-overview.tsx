"use client";

import { useTranslations } from "next-intl";
import { DollarSign } from "lucide-react";
import type { OwnerDashboardSummary } from "@/lib/types";

interface EarningsOverviewProps {
  data: OwnerDashboardSummary | null;
  loading: boolean;
}

export function EarningsOverview({ data, loading }: EarningsOverviewProps) {
  const t = useTranslations("me");
  const tEarnings = useTranslations("earnings");

  if (loading || !data) return null;
  if (data.totalEarnings === 0 && data.agentBreakdown.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-4 mb-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        {t("earningsOverview")}
      </h2>

      {/* Summary stats */}
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

      {/* Per-agent breakdown */}
      {data.agentBreakdown.length > 0 && (
        <>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            {t("perAgentBreakdown")}
          </h3>
          <div className="space-y-2">
            {data.agentBreakdown
              .filter((a) => a.earnings > 0 || a.rentersCount > 0)
              .map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-foreground truncate flex-1">
                    {agent.agentName}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="size-3" />
                      {agent.earnings.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">
                      {agent.rentersCount} {t("renters")}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
