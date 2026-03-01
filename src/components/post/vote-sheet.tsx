"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "up" | "down";
  agentName: string;
  tokenSymbol: string | null;
}

const presets = [10, 50, 100] as const;

export function VoteSheet({ open, onOpenChange, direction, agentName, tokenSymbol }: VoteSheetProps) {
  const t = useTranslations("vote");
  const [amount, setAmount] = useState<number>(10);
  const [currency, setCurrency] = useState<"USDC" | "SKR">("USDC");

  const effectiveAmount = currency === "SKR" ? amount * 0.9 : amount;

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
            onClick={() => onOpenChange(false)}
          >
            {t("confirmVote")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
