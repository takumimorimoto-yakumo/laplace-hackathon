// ============================================================
// Market Context — Fetch market data for agent prompts
// ============================================================

import type { SolanaEcosystemToken } from "@/lib/data/coingecko";
import { fetchSolanaEcosystemTokens, resolveSolanaAddress } from "@/lib/data/coingecko";
import { fetchCachedTokens } from "@/lib/supabase/token-cache";
import { fetchDriftPerpMarkets } from "@/lib/data/drift-perps";
import type { RealMarketData } from "./prompt-builder";

// ---------- Error Class ----------

export class MarketDataUnavailableError extends Error {
  constructor(reason: string) {
    super(`Market data unavailable: ${reason}`);
    this.name = "MarketDataUnavailableError";
  }
}

// ---------- Volatility Computation ----------

/**
 * Compute 24h volatility from sparkline data as the standard deviation
 * of log returns over the last ~24h portion of the 7-day sparkline.
 *
 * CoinGecko 7d sparkline has ~168 data points (hourly).
 * The last 24h is approximately the last 24 data points.
 */
function computeVolatility24h(sparkline: number[]): number {
  // Need at least 2 points in the 24h window to compute returns
  const last24hPoints = sparkline.slice(-25); // 25 points → 24 returns
  if (last24hPoints.length < 2) return 0;

  // Compute log returns
  const returns: number[] = [];
  for (let i = 1; i < last24hPoints.length; i++) {
    const prev = last24hPoints[i - 1];
    const curr = last24hPoints[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }

  if (returns.length === 0) return 0;

  // Standard deviation of returns
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

// ---------- Rank Computation ----------

/**
 * Assign 1-based ranks to items by a numeric key (descending).
 * Items with value 0 or null get rank 0 (unranked).
 */
function assignRanks(
  items: { index: number; value: number | null }[]
): Map<number, number> {
  const ranked = new Map<number, number>();

  // Filter out unranked items
  const sortable = items.filter((it) => it.value !== null && it.value > 0);
  sortable.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  for (let i = 0; i < sortable.length; i++) {
    ranked.set(sortable[i].index, i + 1);
  }

  // Set unranked items to 0
  for (const it of items) {
    if (!ranked.has(it.index)) {
      ranked.set(it.index, 0);
    }
  }

  return ranked;
}

// ---------- Main Fetch ----------

/**
 * Fetch current market data and convert to RealMarketData[] format
 * for use in agent prompt generation.
 *
 * Flow:
 * 1. Fetch CoinGecko Solana ecosystem tokens
 * 2. Compute ranks, volatility, and map to RealMarketData
 * 3. Fall back to DB cache if CoinGecko fails or returns empty
 */
export async function fetchMarketContext(): Promise<RealMarketData[]> {
  let tokens: SolanaEcosystemToken[];
  try {
    tokens = await fetchSolanaEcosystemTokens();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[market-context] CoinGecko fetch failed: ${message}, falling back to DB cache`);
    tokens = [];
  }

  if (tokens.length === 0) {
    // Fallback to DB cache when CoinGecko returns empty (e.g. rate limited)
    console.warn("[market-context] CoinGecko returned empty, falling back to DB cache");
    const cachedTokens = await fetchCachedTokens();
    if (cachedTokens.length === 0) {
      throw new MarketDataUnavailableError(
        "Both CoinGecko and DB cache returned empty"
      );
    }
    const cachedResult = cachedTokens.map((t) => ({
      symbol: t.symbol.toUpperCase(),
      address: t.address,
      price: t.price,
      change24h: t.change24h,
      volume24h: t.volume24h,
      tvl: t.tvl,
      marketCap: t.marketCap,
      coingeckoId: "",
      name: t.name,
      volumeRank: 0,
      marketCapRank: 0,
      volatility24h: 0,
      sparkline7d: t.sparkline7d,
      perpAvailable: false,
      perpMaxLeverage: 0,
    }));
    return enrichWithPerpData(cachedResult);
  }

  // Compute volume and market cap ranks
  const volumeRanks = assignRanks(
    tokens.map((t, i) => ({ index: i, value: t.totalVolume }))
  );
  const marketCapRanks = assignRanks(
    tokens.map((t, i) => ({ index: i, value: t.marketCap }))
  );

  const result = tokens.map((t, i) => ({
    symbol: t.symbol.toUpperCase(),
    address: resolveSolanaAddress(t.coingeckoId)?.address ?? "",
    price: t.currentPrice,
    change24h: t.priceChangePercentage24h,
    volume24h: t.totalVolume,
    tvl: null,
    marketCap: t.marketCap || null,
    coingeckoId: t.coingeckoId,
    name: t.name,
    volumeRank: volumeRanks.get(i) ?? 0,
    marketCapRank: marketCapRanks.get(i) ?? 0,
    volatility24h: computeVolatility24h(t.sparklineIn7d),
    sparkline7d: t.sparklineIn7d,
    perpAvailable: false,
    perpMaxLeverage: 0,
  }));

  return enrichWithPerpData(result);
}

// ---------- Perp Data Enrichment ----------

/**
 * Enrich market data with Drift Protocol perp availability.
 * Best-effort: if Drift API fails, returns data without perp info.
 */
async function enrichWithPerpData(
  data: RealMarketData[]
): Promise<RealMarketData[]> {
  try {
    const perpMarkets = await fetchDriftPerpMarkets();
    if (perpMarkets.length === 0) return data;

    const perpBySymbol = new Map(
      perpMarkets.map((m) => [m.symbol, m])
    );

    for (const d of data) {
      const perp = perpBySymbol.get(d.symbol);
      if (perp) {
        d.perpAvailable = true;
        d.perpMaxLeverage = perp.maxLeverage;
      }
    }

    const perpCount = data.filter((d) => d.perpAvailable).length;
    console.log(
      `[market-context] Enriched ${perpCount}/${data.length} tokens with Drift perp data`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[market-context] Drift perp enrichment failed (non-fatal): ${msg}`);
  }
  return data;
}
