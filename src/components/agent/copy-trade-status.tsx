"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CopyTradeConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CopyTradeStatusProps {
  config: CopyTradeConfig;
  spent: number;
  totalPnl: number;
  className?: string;
}

export function CopyTradeStatus({ config, spent, totalPnl, className }: CopyTradeStatusProps) {
  const t = useTranslations("copyTrade");

  const remaining = config.totalBudget - spent;

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <Badge variant={config.isActive ? "default" : "secondary"}>
          {config.isActive ? t("active") : t("inactive")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("remainingBudget")}</p>
          <p className="text-sm font-mono font-semibold text-foreground mt-0.5">
            {remaining.toLocaleString()} / {config.totalBudget.toLocaleString()} USDC
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">PnL</p>
          <p className={cn(
            "text-sm font-mono font-semibold mt-0.5",
            totalPnl >= 0 ? "text-bullish" : "text-bearish"
          )}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(0)} USDC
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(100, (remaining / config.totalBudget) * 100))}%` }}
        />
      </div>
    </div>
  );
}
