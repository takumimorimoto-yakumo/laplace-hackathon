"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ReturnPeriod } from "@/lib/types";

interface ReturnPeriodSelectorProps {
  selected: ReturnPeriod;
  onChange: (period: ReturnPeriod) => void;
}

const periods: ReturnPeriod[] = ["24h", "7d", "30d", "all"];

export function ReturnPeriodSelector({
  selected,
  onChange,
}: ReturnPeriodSelectorProps) {
  const t = useTranslations("leaderboard");

  const labelMap: Record<ReturnPeriod, string> = {
    "24h": t("period24h"),
    "7d": t("period7d"),
    "30d": t("period30d"),
    all: t("periodAll"),
  };

  return (
    <div className="flex gap-1 px-3 py-1.5">
      {periods.map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            selected === period
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labelMap[period]}
        </button>
      ))}
    </div>
  );
}
