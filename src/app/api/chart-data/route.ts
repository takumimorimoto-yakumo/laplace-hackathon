import { NextRequest, NextResponse } from "next/server";

import {
  resolveCoingeckoId,
  fetchCoingeckoIdForAddress,
  fetchMarketChart,
} from "@/lib/data/coingecko";
import {
  fetchTokenOHLCV,
  ohlcvToPricePairs,
  daysToOhlcvType,
} from "@/lib/data/birdeye";

const VALID_DAYS = new Set([1, 7, 30, 365]);

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const address = searchParams.get("address");
  const daysParam = searchParams.get("days");

  if (!address || !daysParam) {
    return NextResponse.json(
      { prices: [] },
      { status: 400 }
    );
  }

  const days = Number(daysParam);
  if (!VALID_DAYS.has(days)) {
    return NextResponse.json(
      { prices: [] },
      { status: 400 }
    );
  }

  try {
    // 1. Try CoinGecko market chart
    const prices = await tryCoingecko(address, days as 1 | 7 | 30 | 365);
    if (prices) {
      return NextResponse.json({ prices }, { headers: CACHE_HEADERS });
    }

    // 2. Fallback: Birdeye OHLCV (uses Solana address directly)
    const birdeyePrices = await tryBirdeye(address, days);
    if (birdeyePrices) {
      return NextResponse.json({ prices: birdeyePrices }, { headers: CACHE_HEADERS });
    }

    // 3. Both failed — return empty
    return NextResponse.json({ prices: [] }, { headers: CACHE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Chart data API error: ${message}`);

    return NextResponse.json(
      { prices: [] },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

/** Try CoinGecko: resolve ID then fetch market chart. */
async function tryCoingecko(
  address: string,
  days: 1 | 7 | 30 | 365
): Promise<[number, number][] | null> {
  const coingeckoId =
    resolveCoingeckoId(address) ??
    (await fetchCoingeckoIdForAddress(address));

  if (!coingeckoId) return null;

  const chart = await fetchMarketChart(coingeckoId, days);
  return chart?.prices ?? null;
}

/** Try Birdeye: fetch OHLCV and convert to price pairs. */
async function tryBirdeye(
  address: string,
  days: number
): Promise<[number, number][] | null> {
  const timeframe = daysToOhlcvType(days);
  const candles = await fetchTokenOHLCV(address, timeframe);
  if (!candles || candles.length === 0) return null;

  console.warn(`[chart-data] CoinGecko unavailable, using Birdeye fallback for ${address}`);
  return ohlcvToPricePairs(candles);
}
