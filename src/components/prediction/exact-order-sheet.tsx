"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWallet, useConnection } from "@/components/wallet/wallet-provider";
import { buildPlacePosition } from "@/lib/solana/market";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExactOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  contestId?: string;
}

export function ExactOrderSheet({
  open,
  onOpenChange,
  agents,
  contestId,
}: ExactOrderSheetProps) {
  const t = useTranslations("position");
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [signing, setSigning] = useState(false);
  const [stake, setStake] = useState("");

  const stakeNum = Number(stake) || 0;
  const allSelected = first && second && third;
  const noDuplicates = new Set([first, second, third]).size === 3;
  const valid = allSelected && noDuplicates && stakeNum > 0;

  const expectedReturn = valid ? Math.round(stakeNum * 20) : 0;

  const sortedAgents = [...agents].sort((a, b) => a.rank - b.rank);

  function renderSelect(
    label: string,
    value: string,
    onChange: (v: string) => void,
    excludeIds: string[]
  ) {
    return (
      <div>
        <label className="text-xs text-muted-foreground">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">---</option>
          {sortedAgents
            .filter((a) => !excludeIds.includes(a.id) || a.id === value)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (#{a.rank})
              </option>
            ))}
        </select>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Exact Order Prediction</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* 1st / 2nd / 3rd selects */}
          {renderSelect("1st Place", first, setFirst, [second, third])}
          {renderSelect("2nd Place", second, setSecond, [first, third])}
          {renderSelect("3rd Place", third, setThird, [first, second])}

          {!noDuplicates && allSelected && (
            <p className="text-xs text-bearish">Each position must be a different agent.</p>
          )}

          {/* Stake */}
          <div>
            <label className="text-xs text-muted-foreground">{t("stakeAmount")} (USDC)</label>
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("expectedReturn")}</span>
              <span className={cn("font-mono", valid ? "text-bullish" : "text-muted-foreground")}>
                {valid ? `${expectedReturn.toLocaleString()} USDC` : "---"}
              </span>
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            disabled={!valid || signing || !publicKey}
            onClick={async () => {
              if (!publicKey || !contestId || !valid) return;
              setSigning(true);
              try {
                const pad = (id: string) => new PublicKey(id.padEnd(32, "0").slice(0, 32));
                const ix = buildPlacePosition({
                  contestId,
                  positionType: 4, // exact_order
                  agentSelections: [pad(first), pad(second), pad(third)],
                  amount: BigInt(Math.round(stakeNum * 1_000_000)),
                  predictor: publicKey,
                  predictorTokenAccount: publicKey,
                  vault: publicKey,
                });
                const tx = new Transaction().add(ix);
                tx.feePayer = publicKey;
                tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                const sig = await sendTransaction(tx, connection);
                console.log("Exact order TX:", sig);
                onOpenChange(false);
              } catch (err) {
                console.error("Exact order bet failed:", err);
              } finally {
                setSigning(false);
              }
            }}
          >
            {signing && <Loader2 className="size-4 mr-2 animate-spin" />}
            {publicKey ? t("takePosition") : "Connect Wallet"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
