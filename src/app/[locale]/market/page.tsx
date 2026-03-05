import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { MarketOverview } from "@/components/market/market-overview";
import { MarketPageContent } from "@/components/market/market-page-content";
import { seedTokens, generatePriceHistory48h } from "@/lib/tokens";
import { newsItems as mockNewsItems } from "@/lib/mock-data";
import {
  fetchSolanaEcosystemTokens,
  resolveSolanaAddress,
} from "@/lib/data/coingecko";
import type { SolanaEcosystemToken } from "@/lib/data/coingecko";
import { fetchAllProtocolTVLs } from "@/lib/data/defillama";
import { fetchTokenSentiment, fetchAgents, fetchNewsFromPosts } from "@/lib/supabase/queries";
import type { MarketToken, Agent } from "@/lib/types";
import { formatCompactNumber } from "@/lib/format";

/** Infer category tags from CoinGecko coin ID and symbol */
function inferTags(coingeckoId: string, symbol: string): string[] {
  const id = coingeckoId.toLowerCase();
  const sym = symbol.toLowerCase();

  if (["tether", "usd-coin", "dai", "usdd", "usd1-wlfi", "first-digital-usd", "paypal-usd"].includes(id) ||
      ["usdt", "usdc", "dai", "usdd", "usd1", "fdusd", "pyusd"].includes(sym)) {
    return ["stablecoin"];
  }
  if (id.includes("staked-sol") || id.includes("msol") || id.includes("marinade") || id.includes("jito-staked")) {
    return ["lst"];
  }
  if (["bonk", "dogwifcoin", "popcat", "cat-in-a-dogs-world", "fartcoin", "official-trump",
       "ai16z", "the-ai-prophecy", "pengu", "pudgy-penguins"].includes(id) ||
      ["bonk", "wif", "popcat", "mew", "fartcoin", "trump"].includes(sym)) {
    return ["meme"];
  }
  if (["solana", "pyth-network", "helium", "helium-mobile", "render-token",
       "wormhole", "grass", "nosana", "aethir"].includes(id)) {
    return ["infra"];
  }
  return ["defi"];
}

/** Build MarketToken[] from fetched data sources (pure, no async) */
function buildMarketTokens(
  ecosystemTokens: SolanaEcosystemToken[],
  tvlMap: Record<string, number>,
  sentimentMap: Map<string, { agentCount: number; bullishPercent: number }>,
): MarketToken[] {
  const seedByAddress = new Map(seedTokens.map((t) => [t.address, t]));
  const seenAddresses = new Set<string>();
  const tokens: MarketToken[] = [];

  for (const eco of ecosystemTokens) {
    const resolved = resolveSolanaAddress(eco.coingeckoId);
    if (!resolved) continue;

    if (seenAddresses.has(resolved.address)) continue;
    seenAddresses.add(resolved.address);

    const seed = seedByAddress.get(resolved.address);
    const sentiment = sentimentMap.get(resolved.address);
    const tvl = tvlMap[eco.symbol.toUpperCase()] ?? seed?.tvl ?? null;
    const price = eco.currentPrice;
    const change24h = eco.priceChangePercentage24h;

    const sparkline7d = eco.sparklineIn7d.length > 0
      ? eco.sparklineIn7d
      : seed?.sparkline7d ?? (price > 0 ? [price, price, price, price, price, price, price] : []);

    const priceHistory48h =
      eco.sparklineIn7d.length >= 48
        ? eco.sparklineIn7d.slice(-48)
        : eco.sparklineIn7d.length > 0
          ? eco.sparklineIn7d
          : price > 0
            ? generatePriceHistory48h(price, Math.abs(change24h) / 100 || 0.03)
            : seed?.priceHistory48h ?? [];

    tokens.push({
      address: resolved.address,
      symbol: eco.symbol.toUpperCase(),
      name: eco.name,
      logoURI: eco.image,
      decimals: resolved.decimals,
      price,
      change24h,
      tags: inferTags(eco.coingeckoId, eco.symbol),
      tvl,
      volume24h: eco.totalVolume,
      marketCap: eco.marketCap,
      agentCount: sentiment?.agentCount ?? 0,
      bullishPercent: sentiment?.bullishPercent ?? 50,
      sparkline7d,
      priceHistory48h,
    });
  }

  return tokens;
}

async function getMarketTokens(): Promise<{ tokens: MarketToken[]; allAgents: Agent[] }> {
  try {
    // Fetch all data sources in parallel
    const [ecosystemTokens, tvlMap, sentimentMap, allAgents] = await Promise.all([
      fetchSolanaEcosystemTokens(),
      fetchAllProtocolTVLs(),
      fetchTokenSentiment(),
      fetchAgents(),
    ]);

    if (ecosystemTokens.length === 0) {
      return { tokens: seedTokens, allAgents };
    }

    const tokens = buildMarketTokens(ecosystemTokens, tvlMap, sentimentMap);
    return { tokens: tokens.length > 0 ? tokens : seedTokens, allAgents };
  } catch (err) {
    console.error("getMarketTokens error:", err);
    return { tokens: seedTokens, allAgents: [] };
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
  const newsItems = dbNews.length > 0 ? dbNews : mockNewsItems;

  const totalVolume = tokens.reduce((sum, t) => sum + t.volume24h, 0);
  const totalTvl = tokens.reduce((sum, t) => sum + (t.tvl ?? 0), 0);
  const avgBullish = Math.round(
    tokens.reduce((sum, t) => sum + t.bullishPercent, 0) / tokens.length
  );

  return (
    <AppShell>
      {/* Market Overview */}
      <div className="mb-6">
        <MarketOverview
          tvl={`$${formatCompactNumber(totalTvl)}`}
          volume24h={`$${formatCompactNumber(totalVolume)}`}
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
