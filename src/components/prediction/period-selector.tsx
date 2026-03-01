"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly";

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  const t = useTranslations("period");

  return (
    <div className={cn("flex gap-2", className)}>
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => onChange(period)}
          className={cn(
            "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            value === period
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/50"
          )}
        >
          {t(period)}
        </button>
      ))}
    </div>
  );
}
