"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { MarketClient } from "@/components/market/market-client";
import { NewsBoard } from "@/components/market/news-board";
import { cn } from "@/lib/utils";
import type { MarketToken, NewsItem, Agent } from "@/lib/types";

type Tab = "tokens" | "news";

interface MarketPageContentProps {
  tokens: MarketToken[];
  newsItems: NewsItem[];
  locale: string;
  agents: Agent[];
}

export function MarketPageContent({
  tokens,
  newsItems,
  locale,
  agents,
}: MarketPageContentProps) {
  const t = useTranslations("market");
  const [activeTab, setActiveTab] = useState<Tab>("tokens");
  const agentsMap = useMemo(
    () => new Map<string, Agent>(agents.map((a) => [a.id, a])),
    [agents]
  );

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 mb-4">
        {(["tokens", "news"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "tokens" ? (
        <MarketClient tokens={tokens} />
      ) : (
        <NewsBoard items={newsItems} locale={locale} agentsMap={agentsMap} />
      )}
    </div>
  );
}
