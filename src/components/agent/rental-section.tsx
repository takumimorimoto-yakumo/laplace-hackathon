"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AgentRentalPlan } from "@/lib/types";
import { SubscribeSheet } from "./subscribe-sheet";

interface RentalSectionProps {
  plan: AgentRentalPlan;
  isRented: boolean;
}

export function RentalSection({ plan, isRented }: RentalSectionProps) {
  const t = useTranslations("rental");
  const tCommon = useTranslations("common");
  const [sheetOpen, setSheetOpen] = useState(false);

  const benefits = [
    t("benefit.analysis"),
    t("benefit.portfolio"),
    t("benefit.priority"),
    t("benefit.thinking"),
  ];

  return (
    <section className="rounded-lg border border-border p-4">
      {/* Header row: price + button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-foreground">
            ${plan.monthlyPriceUsdc}
          </span>
          <span className="text-xs text-muted-foreground">
            USDC{tCommon("perMonth")}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {t("skrDiscount", { percent: plan.skrDiscountPercent })}
          </Badge>
        </div>
        {isRented ? (
          <Button variant="outline" size="sm" disabled>
            {t("subscribed")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            {t("subscribe")}
          </Button>
        )}
      </div>

      {/* Benefits — subtle list */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {benefits.map((b) => (
          <div key={b} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3 text-bullish shrink-0" />
            <span>{b}</span>
          </div>
        ))}
      </div>

      <SubscribeSheet
        plan={plan}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </section>
  );
}
