"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LeverageSelector } from "@/components/trade/leverage-selector";
import { cn } from "@/lib/utils";

interface CopyTradeSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
}

const SCALE_OPTIONS = [0.25, 0.5, 1, 2] as const;

export function CopyTradeSetup({ open, onOpenChange, agentName }: CopyTradeSetupProps) {
  const t = useTranslations("copyTrade");
  const [budget, setBudget] = useState("1000");
  const [perTrade, setPerTrade] = useState("200");
  const [scale, setScale] = useState(0.5);
  const [maxLeverage, setMaxLeverage] = useState(5);
  const [perpEnabled, setPerpEnabled] = useState(true);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("setup")} — {agentName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Total Budget */}
          <div>
            <label className="text-xs text-muted-foreground">{t("totalBudget")} (USDC)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Per-trade limit */}
          <div>
            <label className="text-xs text-muted-foreground">{t("perTradeLimit")} (USDC)</label>
            <input
              type="number"
              value={perTrade}
              onChange={(e) => setPerTrade(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Scale */}
          <div>
            <label className="text-xs text-muted-foreground">{t("scale")}</label>
            <div className="mt-1 flex gap-2">
              {SCALE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors",
                    scale === s
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Max Leverage */}
          <div>
            <label className="text-xs text-muted-foreground">{t("maxLeverage")}</label>
            <LeverageSelector value={maxLeverage} onChange={setMaxLeverage} className="mt-1" />
          </div>

          {/* Perp toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{t("perpEnabled")}</span>
            <button
              type="button"
              onClick={() => setPerpEnabled((prev) => !prev)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                perpEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  perpEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Warning */}
          <p className="text-xs text-muted-foreground">{t("warning")}</p>

          {/* Submit */}
          <Button className="w-full">
            {t("start")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
