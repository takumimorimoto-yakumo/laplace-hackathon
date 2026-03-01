"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Target } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Agent, ContestEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PositionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
  entry: ContestEntry;
  betType: "single" | "topThree";
}

const STAKE_PRESETS = [10, 50, 100, 500];

export function PositionSheet({
  open,
  onOpenChange,
  agent,
  entry,
  betType,
}: PositionSheetProps) {
  const t = useTranslations("position");
  const tPrediction = useTranslations("prediction");
  const [stake, setStake] = useState(50);
  const [customStake, setCustomStake] = useState("");
  const [currency, setCurrency] = useState<"usdc" | "skr">("usdc");

  const probability = betType === "single"
    ? entry.firstPlaceProbability
    : entry.topThreeProbability;

  const effectiveStake = customStake ? Number(customStake) : stake;
  const discount = currency === "skr" ? 0.9 : 1;
  const cost = effectiveStake * discount;
  const expectedReturn = probability > 0
    ? Math.round((effectiveStake / (probability / 100)) * 0.95)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {betType === "single" ? t("singleBet") : t("topThreeBet")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Agent info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <Target className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{agent.name}</p>
              <p className="text-xs text-muted-foreground">
                {t("currentReturn")}: {entry.currentReturn >= 0 ? "+" : ""}{entry.currentReturn.toFixed(1)}%
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {tPrediction("probability")}: {probability}%
            </Badge>
          </div>

          {/* Stake presets */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("stakeAmount")}</p>
            <div className="grid grid-cols-4 gap-2">
              {STAKE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setStake(preset); setCustomStake(""); }}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm font-medium transition-colors",
                    stake === preset && !customStake
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={customStake}
              onChange={(e) => setCustomStake(e.target.value)}
              placeholder="Custom amount"
              className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          {/* Currency toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrency("usdc")}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                currency === "usdc"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              USDC
            </button>
            <button
              type="button"
              onClick={() => setCurrency("skr")}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                currency === "skr"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              SKR (10% off)
            </button>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-mono text-foreground">{cost.toFixed(0)} {currency.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("expectedReturn")}</span>
              <span className="font-mono text-bullish">{expectedReturn.toLocaleString()} USDC</span>
            </div>
          </div>

          {/* Submit */}
          <Button className="w-full" disabled={effectiveStake <= 0}>
            {t("takePosition")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
