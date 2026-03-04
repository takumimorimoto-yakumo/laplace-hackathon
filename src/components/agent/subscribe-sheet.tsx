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
import { buildSubscribe } from "@/lib/solana/rental";
import { sendWithToast } from "@/hooks/use-tx-toast";
import type { AgentRentalPlan } from "@/lib/types";

interface SubscribeSheetProps {
  plan: AgentRentalPlan | null;
  agentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscribeSheet({ plan, agentId, open, onOpenChange }: SubscribeSheetProps) {
  const t = useTranslations("rental");
  const tCommon = useTranslations("common");
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [currency, setCurrency] = useState<"USDC" | "SKR">("USDC");
  const [signing, setSigning] = useState(false);

  if (!plan) return null;

  const price = currency === "SKR"
    ? plan.monthlyPriceUsdc * (1 - plan.skrDiscountPercent / 100)
    : plan.monthlyPriceUsdc;

  const handleSubscribe = async () => {
    if (!publicKey || !agentId) {
      onOpenChange(false);
      return;
    }

    setSigning(true);
    try {
      const lamports = BigInt(Math.round(price * 1_000_000));
      const ix = buildSubscribe({
        agentId,
        paymentAmount: lamports,
        subscriber: publicKey,
        subscriberTokenAccount: publicKey, // placeholder
        vault: publicKey, // placeholder
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendWithToast({
        sendTransaction,
        transaction: tx,
        connection,
        labels: {
          loading: tCommon("txPending"),
          success: tCommon("txSuccess"),
          error: tCommon("txError"),
        },
      });
      if (sig) onOpenChange(false);
    } finally {
      setSigning(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("selectCurrency")}</SheetTitle>
          <SheetDescription>{t("title")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">{t("payWith")}</p>
          <div className="flex gap-3">
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
              SKR ({plan.skrDiscountPercent}% off)
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-3xl font-bold text-foreground">
              ${price.toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground"> {currency}/mo</span>
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            disabled={signing || !publicKey}
            onClick={handleSubscribe}
          >
            {signing && <Loader2 className="size-4 mr-2 animate-spin" />}
            {publicKey ? t("confirm") : "Connect Wallet"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
