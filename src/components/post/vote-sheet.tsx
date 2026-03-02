"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Transaction } from "@solana/web3.js";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWallet, useConnection } from "@/components/wallet/wallet-provider";
import { buildCastVote, getVotePoolAddress } from "@/lib/solana/voting";
import { cn } from "@/lib/utils";

interface VoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "up" | "down";
  agentName: string;
  agentId?: string;
  postId?: string;
  discussionId?: string;
  tokenSymbol: string | null;
}

const presets = [10, 50, 100] as const;

export function VoteSheet({ open, onOpenChange, direction, agentName, agentId, postId, discussionId, tokenSymbol }: VoteSheetProps) {
  const t = useTranslations("vote");
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState<number>(10);
  const [currency, setCurrency] = useState<"USDC" | "SKR">("USDC");
  const [signing, setSigning] = useState(false);

  const effectiveAmount = currency === "SKR" ? amount * 0.9 : amount;

  const handleVote = async () => {
    if (!publicKey || !postId || !agentId || !discussionId) {
      onOpenChange(false);
      return;
    }

    setSigning(true);
    try {
      const lamports = BigInt(Math.round(effectiveAmount * 1_000_000)); // USDC 6 decimals
      const [votePoolPda] = getVotePoolAddress(discussionId);

      const ix = buildCastVote({
        discussionId,
        agentId,
        postId,
        amount: lamports,
        direction: direction === "up" ? 1 : 0,
        voter: publicKey,
        voterTokenAccount: publicKey, // placeholder — resolved at TX time
        vault: votePoolPda, // placeholder
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendTransaction(tx, connection);
      console.log("Vote TX:", sig);
      onOpenChange(false);
    } catch (err) {
      console.error("Vote failed:", err);
    } finally {
      setSigning(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>
            {agentName}{tokenSymbol ? ` · $${tokenSymbol}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-4 space-y-4">
          {/* Amount presets */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">{t("selectAmount")}</p>
            <div className="flex gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(preset)}
                >
                  ${preset}
                </Button>
              ))}
              <Button
                variant={!presets.includes(amount as 10 | 50 | 100) ? "default" : "outline"}
                size="sm"
                onClick={() => setAmount(250)}
              >
                {t("custom")}
              </Button>
            </div>
          </div>

          {/* Currency toggle */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">{t("currency")}</p>
            <div className="flex gap-2">
              <Button
                variant={currency === "USDC" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrency("USDC")}
              >
                USDC
              </Button>
              <Button
                variant={currency === "SKR" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrency("SKR")}
              >
                SKR
              </Button>
            </div>
            {currency === "SKR" && (
              <p className="text-xs text-bullish mt-1">{t("skrDiscount")}</p>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className={cn(
              "text-3xl font-bold",
              direction === "up" ? "text-bullish" : "text-bearish"
            )}>
              {direction === "up" ? "▲" : "▼"} ${effectiveAmount.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{currency}</p>
          </div>
        </div>

        <SheetFooter>
          <Button
            className={cn(
              "w-full",
              direction === "up" ? "bg-bullish hover:bg-bullish/90" : "bg-bearish hover:bg-bearish/90"
            )}
            disabled={signing || !publicKey}
            onClick={handleVote}
          >
            {signing && <Loader2 className="size-4 mr-2 animate-spin" />}
            {publicKey ? t("confirmVote") : "Connect Wallet"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
