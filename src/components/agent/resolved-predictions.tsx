"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { PredictionOutcomeBadge } from "@/components/post/prediction-outcome-badge";
import { cn } from "@/lib/utils";
import { explorerTxUrl } from "@/lib/solana/explorer";
import { formatPriceChange, formatAbsoluteDate, formatPrice, getScoreLabel } from "@/lib/format";
import type { ResolvedPrediction } from "@/lib/supabase/queries";

interface ResolvedPredictionsProps {
  predictions: ResolvedPrediction[];
  locale: string;
}

export function ResolvedPredictions({ predictions, locale }: ResolvedPredictionsProps) {
  const t = useTranslations("resolvedPredictions");
  const tToken = useTranslations("token");

  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noResults")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {t("title")}
      </h3>

      <div className="space-y-3">
        {predictions.map((prediction) => {
          const isCorrect = prediction.outcome === "correct";
          const priceChange = formatPriceChange(
            prediction.priceAtPrediction,
            prediction.priceAtResolution
          );
          const scoreNormalized = prediction.finalScore / 100;
          const scoreKey = getScoreLabel(scoreNormalized);
          const scoreBarWidth = `${Math.round(scoreNormalized * 100)}%`;

          // Score bar color based on score quality
          let scoreBarColor = "bg-bearish"; // poor
          if (scoreNormalized >= 0.8) scoreBarColor = "bg-bullish"; // excellent
          else if (scoreNormalized >= 0.6) scoreBarColor = "bg-primary"; // good
          else if (scoreNormalized >= 0.4) scoreBarColor = "bg-amber-500"; // average

          return (
            <div
              key={prediction.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border-l-[3px] bg-background/50 p-3",
                isCorrect ? "border-l-bullish" : "border-l-bearish"
              )}
            >
              {/* Row 1: Outcome badge + Price change % */}
              <div className="flex items-center justify-between">
                <PredictionOutcomeBadge
                  outcome={prediction.outcome as "correct" | "incorrect" | "pending"}
                />
                <span
                  className={cn(
                    "text-sm font-bold",
                    priceChange.isPositive ? "text-bullish" : "text-bearish"
                  )}
                >
                  {priceChange.text}
                </span>
              </div>

              {/* Row 2: Token symbol + Direction + Time horizon */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {prediction.tokenSymbol}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    prediction.direction === "bullish"
                      ? "bg-bullish/15 text-bullish"
                      : "bg-bearish/15 text-bearish"
                  )}
                >
                  {tToken(prediction.direction as "bullish" | "bearish" | "neutral")}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t(`horizon_${prediction.timeHorizon}` as Parameters<typeof t>[0])}
                </span>
              </div>

              {/* Row 3: Price display */}
              <div className="text-xs text-muted-foreground">
                {formatPrice(prediction.priceAtPrediction)} → {formatPrice(prediction.priceAtResolution)}
              </div>

              {/* Row 4: Score visual bar */}
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", scoreBarColor)}
                    style={{ width: scoreBarWidth }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {t(`score_${scoreKey}` as Parameters<typeof t>[0])} ({scoreNormalized.toFixed(2)})
                </span>
              </div>

              {/* Row 5: Absolute dates */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatAbsoluteDate(prediction.predictedAt, locale)}</span>
                <span>→</span>
                <span>{formatAbsoluteDate(prediction.resolvedAt, locale)}</span>
              </div>

              {/* Solana verification link */}
              {prediction.txSignature && (
                <a
                  href={explorerTxUrl(prediction.txSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {t("verifiedOnSolana")}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
