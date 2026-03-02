"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { VersionedTransaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { useWallet, useConnection } from "@/components/wallet/wallet-provider";
import { getQuote, getSwapTransaction } from "@/lib/jupiter/client";
import type { JupiterQuote } from "@/lib/jupiter/client";
import { getTokenBySymbol } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface SpotSwapPanelProps {
  tokenSymbol: string;
  tokenAddress?: string;
  currentPrice: number;
  className?: string;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;

export function SpotSwapPanel({ tokenSymbol, tokenAddress, currentPrice, className }: SpotSwapPanelProps) {
  const t = useTranslations("trade");
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [fromAmount, setFromAmount] = useState("");
  const [swapped, setSwapped] = useState(false);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const token = getTokenBySymbol(tokenSymbol);
  const tokenMint = tokenAddress ?? token?.address ?? "";

  const fromToken = swapped ? tokenSymbol : "SOL";
  const toToken = swapped ? "SOL" : tokenSymbol;
  const inputMint = swapped ? tokenMint : SOL_MINT;
  const outputMint = swapped ? SOL_MINT : tokenMint;

  const rate = tokenSymbol === "SOL" ? 1 : currentPrice;

  // Fetch Jupiter quote when amount changes
  const fetchQuote = useCallback(async () => {
    const amountNum = Number(fromAmount);
    if (!fromAmount || amountNum <= 0 || !tokenMint) {
      setQuote(null);
      return;
    }

    setLoading(true);
    // Convert to lamports/smallest unit
    const lamports = Math.round(amountNum * LAMPORTS_PER_SOL);
    const result = await getQuote({
      inputMint,
      outputMint,
      amount: lamports,
    });
    setQuote(result);
    setLoading(false);
  }, [fromAmount, inputMint, outputMint, tokenMint]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const toAmount = quote
    ? (Number(quote.outAmount) / LAMPORTS_PER_SOL).toFixed(4)
    : fromAmount
      ? (swapped ? Number(fromAmount) * rate : Number(fromAmount) / rate).toFixed(4)
      : "";

  const handleSwap = async () => {
    if (!publicKey || !quote) return;

    setSwapping(true);
    try {
      const swapResult = await getSwapTransaction({
        quoteResponse: quote,
        userPublicKey: publicKey.toBase58(),
      });

      if (!swapResult) {
        console.error("Failed to get swap transaction");
        return;
      }

      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      const signature = await sendTransaction(transaction, connection);
      console.log("Swap TX:", signature);
    } catch (err) {
      console.error("Swap failed:", err);
    } finally {
      setSwapping(false);
    }
  };

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
          onClick={() => {
            setSwapped((prev) => !prev);
            setQuote(null);
          }}
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
            {loading ? "..." : toAmount || "0.00"}
          </span>
        </div>
      </div>

      {/* Rate & Slippage */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("rate")}: 1 {fromToken} = {(swapped ? 1 / rate : rate).toFixed(4)} {toToken}
        </span>
        <span>
          {quote ? `Impact: ${quote.priceImpactPct}%` : `${t("slippage")}: 0.5%`}
        </span>
      </div>

      {/* Swap Button */}
      <Button
        className="w-full"
        disabled={!fromAmount || Number(fromAmount) <= 0 || swapping || !publicKey}
        onClick={handleSwap}
      >
        {swapping && <Loader2 className="size-4 mr-2 animate-spin" />}
        {publicKey ? t("swap") : t("from")}
      </Button>
    </div>
  );
}
