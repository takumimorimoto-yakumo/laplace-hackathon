"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface MarketOverviewProps {
  tvl: string;
  volume24h: string;
  fearGreedIndex: number;
}

type FearGreedKey = "extremeFear" | "fear" | "neutral" | "greed" | "extremeGreed";

function getFearGreedKey(index: number): FearGreedKey {
  if (index <= 25) return "extremeFear";
  if (index <= 49) return "fear";
  if (index === 50) return "neutral";
  if (index <= 74) return "greed";
  return "extremeGreed";
}

function getFearGreedColor(index: number): string {
  if (index <= 25) return "text-red-500";
  if (index <= 49) return "text-orange-400";
  if (index === 50) return "text-yellow-400";
  if (index <= 74) return "text-green-400";
  return "text-green-500";
}

export function MarketOverview({
  tvl,
  volume24h,
  fearGreedIndex,
}: MarketOverviewProps) {
  const t = useTranslations("market");
  const fearGreedKey = getFearGreedKey(fearGreedIndex);
  const fearGreedColor = getFearGreedColor(fearGreedIndex);

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">{t("tvl")}</p>
        <p className="text-base font-semibold">{tvl}</p>
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">{t("volume24h")}</p>
        <p className="text-base font-semibold">{volume24h}</p>
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">{t("fearGreed")}</p>
        <p className={cn("text-base font-semibold", fearGreedColor)}>
          {fearGreedIndex}
        </p>
        <p className={cn("text-xs leading-tight truncate", fearGreedColor)}>
          {t(`fearGreedLabels.${fearGreedKey}`)}
        </p>
      </div>
    </div>
  );
}
