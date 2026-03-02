"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LeverageSelector } from "./leverage-selector";
import { useWallet } from "@/components/wallet/wallet-provider";
import { getPerpMarketIndex, fetchOrderbook } from "@/lib/drift/client";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

interface PerpTradePanelProps {
  tokenSymbol: string;
  currentPrice: number;
  className?: string;
}

export function PerpTradePanel({ tokenSymbol, currentPrice, className }: PerpTradePanelProps) {
  const t = useTranslations("trade");
  const { publicKey } = useWallet();

  const [direction, setDirection] = useState<"long" | "short">("long");
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [fundingRate, setFundingRate] = useState<number | null>(null);

  const marketIndex = getPerpMarketIndex(tokenSymbol);

  useEffect(() => {
    if (marketIndex === undefined) return;

    fetchOrderbook(marketIndex).then((book) => {
      if (book) {
        // Use best bid/ask spread as proxy for funding display
        const bestBid = book.bids[0] ? Number(book.bids[0].price) : 0;
        const bestAsk = book.asks[0] ? Number(book.asks[0].price) : 0;
        if (bestBid && bestAsk) {
          setFundingRate(((bestAsk - bestBid) / bestBid) * 100);
        }
      }
    });
  }, [marketIndex]);

  const marginNum = Number(margin) || 0;
  const notional = marginNum * leverage;
  const liquidationPct = direction === "long" ? -1 / leverage : 1 / leverage;
  const liquidationPrice = currentPrice * (1 + liquidationPct * 0.8);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Token + Price */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{tokenSymbol}-PERP</span>
        <div className="text-right">
          <span className="text-sm font-mono text-foreground">{formatPrice(currentPrice)}</span>
          {fundingRate !== null && (
            <span className="ml-2 text-xs text-muted-foreground">
              Funding: {fundingRate.toFixed(4)}%
            </span>
          )}
        </div>
      </div>

      {/* Long / Short */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection("long")}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            direction === "long"
              ? "border-bullish bg-bullish/10 text-bullish"
              : "border-border text-muted-foreground hover:border-bullish/50"
          )}
        >
          {t("long")}
        </button>
        <button
          type="button"
          onClick={() => setDirection("short")}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            direction === "short"
              ? "border-bearish bg-bearish/10 text-bearish"
              : "border-border text-muted-foreground hover:border-bearish/50"
          )}
        >
          {t("short")}
        </button>
      </div>

      {/* Margin input */}
      <div>
        <label className="text-xs text-muted-foreground">{t("margin")} (USDC)</label>
        <input
          type="number"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {/* Leverage */}
      <div>
        <label className="text-xs text-muted-foreground">{t("leverage")}</label>
        <LeverageSelector value={leverage} onChange={setLeverage} className="mt-1" />
      </div>

      {/* Summary */}
      <div className="space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("notionalValue")}</span>
          <span className="font-mono text-foreground">${notional.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("liquidationPrice")}</span>
          <span className="font-mono text-foreground">
            {marginNum > 0 ? `${formatPrice(liquidationPrice)} (${(liquidationPct * 80).toFixed(0)}%)` : "\u2014"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("fee")}</span>
          <span className="font-mono text-foreground">${(notional * 0.0001).toFixed(2)}</span>
        </div>
      </div>

      {/* Submit */}
      <Button
        className={cn(
          "w-full",
          direction === "long"
            ? "bg-bullish hover:bg-bullish/90 text-white"
            : "bg-bearish hover:bg-bearish/90 text-white"
        )}
        disabled={marginNum <= 0 || !publicKey}
      >
        {direction === "long" ? t("openLong") : t("openShort")}
      </Button>
    </div>
  );
}
