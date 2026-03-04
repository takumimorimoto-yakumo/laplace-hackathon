import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { MarketOverview } from "@/components/market/market-overview";
import { MarketClient } from "@/components/market/market-client";
import { NewsBoard } from "@/components/market/news-board";
import { seedTokens, generatePriceHistory48h } from "@/lib/tokens";
import { newsItems } from "@/lib/mock-data";
import {
  fetchSolanaEcosystemTokens,
  resolveSolanaAddress,
  fetchSolanaAddressForCoin,
} from "@/lib/data/coingecko";
import { fetchAllProtocolTVLs } from "@/lib/data/defillama";
import { fetchTokenSentiment, fetchAgents } from "@/lib/supabase/queries";
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

async function getMarketTokens(): Promise<MarketToken[]> {
  try {
    // 1. Fetch Solana ecosystem tokens from CoinGecko
    const ecosystemTokens = await fetchSolanaEcosystemTokens();
    if (ecosystemTokens.length === 0) return seedTokens;

    // 2. Fetch DeFi Llama TVLs + Supabase sentiment in parallel
    const [tvlMap, sentimentMap] = await Promise.all([
      fetchAllProtocolTVLs(),
      fetchTokenSentiment(),
    ]);

    // 3. Resolve Solana addresses
    const seedByAddress = new Map(seedTokens.map((t) => [t.address, t]));
    const seenAddresses = new Set<string>();
    const tokens: MarketToken[] = [];

    const unknownCoins = ecosystemTokens.filter((t) => !resolveSolanaAddress(t.coingeckoId));
    const resolvedExtra = new Map<string, { address: string; decimals: number }>();
    if (unknownCoins.length > 0) {
      const results = await Promise.all(
        unknownCoins.map(async (t) => {
          const result = await fetchSolanaAddressForCoin(t.coingeckoId);
          return { id: t.coingeckoId, result };
        })
      );
      for (const { id, result } of results) {
        if (result) resolvedExtra.set(id, result);
      }
    }

    for (const eco of ecosystemTokens) {
      const resolved = resolveSolanaAddress(eco.coingeckoId) ?? resolvedExtra.get(eco.coingeckoId);
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

    return tokens.length > 0 ? tokens : seedTokens;
  } catch (err) {
    console.error("getMarketTokens error:", err);
    return seedTokens;
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
  const tokens = await getMarketTokens();

  const allAgents = await fetchAgents();
  const agentsMap = new Map<string, Agent>(allAgents.map((a) => [a.id, a]));

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

      {/* Token List with Search & Filter */}
      <MarketClient tokens={tokens} />

      {/* News Board */}
      <div className="mt-6">
        <NewsBoard items={newsItems} locale={locale} agentsMap={agentsMap} />
      </div>
    </AppShell>
  );
}
