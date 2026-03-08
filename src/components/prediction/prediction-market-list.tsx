"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { PredictionMarket, Agent } from "@/lib/types";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Percent,
  Wallet,
  ArrowUpDown,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MarketBar } from "@/components/prediction/market-bar";
import { CountdownTimer } from "@/components/prediction/countdown-timer";
import {
  formatPool,
  formatConditionShort,
  getTimeRemainingParts,
} from "@/lib/format";
import { getAgentAvatarUrl } from "@/lib/avatar";

interface PredictionMarketListProps {
  markets: PredictionMarket[];
  agents: Agent[];
  showResolved?: boolean;
}

type SortMode = "deadline" | "pool";

const INITIAL_DISPLAY_COUNT = 10;

function getConditionIcon(conditionType: string) {
  switch (conditionType) {
    case "price_above":
      return TrendingUp;
    case "price_below":
      return TrendingDown;
    case "change_percent":
      return Percent;
    default:
      return BarChart3;
  }
}

function getDurationLabel(deadline: string): string {
  const diffMs = new Date(deadline).getTime() - Date.now();
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return diffDays <= 2 ? `${diffDays * 24}h` : `${diffDays}d`;
}

export function PredictionMarketList({
  markets,
  agents,
  showResolved = false,
}: PredictionMarketListProps) {
  const t = useTranslations("prediction");
  const agentsMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents]
  );

  const [sortMode, setSortMode] = useState<SortMode>("deadline");
  const [tokenFilter, setTokenFilter] = useState<string>("all");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Unique tokens for filter chips
  const uniqueTokens = useMemo(() => {
    const tokens = new Set(markets.map((m) => m.tokenSymbol));
    return Array.from(tokens).sort();
  }, [markets]);

  // Filter and sort
  const filteredMarkets = useMemo(() => {
    let result =
      tokenFilter === "all"
        ? markets
        : markets.filter((m) => m.tokenSymbol === tokenFilter);

    if (sortMode === "pool") {
      result = [...result].sort(
        (a, b) => b.poolYes + b.poolNo - (a.poolYes + a.poolNo)
      );
    }
    // "deadline" is already the server default sort order

    return result;
  }, [markets, tokenFilter, sortMode]);

  const visibleMarkets = filteredMarkets.slice(0, displayCount);
  const hasMore = displayCount < filteredMarkets.length;

  if (markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <BarChart3 className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          {showResolved ? t("noResolvedMarkets") : t("noMarkets")}
        </p>
        {!showResolved && (
          <p className="text-xs text-muted-foreground max-w-[240px]">
            {t("noMarketsHint")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters & sort */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground shrink-0">
          {showResolved ? t("resolvedMarkets") : t("activeMarkets")}
        </h2>
        <button
          type="button"
          onClick={() =>
            setSortMode((s) => (s === "deadline" ? "pool" : "deadline"))
          }
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          aria-label={`Sort by ${sortMode === "deadline" ? "pool size" : "deadline"}`}
        >
          <ArrowUpDown className="size-3" />
          {sortMode === "deadline" ? t("sortDeadline") : t("sortPool")}
        </button>
      </div>

      {/* Token filter chips */}
      {uniqueTokens.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTokenFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              tokenFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("allTokens")}
          </button>
          {uniqueTokens.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => setTokenFilter(token)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                tokenFilter === token
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      )}

      {/* Market cards */}
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {visibleMarkets.map((market) => {
          const agent = agentsMap.get(market.proposerAgentId);
          const total = market.poolYes + market.poolNo;
          const yesPercent =
            total > 0 ? Math.round((market.poolYes / total) * 100) : 50;
          const timeParts = getTimeRemainingParts(market.deadline);
          const isEnded = timeParts.ended;
          const isUrgent =
            !isEnded && timeParts.days === 0 && timeParts.hours < 6;
          const Icon = getConditionIcon(market.conditionType);
          const conditionText = formatConditionShort(
            market.tokenSymbol,
            market.conditionType,
            market.threshold,
            getDurationLabel(market.deadline)
          );

          return (
            <Link
              key={market.marketId}
              href={`/prediction/${market.marketId}`}
              aria-label={conditionText}
              className={`block rounded-lg border bg-card p-3 space-y-2 transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm ${
                isEnded
                  ? "opacity-60 border-border"
                  : isUrgent
                    ? "border-amber-500/30"
                    : "border-border"
              }`}
            >
              {/* Condition + icon + avatar */}
              <div className="flex items-start gap-2">
                <Icon
                  className={`size-4 mt-0.5 shrink-0 ${
                    market.conditionType === "price_above"
                      ? "text-bullish"
                      : market.conditionType === "price_below"
                        ? "text-bearish"
                        : "text-primary"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {conditionText}
                  </p>
                  {agent && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAgentAvatarUrl(agent.name)}
                        alt={agent.name}
                        width={16}
                        height={16}
                        className="size-4 rounded-full"
                      />
                      <span className="truncate">
                        {t("proposedBy", { agent: agent.name })}
                      </span>
                      {agent.walletAddress && (
                        <span className="inline-flex items-center gap-0.5 font-mono shrink-0">
                          <Wallet className="size-2.5" />
                          {agent.walletAddress.slice(0, 4)}...
                          {agent.walletAddress.slice(-4)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Resolved outcome badge */}
                {showResolved && market.isResolved && market.outcome && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      market.outcome === "yes"
                        ? "bg-bullish/20 text-bullish"
                        : "bg-bearish/20 text-bearish"
                    }`}
                  >
                    {market.outcome === "yes"
                      ? t("outcomeYes")
                      : t("outcomeNo")}
                  </span>
                )}
              </div>

              {/* Yes/No bar */}
              <MarketBar yesPercent={yesPercent} size="sm" />

              {/* Pool + remaining */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatPool(total)} {t("poolLabel")}
                </span>
                {showResolved ? (
                  <span>{t("ended")}</span>
                ) : (
                  <CountdownTimer
                    deadline={market.deadline}
                    className="text-xs"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() =>
              setDisplayCount((c) => c + INITIAL_DISPLAY_COUNT)
            }
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
