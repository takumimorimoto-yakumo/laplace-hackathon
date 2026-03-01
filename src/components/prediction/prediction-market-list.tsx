import { useTranslations } from "next-intl";
import type { PredictionMarket, Agent } from "@/lib/types";
import { BarChart3 } from "lucide-react";

interface PredictionMarketListProps {
  markets: PredictionMarket[];
  agents: Agent[];
}

function formatConditionShort(market: PredictionMarket): string {
  const { tokenSymbol, conditionType, threshold } = market;

  const deadlineDate = new Date(market.deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const durationLabel =
    diffDays <= 2 ? `${diffDays * 24}h` : `${diffDays}d`;

  switch (conditionType) {
    case "price_above":
      if (threshold >= 1_000_000) {
        const formatted =
          threshold >= 1_000_000_000
            ? `$${(threshold / 1_000_000_000).toFixed(0)}B`
            : `$${(threshold / 1_000_000).toFixed(0)}M`;
        return `${tokenSymbol} TVL > ${formatted} (${durationLabel})`;
      }
      return `${tokenSymbol} > $${threshold} (${durationLabel})`;
    case "price_below":
      return `${tokenSymbol} < $${threshold} (${durationLabel})`;
    case "change_percent":
      return `${tokenSymbol} ${threshold}% (${durationLabel})`;
  }
}

function formatTimeRemaining(deadline: string): string {
  const end = new Date(deadline);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Ended";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (diffDays > 0) return `${diffDays}d ${remainingHours}h`;
  return `${diffHours}h`;
}

function formatPool(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function PredictionMarketList({
  markets,
  agents,
}: PredictionMarketListProps) {
  const t = useTranslations("prediction");
  const agentsMap = new Map(agents.map((a) => [a.id, a]));

  if (markets.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {t("noMarkets")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        {t("activeMarkets")}
      </h2>
      {markets.map((market) => {
        const agent = agentsMap.get(market.proposerAgentId);
        const total = market.poolYes + market.poolNo;
        const yesPercent =
          total > 0 ? Math.round((market.poolYes / total) * 100) : 50;
        const noPercent = 100 - yesPercent;
        const remaining = formatTimeRemaining(market.deadline);

        return (
          <div
            key={market.marketId}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
          >
            {/* Condition + icon */}
            <div className="flex items-start gap-2">
              <BarChart3 className="size-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {formatConditionShort(market)}
                </p>
                {agent && (
                  <p className="text-xs text-muted-foreground">
                    {t("by")} {agent.name}
                  </p>
                )}
              </div>
            </div>

            {/* Yes/No bar */}
            <div className="space-y-1">
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-bullish transition-all"
                  style={{ width: `${yesPercent}%` }}
                />
                <div
                  className="bg-bearish transition-all"
                  style={{ width: `${noPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-bullish">
                  {t("yes")} {yesPercent}%
                </span>
                <span className="text-bearish">
                  {t("no")} {noPercent}%
                </span>
              </div>
            </div>

            {/* Pool + remaining */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatPool(total)} pool</span>
              <span>{remaining} {t("remaining")}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
