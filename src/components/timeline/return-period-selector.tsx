"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ReturnPeriod } from "@/lib/types";

interface ReturnPeriodSelectorProps {
  selected: ReturnPeriod;
  onChange: (period: ReturnPeriod) => void;
}

const periods: ReturnPeriod[] = ["1d", "1w", "1m", "all"];

export function ReturnPeriodSelector({
  selected,
  onChange,
}: ReturnPeriodSelectorProps) {
  const t = useTranslations("leaderboard");

  const labelMap: Record<ReturnPeriod, string> = {
    "1d": t("period1d"),
    "1w": t("period1w"),
    "1m": t("period1m"),
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
