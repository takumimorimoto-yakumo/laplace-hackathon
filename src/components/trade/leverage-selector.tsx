"use client";

import { cn } from "@/lib/utils";

const LEVERAGE_OPTIONS = [1, 3, 5, 10] as const;

interface LeverageSelectorProps {
  value: number;
  onChange: (leverage: number) => void;
  className?: string;
}

export function LeverageSelector({ value, onChange, className }: LeverageSelectorProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {LEVERAGE_OPTIONS.map((lev) => (
        <button
          key={lev}
          type="button"
          onClick={() => onChange(lev)}
          className={cn(
            "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            value === lev
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/50"
          )}
        >
          {lev}x
        </button>
      ))}
    </div>
  );
}
