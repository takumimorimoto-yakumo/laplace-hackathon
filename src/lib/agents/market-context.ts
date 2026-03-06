// ============================================================
// Market Context — Fetch market data for agent prompts
// ============================================================

import { fetchSolanaEcosystemTokens } from "@/lib/data/coingecko";
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
 * 3. Throw MarketDataUnavailableError if API fails or returns empty
 */
export async function fetchMarketContext(): Promise<RealMarketData[]> {
  let tokens;
  try {
    tokens = await fetchSolanaEcosystemTokens();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MarketDataUnavailableError(`CoinGecko fetch failed: ${message}`);
  }

  if (tokens.length === 0) {
    throw new MarketDataUnavailableError(
      "CoinGecko returned empty token list"
    );
  }

  // Compute volume and market cap ranks
  const volumeRanks = assignRanks(
    tokens.map((t, i) => ({ index: i, value: t.totalVolume }))
  );
  const marketCapRanks = assignRanks(
    tokens.map((t, i) => ({ index: i, value: t.marketCap }))
  );

  return tokens.map((t, i) => ({
    symbol: t.symbol.toUpperCase(),
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
  }));
}
