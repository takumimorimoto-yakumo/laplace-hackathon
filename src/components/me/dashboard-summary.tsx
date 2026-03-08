"use client";

import { useTranslations } from "next-intl";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Coins,
  Users,
  FlaskConical,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { StatsGrid } from "@/components/ui/stats-grid";
import { Link } from "@/i18n/navigation";
import type { OwnerDashboardSummary, OwnerPosition, OwnerTrade } from "@/lib/types";

interface DashboardSummaryProps {
  data: OwnerDashboardSummary | null;
  loading: boolean;
  positions?: OwnerPosition[];
  trades?: OwnerTrade[];
  tradesLoading?: boolean;
}

export function DashboardSummary({ data, loading, positions, trades, tradesLoading }: DashboardSummaryProps) {
  const t = useTranslations("me");

  if (loading || !data) return null;

  const returnSign = data.averageReturn >= 0 ? "+" : "";
  const returnPct = (data.averageReturn * 100).toFixed(1);
  const pnlSign = data.totalPnl >= 0 ? "+" : "";

  return (
    <div className="space-y-4 mb-4">
      {/* Virtual Trading badge */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <FlaskConical className="size-4 text-amber-400 shrink-0" />
        <div>
          <p className="text-xs font-medium text-amber-400">
            {t("virtualTrading")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("virtualTradingNote")}
          </p>
        </div>
      </div>

      {/* Summary grid */}
      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t("dashboard")}
        </h2>
        <StatsGrid
          columns={2}
          items={[
            {
              icon: <DollarSign className="size-4 text-primary" />,
              value: `$${data.totalPortfolioValue.toLocaleString()}`,
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
                  className={`size-4 ${data.totalPnl >= 0 ? "text-bullish" : "text-bearish"}`}
                />
              ),
              value: `${pnlSign}$${Math.abs(data.totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              label: t("totalPnl"),
            },
            {
              icon: <Users className="size-4 text-primary" />,
              value: String(data.activeRentersCount),
              label: t("activeRenters"),
            },
          ]}
        />
      </div>

      {/* Per-agent trading performance */}
      {data.agentBreakdown.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {t("tradingPerformance")}
          </h2>
          <div className="space-y-2.5">
            {data.agentBreakdown
              .sort((a, b) => b.portfolioReturn - a.portfolioReturn)
              .map((agent) => {
                const agentReturnPct = (agent.portfolioReturn * 100).toFixed(1);
                const isPositive = agent.portfolioReturn >= 0;
                return (
                  <Link
                    key={agent.agentId}
                    href={`/agent/${agent.agentId}`}
                    className="flex items-center justify-between py-1.5 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
                  >
                    <span className="text-sm text-foreground truncate flex-1 mr-2">
                      {agent.agentName}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">
                        ${agent.portfolioValue.toLocaleString()}
                      </span>
                      <span
                        className={`text-xs font-mono font-medium flex items-center gap-0.5 min-w-[60px] justify-end ${
                          isPositive ? "text-bullish" : "text-bearish"
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        {isPositive ? "+" : ""}
                        {agentReturnPct}%
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Open Positions */}
      {!tradesLoading && positions && positions.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {t("openPositionsAll")}
          </h2>
          <div className="space-y-2">
            {positions.map((pos, i) => {
              const isPositive = pos.currentReturn >= 0;
              return (
                <div
                  key={`${pos.agentId}-${pos.tokenSymbol}-${i}`}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {pos.direction === "long" ? (
                      <ArrowUpRight className="size-3.5 text-bullish shrink-0" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-bearish shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pos.tokenSymbol}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {pos.agentName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">
                      ${pos.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span
                      className={`text-xs font-mono font-medium min-w-[52px] text-right ${
                        isPositive ? "text-bullish" : "text-bearish"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {(pos.currentReturn * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {!tradesLoading && trades && trades.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {t("recentTradesAll")}
          </h2>
          <div className="space-y-2">
            {trades.map((trade, i) => {
              const isBuy = trade.action === "buy";
              const hasPnl = trade.pnl !== null && trade.pnl !== 0;
              return (
                <div
                  key={`${trade.agentId}-${trade.executedAt}-${i}`}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        isBuy
                          ? "bg-bullish/10 text-bullish"
                          : "bg-bearish/10 text-bearish"
                      }`}
                    >
                      {trade.action}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {trade.tokenSymbol}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {trade.agentName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">
                      ${trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    {hasPnl && (
                      <span
                        className={`text-xs font-mono font-medium ${
                          trade.pnl! >= 0 ? "text-bullish" : "text-bearish"
                        }`}
                      >
                        {trade.pnl! >= 0 ? "+" : ""}
                        ${trade.pnl!.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rental earnings summary (compact) */}
      {data.totalEarnings > 0 && (
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="size-4 text-yellow-500" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("totalEarnings")}
            </h2>
          </div>
          <p className="text-lg font-mono font-semibold text-foreground">
            ${data.totalEarnings.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
