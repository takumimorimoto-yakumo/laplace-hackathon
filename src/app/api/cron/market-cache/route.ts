import { NextRequest, NextResponse } from "next/server";
import {
  fetchSolanaEcosystemTokens,
  resolveSolanaAddress,
  fetchSolanaAddressForCoin,
} from "@/lib/data/coingecko";
import { fetchAllProtocolTVLs } from "@/lib/data/defillama";
import { inferTags } from "@/lib/token-utils";
import { upsertTokenCache } from "@/lib/supabase/token-cache";
import type { TokenCacheInput } from "@/lib/supabase/token-cache";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/market-cache
 *
 * Refresh the token_cache table with CoinGecko + DeFi Llama data.
 * Runs every 5 minutes via Vercel cron.
 * If CoinGecko returns 429, does nothing (cache retains previous values).
 */
export async function GET(request: NextRequest) {
  // --- Verify cron secret ---
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch CoinGecko ecosystem tokens
    const ecosystemTokens = await fetchSolanaEcosystemTokens();

    if (ecosystemTokens.length === 0) {
      // CoinGecko unavailable (429 etc.) — do nothing, keep existing cache
      console.warn("[market-cache] CoinGecko unavailable, skipping cache update");
      return NextResponse.json({
        message: "CoinGecko unavailable, cache unchanged",
        upserted: 0,
      });
    }

    // 2. Fetch DeFi Llama TVLs in parallel
    const tvlMap = await fetchAllProtocolTVLs();

    // 3. Resolve Solana addresses for unknown coins
    const unknownCoins = ecosystemTokens.filter(
      (t) => !resolveSolanaAddress(t.coingeckoId),
    );
    const resolvedExtra = new Map<string, { address: string; decimals: number }>();

    if (unknownCoins.length > 0) {
      const results = await Promise.all(
        unknownCoins.map(async (t) => {
          const result = await fetchSolanaAddressForCoin(t.coingeckoId);
          return { id: t.coingeckoId, result };
        }),
      );
      for (const { id, result } of results) {
        if (result) resolvedExtra.set(id, result);
      }
    }

    // 4. Build token cache inputs
    const seenAddresses = new Set<string>();
    const tokens: TokenCacheInput[] = [];

    for (const eco of ecosystemTokens) {
      const resolved =
        resolveSolanaAddress(eco.coingeckoId) ?? resolvedExtra.get(eco.coingeckoId);
      if (!resolved) continue;

      if (seenAddresses.has(resolved.address)) continue;
      seenAddresses.add(resolved.address);

      const tvl = tvlMap[eco.symbol.toUpperCase()] ?? null;

      tokens.push({
        address: resolved.address,
        coingeckoId: eco.coingeckoId,
        symbol: eco.symbol.toUpperCase(),
        name: eco.name,
        logoUri: eco.image,
        decimals: resolved.decimals,
        price: eco.currentPrice,
        change24h: eco.priceChangePercentage24h,
        tags: inferTags(eco.coingeckoId, eco.symbol),
        tvl,
        volume24h: eco.totalVolume,
        marketCap: eco.marketCap || null,
        sparkline7d: eco.sparklineIn7d,
      });
    }

    // 5. Upsert into DB
    const upserted = await upsertTokenCache(tokens);

    console.log(`[market-cache] Upserted ${upserted} tokens into token_cache`);

    return NextResponse.json({
      message: `Cache updated with ${upserted} tokens`,
      upserted,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[market-cache] Error: ${message}`);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
