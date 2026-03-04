import { NextResponse } from "next/server";

import {
  fetchSolanaEcosystemTokens,
  resolveSolanaAddress,
  fetchSolanaAddressForCoin,
} from "@/lib/data/coingecko";
import { fetchAllProtocolTVLs } from "@/lib/data/defillama";
import { fetchVerifiedTokens, fetchTokenPrices } from "@/lib/data/jupiter-tokens";
import { fetchTokenSentiment } from "@/lib/supabase/queries";
import { seedTokens, generatePriceHistory48h } from "@/lib/tokens";
import type { MarketToken } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Infer category tags from CoinGecko coin ID and symbol */
function inferTags(coingeckoId: string, symbol: string): string[] {
  const id = coingeckoId.toLowerCase();
  const sym = symbol.toLowerCase();

  // Stablecoins
  if (["tether", "usd-coin", "dai", "usdd", "usd1-wlfi", "first-digital-usd", "paypal-usd"].includes(id) ||
      ["usdt", "usdc", "dai", "usdd", "usd1", "fdusd", "pyusd"].includes(sym)) {
    return ["stablecoin"];
  }

  // LST (liquid staking tokens)
  if (id.includes("staked-sol") || id.includes("msol") || id.includes("marinade") || id.includes("jito-staked")) {
    return ["lst"];
  }

  // Meme coins
  if (["bonk", "dogwifcoin", "popcat", "cat-in-a-dogs-world", "fartcoin", "official-trump",
       "ai16z", "the-ai-prophecy", "pengu"].includes(id) ||
      ["bonk", "wif", "popcat", "mew", "fartcoin", "trump"].includes(sym)) {
    return ["meme"];
  }

  // Infrastructure
  if (["solana", "pyth-network", "helium", "helium-mobile", "render-token",
       "wormhole", "grass", "nosana", "aethir"].includes(id)) {
    return ["infra"];
  }

  // Default to DeFi
  return ["defi"];
}

export async function GET(): Promise<NextResponse> {
  try {
    // 1. Fetch Solana ecosystem tokens from CoinGecko (up to 200)
    const ecosystemTokens = await fetchSolanaEcosystemTokens();

    if (ecosystemTokens.length === 0) {
      // CoinGecko unavailable (429 etc.) — enrich seedTokens with Jupiter prices
      console.warn("[market-data] CoinGecko unavailable, using Jupiter price fallback");
      const enriched = await enrichSeedTokensWithJupiter();
      return NextResponse.json(
        { tokens: enriched },
        { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    // 2. Fetch DeFi Llama TVLs
    const tvlMap: Record<string, number> = await fetchAllProtocolTVLs();

    // 3. Fetch Supabase sentiment
    const sentimentMap = await fetchTokenSentiment();

    // 4. Resolve Solana addresses (single bulk API call, cached 10 min) and build MarketToken[]
    const seedByAddress = new Map(seedTokens.map((t) => [t.address, t]));
    const seenAddresses = new Set<string>();
    const tokens: MarketToken[] = [];

    // Pre-resolve all unknown coins via bulk address fetch
    const unknownCoins = ecosystemTokens.filter((t) => !resolveSolanaAddress(t.coingeckoId));
    const resolvedExtra = new Map<string, { address: string; decimals: number }>();
    if (unknownCoins.length > 0) {
      // fetchSolanaAddressForCoin uses cached bulk list internally (1 API call total)
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
      if (!resolved) continue; // Skip tokens without Solana address

      // Deduplicate (e.g., wrapped-solana vs solana)
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

    return NextResponse.json(
      { tokens },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Market data API error: ${message}`);

    return NextResponse.json(
      { tokens: seedTokens },
      {
        status: 500,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  }
}

// ---------- Jupiter price fallback ----------

/**
 * Enrich seedTokens with live prices from Jupiter.
 * Used when CoinGecko is unavailable (429 rate limit etc.).
 */
async function enrichSeedTokensWithJupiter(): Promise<MarketToken[]> {
  try {
    const addresses = seedTokens.map((t) => t.address);
    const [jupiterPrices, jupiterTokens] = await Promise.all([
      fetchTokenPrices(addresses),
      fetchVerifiedTokens(),
    ]);

    // Build a logo lookup from Jupiter verified tokens
    const logoMap = new Map<string, string>();
    for (const jt of jupiterTokens) {
      if (jt.logoURI) logoMap.set(jt.address, jt.logoURI);
    }

    return seedTokens.map((seed) => {
      const jupPrice = jupiterPrices.get(seed.address);
      return {
        ...seed,
        price: jupPrice ?? seed.price,
        logoURI: logoMap.get(seed.address) ?? seed.logoURI,
      };
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Jupiter fallback failed: ${message}`);
    return seedTokens;
  }
}
