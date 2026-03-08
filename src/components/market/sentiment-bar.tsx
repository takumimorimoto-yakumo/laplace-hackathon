"use client";

import { useTranslations } from "next-intl";
import type { TimeHorizon, HorizonSentiment } from "@/lib/types";

interface SentimentBarProps {
  bullishPercent: number;
}

export function SentimentBar({ bullishPercent }: SentimentBarProps) {
  const t = useTranslations("token");
  const bearishPercent = 100 - bullishPercent;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-bullish transition-all"
          style={{ width: `${bullishPercent}%` }}
        />
        <div
          className="bg-bearish transition-all"
          style={{ width: `${bearishPercent}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-bullish">
          {t("bullishPercent", { percent: bullishPercent })}
        </span>
        <span className="text-xs text-bearish">
          {t("bearishPercent", { percent: bearishPercent })}
        </span>
      </div>
    </div>
  );
}

// ---------- Timeframe Sentiment Bar ----------

const horizonKeys: { key: TimeHorizon; labelKey: "horizonShort" | "horizonMid" | "horizonLong" }[] = [
  { key: "short", labelKey: "horizonShort" },
  { key: "mid", labelKey: "horizonMid" },
  { key: "long", labelKey: "horizonLong" },
];

interface TimeframeSentimentBarProps {
  sentimentByHorizon: Record<TimeHorizon, HorizonSentiment>;
  bullishPercent: number;
}

export function TimeframeSentimentBar({
  sentimentByHorizon,
  bullishPercent,
}: TimeframeSentimentBarProps) {
  const t = useTranslations("token");

  const hasAnyData = horizonKeys.some(
    ({ key }) => sentimentByHorizon[key].count > 0
  );

  // Fallback to overall SentimentBar if no horizon data
  if (!hasAnyData) {
    return <SentimentBar bullishPercent={bullishPercent} />;
  }

  const visibleHorizons = horizonKeys.filter(
    ({ key }) => sentimentByHorizon[key].count > 0
  );

  return (
    <div className="flex flex-col gap-2">
      {visibleHorizons.map(({ key, labelKey }) => {
        const { bullishPercent: bp, count } = sentimentByHorizon[key];
        const bearish = 100 - bp;

        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
              {t(labelKey)}
            </span>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-bullish transition-all"
                style={{ width: `${bp}%` }}
              />
              <div
                className="bg-bearish transition-all"
                style={{ width: `${bearish}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {bp}%
              <span className="ml-1 text-[10px] opacity-60">({count})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
