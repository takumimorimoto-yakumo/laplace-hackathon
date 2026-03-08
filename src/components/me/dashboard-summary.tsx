"use client";

import { useTranslations } from "next-intl";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { StatsGrid } from "@/components/ui/stats-grid";
import { AgentCommandCard } from "@/components/me/agent-command-card";
import { EarningsLendingCard } from "@/components/me/earnings-lending-card";
import type { RegisteredAgent } from "@/hooks/use-user-registered-agents";
import type { OwnerDashboardSummary, OwnerPosition, OwnerTrade, LentAgent } from "@/lib/types";

interface DashboardSummaryProps {
  dashboardData: OwnerDashboardSummary | null;
  registeredAgents: RegisteredAgent[];
  positions: OwnerPosition[];
  trades: OwnerTrade[];
  lentAgents: LentAgent[];
  loading: boolean;
  tradesLoading: boolean;
  lentLoading: boolean;
  walletAddress: string;
  onAgentUpdated: () => void;
}

export function DashboardSummary({
  dashboardData,
  registeredAgents,
  positions,
  trades,
  lentAgents,
  loading,
  tradesLoading,
  lentLoading,
  walletAddress,
  onAgentUpdated,
}: DashboardSummaryProps) {
  const t = useTranslations("me");

  if (loading || !dashboardData) return null;

  const returnSign = dashboardData.averageReturn >= 0 ? "+" : "";
  const returnPct = (dashboardData.averageReturn * 100).toFixed(1);
  const totalPnl = dashboardData.totalPnl + dashboardData.livePnl;
  const hasLive = dashboardData.livePortfolioValue > 0;

  return (
    <div className="space-y-4 mb-4">
      {/* Section 1: Portfolio Overview */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("portfolioOverview")}
          </h2>
          {hasLive && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {t("liveActive")}
            </span>
          )}
        </div>
        <StatsGrid
          columns={2}
          items={[
            {
              icon: <DollarSign className="size-4 text-primary" />,
              value: `$${(dashboardData.totalPortfolioValue + dashboardData.livePortfolioValue).toLocaleString()}`,
              label: t("totalPortfolioValue"),
            },
            {
              icon: <TrendingUp className="size-4 text-bullish" />,
              value: `${returnSign}${returnPct}%`,
              label: t("averageReturn"),
            },
            {
              icon: (
                <DollarSign
                  className={`size-4 ${totalPnl >= 0 ? "text-bullish" : "text-bearish"}`}
                />
              ),
              value: `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              label: t("totalPnl"),
            },
            {
              icon: <Users className="size-4 text-primary" />,
              value: String(dashboardData.activeRentersCount),
              label: t("activeRenters"),
            },
          ]}
        />
      </div>

      {/* Section 2: Agent Command Cards */}
      {registeredAgents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2">
            {t("yourAgents")}
          </h2>
          {registeredAgents.map((agent) => {
            const breakdown = dashboardData.agentBreakdown.find(
              (ab) => ab.agentId === agent.id
            );
            const agentPositions = tradesLoading
              ? []
              : positions.filter((p) => p.agentId === agent.id);
            const agentTrades = tradesLoading
              ? []
              : trades.filter((tr) => tr.agentId === agent.id).slice(0, 3);

            return (
              <AgentCommandCard
                key={agent.id}
                agent={agent}
                breakdown={breakdown}
                positions={agentPositions}
                trades={agentTrades}
                walletAddress={walletAddress}
                onAgentUpdated={onAgentUpdated}
              />
            );
          })}
        </div>
      )}

      {/* Section 3: Earnings & Lending */}
      <EarningsLendingCard
        data={dashboardData}
        lentAgents={lentAgents}
        loading={loading}
        lentLoading={lentLoading}
      />
    </div>
  );
}
