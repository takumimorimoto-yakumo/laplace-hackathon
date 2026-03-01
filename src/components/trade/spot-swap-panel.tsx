"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpotSwapPanelProps {
  tokenSymbol: string;
  currentPrice: number;
  className?: string;
}

export function SpotSwapPanel({ tokenSymbol, currentPrice, className }: SpotSwapPanelProps) {
  const t = useTranslations("trade");
  const [fromAmount, setFromAmount] = useState("");
  const [swapped, setSwapped] = useState(false);

  const fromToken = swapped ? tokenSymbol : "SOL";
  const toToken = swapped ? "SOL" : tokenSymbol;
  const rate = tokenSymbol === "SOL" ? 1 : currentPrice;
  const toAmount = fromAmount
    ? (swapped ? Number(fromAmount) * rate : Number(fromAmount) / rate).toFixed(4)
    : "";

  return (
    <div className={cn("space-y-3", className)}>
      {/* From */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground mb-1">{t("from")}</p>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {fromToken.slice(0, 2)}
          </div>
          <span className="text-sm font-medium text-foreground">{fromToken}</span>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.00"
            className="ml-auto w-28 bg-transparent text-right text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Swap arrow */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setSwapped((prev) => !prev)}
          className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowDownUp className="size-4" />
        </button>
      </div>

      {/* To */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground mb-1">{t("to")}</p>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {toToken.slice(0, 2)}
          </div>
          <span className="text-sm font-medium text-foreground">{toToken}</span>
          <span className="ml-auto text-sm font-mono text-muted-foreground">
            {toAmount || "0.00"}
          </span>
        </div>
      </div>

      {/* Rate & Slippage */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("rate")}: 1 {fromToken} = {(swapped ? 1 / rate : rate).toFixed(4)} {toToken}</span>
        <span>{t("slippage")}: 0.5%</span>
      </div>

      {/* Swap Button */}
      <Button className="w-full" disabled={!fromAmount || Number(fromAmount) <= 0}>
        {t("swap")}
      </Button>
    </div>
  );
}
