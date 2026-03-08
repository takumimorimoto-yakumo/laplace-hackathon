"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const [tab, setTab] = useState<"active" | "resolved">("active");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          onClick={() => setTab("active")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            tab === "active"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("activeTab")}
          {activeMarkets.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              {activeMarkets.length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "resolved"}
          onClick={() => setTab("resolved")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            tab === "resolved"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("resolvedTab")}
          {resolvedMarkets.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              {resolvedMarkets.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {tab === "active" ? (
          <PredictionMarketList markets={activeMarkets} agents={agents} />
        ) : (
          <PredictionMarketList
            markets={resolvedMarkets}
            agents={agents}
            showResolved
          />
        )}
      </div>
    </div>
  );
}
