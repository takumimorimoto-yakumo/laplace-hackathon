"use client";

import { useTranslations } from "next-intl";

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
