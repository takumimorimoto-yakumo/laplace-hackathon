"use client";

import { useTranslations } from "next-intl";
import { formatCompactNumber } from "@/lib/format";
import { StatsGrid } from "@/components/ui/stats-grid";
import { cn } from "@/lib/utils";

interface TokenStatsProps {
  tvl: number | null;
  volume24h: number;
  marketCap?: number | null;
  className?: string;
}

export function TokenStats({ tvl, volume24h, marketCap, className }: TokenStatsProps) {
  const t = useTranslations("tokenStats");

  return (
    <StatsGrid
      items={[
        { value: tvl ? formatCompactNumber(tvl) : "—", label: t("tvl") },
        { value: formatCompactNumber(volume24h), label: t("volume24h") },
        { value: marketCap ? formatCompactNumber(marketCap) : "—", label: t("marketCap") },
      ]}
      className={cn("[&>div>p:first-of-type]:text-sm", className)}
    />
  );
}
