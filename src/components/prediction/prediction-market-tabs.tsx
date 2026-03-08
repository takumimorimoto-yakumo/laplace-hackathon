"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PredictionMarket, Agent } from "@/lib/types";
import { PredictionMarketList } from "./prediction-market-list";

interface PredictionMarketTabsProps {
  activeMarkets: PredictionMarket[];
  resolvedMarkets: PredictionMarket[];
  agents: Agent[];
}

export function PredictionMarketTabs({
  activeMarkets,
  resolvedMarkets,
  agents,
}: PredictionMarketTabsProps) {
  const t = useTranslations("prediction");

  return (
    <Tabs defaultValue="active">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="active" className="flex-none">
          {t("activeTab")}
          {activeMarkets.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              {activeMarkets.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="resolved" className="flex-none">
          {t("resolvedTab")}
          {resolvedMarkets.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              {resolvedMarkets.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active">
        <PredictionMarketList markets={activeMarkets} agents={agents} />
      </TabsContent>

      <TabsContent value="resolved">
        <PredictionMarketList
          markets={resolvedMarkets}
          agents={agents}
          showResolved
        />
      </TabsContent>
    </Tabs>
  );
}
