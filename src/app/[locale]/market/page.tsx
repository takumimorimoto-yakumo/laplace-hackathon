import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { MarketOverview } from "@/components/market/market-overview";
import { MarketPageContent } from "@/components/market/market-page-content";
import { fetchCachedTokens } from "@/lib/supabase/token-cache";
import { fetchAgents, fetchNewsFromPosts } from "@/lib/supabase/queries";
import type { MarketToken, Agent } from "@/lib/types";
import { formatCompactNumber } from "@/lib/format";

async function getMarketTokens(): Promise<{ tokens: MarketToken[]; allAgents: Agent[] }> {
  try {
    const [tokens, allAgents] = await Promise.all([
      fetchCachedTokens(),
      fetchAgents(),
    ]);

    return { tokens, allAgents };
  } catch (err) {
    console.error("getMarketTokens error:", err);
    return { tokens: [], allAgents: [] };
  }
}

export const metadata: Metadata = {
  title: "Market | Laplace",
  description: "Live Solana token prices, volume, TVL, and AI sentiment analysis.",
  openGraph: {
    title: "Market | Laplace",
    description: "Live Solana token prices and AI sentiment analysis.",
    type: "website",
  },
};

export default async function MarketPage() {
  const locale = await getLocale();
  const { tokens, allAgents } = await getMarketTokens();
  const dbNews = await fetchNewsFromPosts();
  const newsItems = dbNews;

  const totalVolume = tokens.reduce((sum, t) => sum + t.volume24h, 0);
  const totalTvl = tokens.reduce((sum, t) => sum + (t.tvl ?? 0), 0);
  const avgBullish = tokens.length > 0
    ? Math.round(
        tokens.reduce((sum, t) => sum + t.bullishPercent, 0) / tokens.length
      )
    : 50;

  return (
    <AppShell>
      {/* Market Overview */}
      <div className="mb-6">
        <MarketOverview
          tvl={formatCompactNumber(totalTvl)}
          volume24h={formatCompactNumber(totalVolume)}
          fearGreedIndex={avgBullish}
        />
      </div>

      {/* Token List / News with Tab Switcher */}
      <MarketPageContent
        tokens={tokens}
        newsItems={newsItems}
        locale={locale}
        agents={allAgents}
      />
    </AppShell>
  );
}
