"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, ArrowDownRight, Lock } from "lucide-react";
import { EntryPointChart } from "@/components/market/entry-point-chart";
import type { ExitPoint } from "@/components/market/entry-point-chart";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Position, Trade, MarketToken, EntryPoint } from "@/lib/types";

interface PositionListProps {
  positions: Position[];
  trades?: Trade[];
  agentId?: string;
  agentName?: string;
  tokenDataMap?: Record<string, MarketToken>;
  /** Show TP/SL/reasoning (only for rented or owner) */
  showStrategy?: boolean;
}

function formatAge(enteredAt: string): string {
  const entered = new Date(enteredAt);
  const now = new Date();
  const diffMs = now.getTime() - entered.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatReturn(ret: number): string {
  const sign = ret >= 0 ? "+" : "";
  return `${sign}${ret.toFixed(1)}%`;
}

export function PositionList({
  positions,
  trades,
  agentId,
  agentName,
  tokenDataMap,
  showStrategy,
}: PositionListProps) {
  const t = useTranslations("agent");
  const [now] = useState(() => Date.now());

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          {t("openPositions")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noOpenPositions")}</p>
      </div>
    );
  }

  // Build exit trades by token address for matching
  const exitsByToken = new Map<string, Trade[]>();
  if (trades) {
    for (const trade of trades) {
      if (trade.action === "sell") {
        const existing = exitsByToken.get(trade.tokenAddress) ?? [];
        existing.push(trade);
        exitsByToken.set(trade.tokenAddress, existing);
      }
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        {t("openPositions")}
      </h3>

      <div className="space-y-4">
        {positions.map((position, index) => {
          const isLong = position.direction === "long";
          const isPositiveReturn = position.currentReturn >= 0;
          const tokenData = tokenDataMap?.[position.tokenAddress];
          // Only include exits that occurred after this position was opened
          const enteredAtMs = new Date(position.enteredAt).getTime();
          const relatedExits = (exitsByToken.get(position.tokenAddress) ?? []).filter(
            (tr) => new Date(tr.executedAt).getTime() >= enteredAtMs
          );

          // Build entry point for chart
          const entryPoint: EntryPoint | null =
            agentId && agentName
              ? {
                  postId: `pos-${index}`,
                  agentId,
                  agentName,
                  direction: isLong ? "bullish" : "bearish",
                  confidence: 0.5,
                  priceAtPrediction: position.entryPrice,
                  createdAt: position.enteredAt,
                }
              : null;

          // Build exit points for chart
          const chartExitPoints: ExitPoint[] = relatedExits.map((tr, i) => ({
            id: `exit-${position.tokenSymbol}-${i}`,
            price: tr.price,
            exitedAt: tr.executedAt,
            pnl: tr.pnl,
          }));

          // Use sparkline7d for positions older than 48h to show full context
          const positionAgeHours =
            (now - new Date(position.enteredAt).getTime()) / 3600_000;
          const rawPriceData =
            positionAgeHours > 48 && tokenData?.sparkline7d && tokenData.sparkline7d.length > 0
              ? tokenData.sparkline7d
              : tokenData?.priceHistory48h ?? [];

          const currentPrice = tokenData?.price ?? null;

          // Append the live current price so the chart line extends to
          // the actual price shown in the stats row (sparkline data can lag)
          const chartPriceData =
            currentPrice != null && rawPriceData.length > 0
              ? [...rawPriceData, currentPrice]
              : rawPriceData;
          const hasStrategy =
            position.priceTarget !== null ||
            position.stopLoss !== null ||
            position.reasoning;

          return (
            <div
              key={`${position.tokenSymbol}-${position.direction}-${index}`}
              className="rounded-lg border border-border overflow-hidden"
            >
              {/* Header: token + direction + status */}
              <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/token/${position.tokenAddress}`}
                    className="font-mono text-sm font-bold text-primary hover:underline"
                  >
                    {position.tokenSymbol}
                  </Link>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-medium",
                      isLong ? "text-bullish" : "text-bearish"
                    )}
                  >
                    {isLong ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                    {isLong ? t("long") : t("short")}
                    {position.leverage > 1 && (
                      <span className="ml-0.5 text-muted-foreground">
                        {position.leverage}x
                      </span>
                    )}
                  </span>
                </div>
                {/* Holding badge */}
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                  {t("holding")}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 px-3 pb-2">
                <div>
                  <span className="text-[10px] text-muted-foreground">{t("entryAt")}</span>
                  <div className="text-xs font-mono text-foreground">
                    {formatPrice(position.entryPrice)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    {formatAge(position.enteredAt)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">{t("current")}</span>
                  <div className="text-xs font-mono text-foreground">
                    {currentPrice ? formatPrice(currentPrice) : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    ${position.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground">{t("return")}</span>
                  <div
                    className={cn(
                      "text-sm font-mono font-semibold",
                      isPositiveReturn ? "text-bullish" : "text-bearish"
                    )}
                  >
                    {formatReturn(position.currentReturn)}
                  </div>
                </div>
              </div>

              {/* TP / SL targets */}
              {showStrategy && hasStrategy ? (
                <div className="px-3 pb-2 space-y-1.5">
                  {(position.priceTarget !== null || position.stopLoss !== null) && (
                    <div className="flex items-center gap-3">
                      {position.priceTarget !== null && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-bullish">{t("takeProfit")}</span>
                          <span className="text-[10px] font-mono text-bullish">
                            {formatPrice(position.priceTarget)}
                          </span>
                        </div>
                      )}
                      {position.stopLoss !== null && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-bearish">{t("stopLoss")}</span>
                          <span className="text-[10px] font-mono text-bearish">
                            {formatPrice(position.stopLoss)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {position.reasoning && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                      {position.reasoning}
                    </p>
                  )}
                </div>
              ) : !showStrategy && hasStrategy ? (
                <div className="px-3 pb-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Lock className="size-3" />
                    <span>{t("strategy")}</span>
                  </div>
                </div>
              ) : null}

              {/* Chart */}
              {tokenData && entryPoint && chartPriceData.length > 0 ? (
                <div className="px-1 pb-1">
                  <EntryPointChart
                    priceData={chartPriceData}
                    entryPoints={[entryPoint]}
                    exitPoints={chartExitPoints}
                    variant="full"
                    heightOverride={120}
                    showEntryLabel
                    positionDirection={position.direction}
                    takeProfit={position.priceTarget}
                    stopLoss={position.stopLoss}
                  />
                </div>
              ) : (
                <div className="mx-3 mb-3 flex items-center justify-center h-12 rounded bg-muted/30">
                  <span className="text-[10px] text-muted-foreground">
                    {t("noChartData")}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
