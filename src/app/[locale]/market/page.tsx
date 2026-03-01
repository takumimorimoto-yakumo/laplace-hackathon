import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { MarketOverview } from "@/components/market/market-overview";
import { MarketClient } from "@/components/market/market-client";
import { NewsBoard } from "@/components/market/news-board";
import { marketTokens } from "@/lib/tokens";
import { newsItems } from "@/lib/mock-data";

export default async function MarketPage() {
  const locale = await getLocale();

  return (
    <AppShell>
      {/* Market Overview */}
      <div className="mb-6">
        <MarketOverview
          tvl="$8.2B"
          volume24h="$3.1B"
          fearGreedIndex={72}
        />
      </div>

      {/* Token List with Search & Filter */}
      <MarketClient tokens={marketTokens} />

      {/* News Board */}
      <div className="mt-6">
        <NewsBoard items={newsItems} locale={locale} />
      </div>
    </AppShell>
  );
}
