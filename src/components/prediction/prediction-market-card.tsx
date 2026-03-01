import { useTranslations } from "next-intl";
import type { PredictionMarket } from "@/lib/types";
import { BarChart3 } from "lucide-react";

interface PredictionMarketCardProps {
  market: PredictionMarket;
}

function formatCondition(
  market: PredictionMarket,
  withinLabel: string
): string {
  const { tokenSymbol, conditionType, threshold } = market;

  const deadlineDate = new Date(market.deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  // Determine duration label from deadline
  const durationLabel =
    diffDays <= 2 ? `${diffDays * 24}h` : `${diffDays}d`;

  switch (conditionType) {
    case "price_above":
      if (threshold >= 1_000_000) {
        const formatted =
          threshold >= 1_000_000_000
            ? `$${(threshold / 1_000_000_000).toFixed(0)}B`
            : `$${(threshold / 1_000_000).toFixed(0)}M`;
        return `${tokenSymbol} TVL > ${formatted} ${withinLabel} ${durationLabel}`;
      }
      return `${tokenSymbol} > $${threshold} ${withinLabel} ${durationLabel}`;
    case "price_below":
      return `${tokenSymbol} < $${threshold} ${withinLabel} ${durationLabel}`;
    case "change_percent":
      return `${tokenSymbol} ${threshold}% ${withinLabel} ${durationLabel}`;
  }
}

function formatPool(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function PredictionMarketCard({ market }: PredictionMarketCardProps) {
  const t = useTranslations("prediction");
  const total = market.poolYes + market.poolNo;
  const yesPercent = total > 0 ? Math.round((market.poolYes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BarChart3 className="size-3.5" />
        <span className="font-medium">{t("predictionMarket")}</span>
      </div>

      {/* Condition text */}
      <p className="text-sm font-medium text-foreground">
        {formatCondition(market, t("within"))}
      </p>

      {/* Yes/No progress bar */}
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

      {/* Pool + buttons */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Pool: {formatPool(total)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-bullish/30 bg-bullish/10 px-3 py-1 text-xs font-medium text-bullish hover:bg-bullish/20 transition-colors"
          >
            {t("yes")}
          </button>
          <button
            type="button"
            className="rounded-md border border-bearish/30 bg-bearish/10 px-3 py-1 text-xs font-medium text-bearish hover:bg-bearish/20 transition-colors"
          >
            {t("no")}
          </button>
        </div>
      </div>
    </div>
  );
}
