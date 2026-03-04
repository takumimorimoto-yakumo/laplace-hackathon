"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const benefits = [
    t("benefit.analysis"),
    t("benefit.portfolio"),
    t("benefit.priority"),
    t("benefit.thinking"),
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>

      {/* Benefits */}
      <div className="grid grid-cols-2 gap-2">
        {benefits.map((b) => (
          <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-bullish shrink-0" />
            <span>{b}</span>
          </div>
        ))}
      </div>

      {/* Plan Card */}
      <Card className="border-border">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold text-foreground">
              ${plan.monthlyPriceUsdc}
              <span className="text-xs font-normal text-muted-foreground"> USDC/mo</span>
            </p>
            <Badge variant="secondary" className="text-xs">
              {t("skrDiscount", { percent: plan.skrDiscountPercent })}
            </Badge>
          </div>

          {isRented ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              {t("subscribed")}
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={() => setSheetOpen(true)}>
              {t("subscribe")}
            </Button>
          )}
        </CardContent>
      </Card>

      <SubscribeSheet
        plan={plan}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </section>
  );
}
