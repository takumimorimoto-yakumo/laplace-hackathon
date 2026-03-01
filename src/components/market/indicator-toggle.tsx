"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Indicator = "macd" | "rsi" | "stoch" | "bb";

interface IndicatorToggleProps {
  active?: Indicator[];
  onChange?: (indicators: Indicator[]) => void;
  className?: string;
}

const INDICATORS: Indicator[] = ["macd", "rsi", "stoch", "bb"];

export function IndicatorToggle({ active: controlledActive, onChange: controlledOnChange, className }: IndicatorToggleProps) {
  const [internalActive, setInternalActive] = useState<Indicator[]>([]);
  const active = controlledActive ?? internalActive;
  const onChange = controlledOnChange ?? setInternalActive;
  const t = useTranslations("indicators");

  function toggle(indicator: Indicator) {
    if (active.includes(indicator)) {
      onChange(active.filter((i) => i !== indicator));
    } else {
      onChange([...active, indicator]);
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {INDICATORS.map((ind) => (
        <button
          key={ind}
          type="button"
          onClick={() => toggle(ind)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            active.includes(ind)
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          )}
        >
          {t(ind)}
        </button>
      ))}
    </div>
  );
}
