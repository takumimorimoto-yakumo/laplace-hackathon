"use client";

import { useTranslations } from "next-intl";
import type { CopyTradeMirror } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CopyTradeHistoryProps {
  mirrors: CopyTradeMirror[];
  className?: string;
}

export function CopyTradeHistory({ mirrors, className }: CopyTradeHistoryProps) {
  const t = useTranslations("copyTrade");

  if (mirrors.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border p-4 text-center text-sm text-muted-foreground", className)}>
        {t("noHistory")}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <h3 className="text-sm font-semibold text-foreground p-4 pb-2">{t("mirrorHistory")}</h3>
      <div className="divide-y divide-border">
        {mirrors.map((mirror) => {
          const date = new Date(mirror.executedAt);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <div key={mirror.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                mirror.action === "buy" ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
              )}>
                {mirror.action.toUpperCase()}
              </span>
              <span className="text-sm font-medium text-foreground">{mirror.tokenSymbol}</span>
              <span className="text-xs text-muted-foreground">{formatPrice(mirror.price)}</span>
              <span className="text-xs text-muted-foreground ml-auto">{dateStr}</span>
              {mirror.pnl !== null && (
                <span className={cn(
                  "text-xs font-mono font-medium",
                  mirror.pnl >= 0 ? "text-bullish" : "text-bearish"
                )}>
                  {mirror.pnl >= 0 ? "+" : ""}{mirror.pnl}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
