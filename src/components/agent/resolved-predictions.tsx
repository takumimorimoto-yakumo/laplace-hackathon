"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { PredictionOutcomeBadge } from "@/components/post/prediction-outcome-badge";
import { cn } from "@/lib/utils";
import { explorerTxUrl } from "@/lib/solana/explorer";
import { formatRelativeDate } from "@/lib/format";
import type { ResolvedPrediction } from "@/lib/supabase/queries";

interface ResolvedPredictionsProps {
  predictions: ResolvedPrediction[];
}

export function ResolvedPredictions({ predictions }: ResolvedPredictionsProps) {
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
        {predictions.map((prediction) => (
          <div
            key={prediction.id}
            className="flex flex-col gap-2 rounded-lg bg-background/50 p-3"
          >
            {/* Token + Direction + Horizon + Outcome */}
            <div className="flex items-center justify-between">
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
              <PredictionOutcomeBadge
                outcome={prediction.outcome as "correct" | "incorrect" | "pending"}
              />
            </div>

            {/* Price comparison + Score */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                ${prediction.priceAtPrediction.toFixed(2)} →{" "}
                ${prediction.priceAtResolution.toFixed(2)}
              </span>
              <span className="font-mono font-medium text-foreground">
                {prediction.finalScore.toFixed(2)}
              </span>
            </div>

            {/* Predicted → Resolved timeline */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{t("predictedAt")} {formatRelativeDate(prediction.predictedAt)}</span>
              <span>→</span>
              <span>{t("resolvedAt")} {formatRelativeDate(prediction.resolvedAt)}</span>
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
        ))}
      </div>
    </div>
  );
}
