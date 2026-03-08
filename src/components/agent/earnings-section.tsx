"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DollarSign, ArrowDownToLine, Loader2, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/wallet-provider";
import {
  useAgentEarningsSummary,
  useWithdrawEarnings,
} from "@/hooks/use-agent-earnings";
import { buildWithdrawalMessage } from "@/lib/solana/wallet-auth";

interface EarningsSectionProps {
  agentId: string;
  ownerWallet: string;
}

export function EarningsSection({ agentId, ownerWallet }: EarningsSectionProps) {
  const t = useTranslations("earnings");
  const { publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const { data: summary, loading, refetch } = useAgentEarningsSummary(agentId);
  const { mutate: withdraw, loading: withdrawing, error: withdrawError } =
    useWithdrawEarnings(agentId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");

  // Only show if wallet matches owner
  if (!walletAddress || walletAddress !== ownerWallet) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface/50 p-4 mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">{t("title")}</span>
        </div>
      </div>
    );
  }

  if (!summary || summary.earningsCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface/50 p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{t("title")}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("noEarnings")}</p>
      </div>
    );
  }

  const available = summary.availableBalance;

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0 || withdrawAmount > available) {
      return;
    }
    if (!destination || destination.length < 32) return;
    if (!signMessage) return;

    const nonce = String(Date.now());
    const message = buildWithdrawalMessage({
      agentId,
      amount: withdrawAmount,
      nonce,
    });

    try {
      const encoded = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encoded);
      const signatureBase64 = btoa(
        String.fromCharCode(...signatureBytes)
      );

      const success = await withdraw({
        amount: withdrawAmount,
        destinationWallet: destination,
        message,
        signature: signatureBase64,
      });

      if (success) {
        setSheetOpen(false);
        setAmount("");
        setDestination("");
        void refetch();
      }
    } catch {
      // Wallet signature rejected or error
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface/50 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{t("title")}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDestination(walletAddress);
            setSheetOpen(true);
          }}
          disabled={available <= 0}
        >
          <ArrowDownToLine className="size-3.5" />
          {t("withdraw")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted/50 p-2.5">
          <p className="text-[11px] text-muted-foreground mb-0.5">{t("available")}</p>
          <p className="text-sm font-semibold font-mono text-bullish">
            ${available.toFixed(2)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5">
          <p className="text-[11px] text-muted-foreground mb-0.5">{t("totalEarned")}</p>
          <p className="text-sm font-semibold font-mono text-foreground">
            ${summary.totalEarnings.toFixed(2)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5">
          <p className="text-[11px] text-muted-foreground mb-0.5">{t("withdrawn")}</p>
          <p className="text-sm font-mono text-muted-foreground">
            ${summary.totalWithdrawn.toFixed(2)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5">
          <p className="text-[11px] text-muted-foreground mb-0.5">{t("pending")}</p>
          <div className="flex items-center gap-1">
            {summary.pendingWithdrawals > 0 && (
              <Clock className="size-3 text-amber-500" />
            )}
            <p className="text-sm font-mono text-muted-foreground">
              ${summary.pendingWithdrawals.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Withdraw Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col max-h-[60vh]"
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>{t("withdrawTitle")}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 min-h-0">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("amount")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={available}
                  className="w-full rounded-md border border-border bg-muted pl-7 pr-16 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setAmount(available.toFixed(2))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary font-medium hover:underline"
                >
                  {t("withdrawMax")}
                </button>
              </div>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("destination")}
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="So1ana..."
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("destinationHint")}
              </p>
            </div>

            {withdrawError && (
              <p className="text-xs text-destructive">{withdrawError}</p>
            )}
          </div>

          <SheetFooter className="flex-shrink-0">
            <Button
              onClick={handleWithdraw}
              disabled={
                withdrawing ||
                !amount ||
                parseFloat(amount) <= 0 ||
                parseFloat(amount) > available ||
                !destination ||
                destination.length < 32
              }
              className="w-full"
            >
              {withdrawing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("processing")}
                </>
              ) : (
                t("confirmWithdraw")
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
