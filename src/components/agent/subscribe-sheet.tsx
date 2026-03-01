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
import type { AgentRentalPlan } from "@/lib/types";

interface SubscribeSheetProps {
  plan: AgentRentalPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscribeSheet({ plan, open, onOpenChange }: SubscribeSheetProps) {
  const t = useTranslations("rental");
  const [currency, setCurrency] = useState<"USDC" | "SKR">("USDC");

  if (!plan) return null;

  const price = currency === "SKR"
    ? plan.monthlyPriceUsdc * (1 - plan.skrDiscountPercent / 100)
    : plan.monthlyPriceUsdc;

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
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            {t("confirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
