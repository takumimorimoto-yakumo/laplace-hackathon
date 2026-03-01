"use client";

import { useTranslations } from "next-intl";
import { formatCompactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TokenStatsProps {
  tvl: number | null;
  volume24h: number;
  marketCap?: number | null;
  className?: string;
}

export function TokenStats({ tvl, volume24h, marketCap, className }: TokenStatsProps) {
  const t = useTranslations("tokenStats");

  const stats = [
    { label: t("tvl"), value: tvl ? formatCompactNumber(tvl) : "—" },
    { label: t("volume24h"), value: formatCompactNumber(volume24h) },
    { label: t("marketCap"), value: marketCap ? formatCompactNumber(marketCap) : "—" },
  ];

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-sm font-semibold font-mono text-foreground mt-1">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
