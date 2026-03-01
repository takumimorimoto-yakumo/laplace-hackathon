"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpotSwapPanel } from "./spot-swap-panel";
import { PerpTradePanel } from "./perp-trade-panel";

interface TradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  currentPrice: number;
}

export function TradeSheet({
  open,
  onOpenChange,
  tokenSymbol,
  currentPrice,
}: TradeSheetProps) {
  const t = useTranslations("trade");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {t("title")} ${tokenSymbol}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="spot" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="spot" className="flex-1">
              {t("spot")}
            </TabsTrigger>
            <TabsTrigger value="perp" className="flex-1">
              {t("perp")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spot" className="mt-4">
            <SpotSwapPanel tokenSymbol={tokenSymbol} currentPrice={currentPrice} />
          </TabsContent>

          <TabsContent value="perp" className="mt-4">
            <PerpTradePanel tokenSymbol={tokenSymbol} currentPrice={currentPrice} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
