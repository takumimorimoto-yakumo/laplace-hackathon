// ============================================================
// Drift Protocol Client — Perpetuals Trading
// ============================================================
//
// Drift SDK integration for leveraged trading on Solana.
// Uses REST API for quotes and SDK for transaction building.

const DRIFT_API = "https://dlob.drift.trade";

export interface DriftMarket {
  marketIndex: number;
  symbol: string;
  lastPrice: number;
  fundingRate: number;
  openInterest: number;
}

export interface DriftPosition {
  marketIndex: number;
  baseAssetAmount: number;
  direction: "long" | "short";
  entryPrice: number;
  unrealizedPnl: number;
}

interface DriftOrderbookResponse {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

export async function fetchPerpMarkets(): Promise<DriftMarket[]> {
  try {
    const res = await fetch(`${DRIFT_API}/markets/perpMarkets`);
    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      marketIndex: number;
      symbol: string;
      lastPrice: number;
      fundingRate: number;
      openInterest: number;
    }>;

    return data.map((m) => ({
      marketIndex: m.marketIndex,
      symbol: m.symbol,
      lastPrice: m.lastPrice,
      fundingRate: m.fundingRate,
      openInterest: m.openInterest,
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch Drift perp markets: ${message}`);
    return [];
  }
}

export async function fetchOrderbook(
  marketIndex: number
): Promise<DriftOrderbookResponse | null> {
  try {
    const res = await fetch(
      `${DRIFT_API}/l2?marketIndex=${marketIndex}&marketType=perp`
    );
    if (!res.ok) return null;
    return (await res.json()) as DriftOrderbookResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch Drift orderbook: ${message}`);
    return null;
  }
}

// Market index mapping for Solana tokens
export const PERP_MARKET_MAP: Record<string, number> = {
  SOL: 0,
  BTC: 1,
  ETH: 2,
  JUP: 24,
  JTO: 26,
  PYTH: 27,
  BONK: 19,
};

export function getPerpMarketIndex(symbol: string): number | undefined {
  return PERP_MARKET_MAP[symbol.toUpperCase()];
}
