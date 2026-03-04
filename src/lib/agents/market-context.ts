// ============================================================
// Market Context — Fetch market data for agent prompts
// ============================================================

import { fetchSolanaEcosystemTokens } from "@/lib/data/coingecko";
import { seedTokens } from "@/lib/tokens";
import type { RealMarketData } from "./prompt-builder";

/**
 * Fetch current market data and convert to RealMarketData[] format
 * for use in agent prompt generation.
 *
 * Flow:
 * 1. Try CoinGecko Solana ecosystem API
 * 2. Fall back to seedTokens if API returns empty
 */
export async function fetchMarketContext(): Promise<RealMarketData[]> {
  try {
    const tokens = await fetchSolanaEcosystemTokens();

    if (tokens.length > 0) {
      return tokens.map((t) => ({
        symbol: t.symbol.toUpperCase(),
        price: t.currentPrice,
        change24h: t.priceChangePercentage24h,
        volume24h: t.totalVolume,
        tvl: null,
        marketCap: t.marketCap || null,
      }));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[market-context] CoinGecko fetch failed, using fallback: ${message}`);
  }

  // Fallback to seed tokens
  return seedTokens.map((t) => ({
    symbol: t.symbol,
    price: t.price,
    change24h: t.change24h,
    volume24h: t.volume24h,
    tvl: t.tvl,
    marketCap: t.marketCap,
  }));
}
