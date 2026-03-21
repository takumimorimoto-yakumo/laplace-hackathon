"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AreaChart } from "@/components/ui/area-chart";
import { Sparkline } from "@/components/market/sparkline";
import { EarningsLendingCard } from "@/components/me/earnings-lending-card";
import { Link } from "@/i18n/navigation";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { formatRelativeDate } from "@/lib/format";
import { explorerTxUrl } from "@/lib/solana/explorer";
import { cn } from "@/lib/utils";
import type { RegisteredAgent } from "@/hooks/use-user-registered-agents";
import type {
  OwnerDashboardSummary,
  OwnerPosition,
  OwnerTrade,
  LentAgent,
  PortfolioSnapshot,
} from "@/lib/types";

type ReturnPeriod = "24h" | "7d" | "30d" | "total";

interface DashboardSummaryProps {
  dashboardData: OwnerDashboardSummary | null;
  registeredAgents: RegisteredAgent[];
  positions: OwnerPosition[];
  trades: OwnerTrade[];
  lentAgents: LentAgent[];
  snapshots: PortfolioSnapshot[];
  loading: boolean;
  tradesLoading: boolean;
  lentLoading: boolean;
}

export function DashboardSummary({
  dashboardData,
  registeredAgents,
  positions,
  trades,
  lentAgents,
  snapshots,
  loading,
  tradesLoading,
  lentLoading,
}: DashboardSummaryProps) {
  const t = useTranslations("me");

  const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod>("total");
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [showAllClosed, setShowAllClosed] = useState(false);

  if (loading || !dashboardData) return null;

  const periodReturnMap: Record<ReturnPeriod, number> = {
    "24h": dashboardData.averageReturn24h,
    "7d": dashboardData.averageReturn7d,
    "30d": dashboardData.averageReturn30d,
    total: dashboardData.averageReturn,
  };
  const selectedReturn = periodReturnMap[returnPeriod];
  const returnSign = selectedReturn >= 0 ? "+" : "";
  const returnPct = (selectedReturn * 100).toFixed(1);
  const totalPnl = dashboardData.totalPnl + dashboardData.livePnl;
  const totalValue =
    dashboardData.totalPortfolioValue + dashboardData.livePortfolioValue;

  const periods: { key: ReturnPeriod; label: string }[] = [
    { key: "24h", label: "24H" },
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "total", label: t("total") },
  ];

  // Chart data
  const chartValues = snapshots.map((s) => s.value);
  const isChartPositive =
    chartValues.length >= 2
      ? chartValues[chartValues.length - 1] >= chartValues[0]
      : true;

  // Positions: show max 3 unless expanded
  const visiblePositions = showAllPositions
    ? positions
    : positions.slice(0, 3);

  // Closed positions: sell trades with PnL (TP/SL/expired/manual)
  const closedPositions = trades.filter(
    (tr) => tr.action === "sell" && tr.pnl !== null
  );
  const visibleClosed = showAllClosed
    ? closedPositions
    : closedPositions.slice(0, 5);

  // Recent trades (buy entries only, to avoid duplication with closed section)
  const recentBuyTrades = trades.filter((tr) => tr.action === "buy").slice(0, 5);

  // Sort agents by return for the mini list
  const sortedAgents = [...registeredAgents].sort(
    (a, b) => b.portfolioReturn - a.portfolioReturn
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Section 1: Portfolio Trend Chart */}
      {chartValues.length >= 2 ? (
        <AreaChart
          values={chartValues}
          title={t("totalPortfolioValue")}
          valueLabel={`$${totalValue.toLocaleString()}`}
          valueLabelClass={isChartPositive ? "text-bullish" : "text-bearish"}
          strokeColor={isChartPositive ? "#22c55e" : "#ef4444"}
          fillColor={
            isChartPositive
              ? "rgba(34,197,94,0.1)"
              : "rgba(239,68,68,0.1)"
          }
          height={160}
        />
      ) : (
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("totalPortfolioValue")}
            </h3>
            <span className="text-sm font-mono font-medium text-foreground">
              ${totalValue.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground py-6 text-center">
            {t("chartNoData")}
          </p>
        </div>
      )}

      {/* Section 2: KPI Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Return with period selector */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-1.5 mb-1">
            {selectedReturn >= 0 ? (
              <TrendingUp className="size-4 text-bullish" />
            ) : (
              <TrendingDown className="size-4 text-bearish" />
            )}
            <span
              className={cn(
                "text-lg font-mono font-semibold",
                selectedReturn >= 0 ? "text-bullish" : "text-bearish"
              )}
            >
              {returnSign}{returnPct}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setReturnPeriod(p.key)}
                className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors",
                  returnPeriod === p.key
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Total PnL */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={cn(
                "text-lg font-mono font-semibold",
                totalPnl >= 0 ? "text-bullish" : "text-bearish"
              )}
            >
              {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("totalPnl")}</p>
        </div>
      </div>

      {/* Section 3: Open Positions */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("openPositionsAll")}
            {!tradesLoading && positions.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                ({positions.length})
              </span>
            )}
          </h3>
        </div>
        {tradesLoading ? (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground">
              {t("noPositionsAll")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visiblePositions.map((pos, i) => {
              const isPositive = pos.currentReturn >= 0;
              return (
                <div
                  key={`${pos.agentId}-${pos.tokenSymbol}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {pos.direction === "long" ? (
                      <ArrowUpRight className="size-3.5 text-bullish shrink-0" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-bearish shrink-0" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {pos.tokenSymbol}
                    </span>
                    {pos.isLive && (
                      <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        LIVE
                      </span>
                    )}
                    {pos.isLive && pos.txSignature && (
                      <a
                        href={explorerTxUrl(pos.txSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        <Zap className="size-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground/70">
                      {pos.agentName?.split(" ")[0]}
                    </span>
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "text-sm font-mono font-medium",
                          isPositive ? "text-bullish" : "text-bearish"
                        )}
                      >
                        {isPositive ? "+" : ""}
                        {pos.currentReturn.toFixed(1)}%
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono",
                          isPositive
                            ? "text-bullish/70"
                            : "text-bearish/70"
                        )}
                      >
                        {isPositive ? "+" : ""}
                        ${Math.abs(pos.unrealizedPnl) < 0.01
                          ? "0.00"
                          : pos.unrealizedPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {positions.length > 3 && !showAllPositions && (
              <button
                onClick={() => setShowAllPositions(true)}
                className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                +{positions.length - 3} {t("more")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Closed Positions (TP/SL/expired/manual) */}
      {!tradesLoading && closedPositions.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("closedPositions")}
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                ({closedPositions.length})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {visibleClosed.map((trade, i) => {
              const isProfit = (trade.pnl ?? 0) >= 0;
              const reasonLabel = trade.closeReason
                ? t(`closeReason.${trade.closeReason}`)
                : null;
              return (
                <div
                  key={`closed-${trade.agentId}-${trade.executedAt}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {trade.tokenSymbol}
                    </span>
                    {reasonLabel && (
                      <span
                        className={cn(
                          "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded",
                          trade.closeReason === "tp"
                            ? "bg-bullish/10 text-bullish"
                            : trade.closeReason === "sl"
                              ? "bg-bearish/10 text-bearish"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {reasonLabel}
                      </span>
                    )}
                    {trade.isLive && (
                      <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground/70">
                      {trade.agentName?.split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatRelativeDate(trade.executedAt)}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-mono font-medium min-w-[56px] text-right",
                        isProfit ? "text-bullish" : "text-bearish"
                      )}
                    >
                      {isProfit ? "+" : ""}${trade.pnl!.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
            {closedPositions.length > 5 && !showAllClosed && (
              <button
                onClick={() => setShowAllClosed(true)}
                className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                +{closedPositions.length - 5} {t("more")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Section 4b: Recent Entries */}
      {!tradesLoading && recentBuyTrades.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("recentEntries")}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {recentBuyTrades.map((trade, i) => (
              <div
                key={`entry-${trade.agentId}-${trade.executedAt}-${i}`}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-bullish/10 text-bullish">
                    {trade.action}
                  </span>
                  <span className="text-sm text-foreground truncate">
                    {trade.tokenSymbol}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-muted-foreground/70">
                    {trade.agentName?.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatRelativeDate(trade.executedAt)}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    ${trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Agent Summary Mini-List */}
      {sortedAgents.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("yourAgents")}
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                ({sortedAgents.length})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {sortedAgents.map((agent) => {
              const isPositiveReturn = agent.portfolioReturn >= 0;
              const returnStr = `${isPositiveReturn ? "+" : ""}${(agent.portfolioReturn * 100).toFixed(1)}%`;
              return (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <Avatar size="sm">
                    <AvatarImage
                      src={getAgentAvatarUrl(agent.name)}
                      alt={agent.name}
                    />
                    <AvatarFallback>
                      <Bot className="size-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {agent.name}
                      </span>
                      {agent.isPaused ? (
                        <span className="size-1.5 rounded-full bg-amber-500" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-bullish" />
                      )}
                    </div>
                  </div>
                  <Sparkline
                    data={[
                      10000,
                      10000 * (1 + agent.portfolioReturn * 0.3),
                      10000 * (1 + agent.portfolioReturn * 0.5),
                      10000 * (1 + agent.portfolioReturn * 0.7),
                      10000 * (1 + agent.portfolioReturn),
                    ]}
                    width={48}
                    height={20}
                    positive={isPositiveReturn}
                  />
                  <span
                    className={cn(
                      "text-xs font-mono font-medium min-w-[48px] text-right",
                      isPositiveReturn ? "text-bullish" : "text-bearish"
                    )}
                  >
                    {returnStr}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 6: Earnings (conditional) */}
      <EarningsLendingCard
        data={dashboardData}
        lentAgents={lentAgents}
        loading={loading}
        lentLoading={lentLoading}
      />
    </div>
  );
}
