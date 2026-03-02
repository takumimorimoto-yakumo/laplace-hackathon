import { NextRequest, NextResponse } from "next/server";

import {
  resolveCoingeckoId,
  fetchCoingeckoIdForAddress,
  fetchMarketChart,
} from "@/lib/data/coingecko";

const VALID_DAYS = new Set([1, 7, 30, 365]);

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
    // Resolve CoinGecko ID: static map first, then bulk API
    const coingeckoId =
      resolveCoingeckoId(address) ??
      (await fetchCoingeckoIdForAddress(address));

    if (!coingeckoId) {
      return NextResponse.json(
        { prices: [] },
        {
          headers: {
            "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    const chart = await fetchMarketChart(
      coingeckoId,
      days as 1 | 7 | 30 | 365
    );

    return NextResponse.json(
      { prices: chart?.prices ?? [] },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Chart data API error: ${message}`);

    return NextResponse.json(
      { prices: [] },
      {
        status: 500,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  }
}
