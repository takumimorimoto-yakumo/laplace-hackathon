// ============================================================
// Drift Protocol — Perpetual Markets Data
// ============================================================

const DRIFT_API_BASE = "https://data.api.drift.trade";

/** Drift perp market info */
export interface DriftPerpMarket {
  symbol: string;       // e.g. "SOL", "BTC", "ETH"
  marketIndex: number;
  maxLeverage: number;  // derived from initialMarginRatio
}

// ---------- In-memory cache ----------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** Cache for 5 minutes — perp market lists change infrequently */
const CACHE_TTL_MS = 5 * 60_000;

let perpMarketsCache: CacheEntry<DriftPerpMarket[]> | null = null;

// ---------- Symbol normalization ----------

/**
 * Drift uses formats like "SOL-PERP", "1MBONK-PERP".
 * Extract the base symbol and normalize.
 */
function normalizeSymbol(driftSymbol: string): string {
  // Remove "-PERP" suffix
  let sym = driftSymbol.replace(/-PERP$/i, "");

  // Handle 1M prefix (e.g. "1MBONK" → "BONK", "1MPEPE" → "PEPE")
  if (sym.startsWith("1M")) {
    sym = sym.slice(2);
  }

  // Handle "k" prefix (e.g. "kBONK" → "BONK")
  if (sym.startsWith("k") && sym.length > 1 && sym[1] === sym[1].toUpperCase()) {
    sym = sym.slice(1);
  }

  return sym.toUpperCase();
}

// ---------- Fetch perp markets ----------

/**
 * Fetch all available perpetual markets from Drift Protocol.
 * Returns normalized symbols with max leverage.
 * Cached for 5 minutes.
 */
export async function fetchDriftPerpMarkets(): Promise<DriftPerpMarket[]> {
  // Check cache
  if (perpMarketsCache && Date.now() < perpMarketsCache.expiresAt) {
    return perpMarketsCache.data;
  }

  try {
    const response = await fetch(`${DRIFT_API_BASE}/v2/markets`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`[drift-perps] API returned ${response.status}`);
      return perpMarketsCache?.data ?? [];
    }

    const raw = await response.json();

    // Drift /v2/markets returns an array of market objects
    // Each has: marketIndex, symbol, marketType ("perp" | "spot"), initialMarginRatio, etc.
    const markets: DriftPerpMarket[] = [];

    const items = Array.isArray(raw) ? raw : (raw.markets ?? raw.data ?? []);

    for (const m of items) {
      // Only perpetual markets
      const marketType = (m.marketType ?? m.market_type ?? "") as string;
      if (marketType !== "perp") continue;

      const driftSymbol = (m.symbol ?? m.name ?? "") as string;
      if (!driftSymbol) continue;

      const symbol = normalizeSymbol(driftSymbol);
      const marketIndex = Number(m.marketIndex ?? m.market_index ?? 0);

      // Max leverage = 1 / initialMarginRatio
      // initialMarginRatio is typically a fraction like 0.1 (10x) or 0.05 (20x)
      const imr = Number(m.initialMarginRatio ?? m.initial_margin_ratio ?? 0.1);
      const maxLeverage = imr > 0 ? Math.floor(1 / imr) : 10;

      markets.push({ symbol, marketIndex, maxLeverage });
    }

    // Deduplicate by symbol (keep highest leverage)
    const bySymbol = new Map<string, DriftPerpMarket>();
    for (const m of markets) {
      const existing = bySymbol.get(m.symbol);
      if (!existing || m.maxLeverage > existing.maxLeverage) {
        bySymbol.set(m.symbol, m);
      }
    }

    const result = Array.from(bySymbol.values());

    perpMarketsCache = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    console.log(`[drift-perps] Fetched ${result.length} perp markets`);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[drift-perps] Failed to fetch markets: ${msg}`);
    return perpMarketsCache?.data ?? [];
  }
}

/**
 * Build a Set of symbols available for perp trading on Drift.
 * Used for quick shortability checks.
 */
export async function fetchDriftPerpSymbols(): Promise<Set<string>> {
  const markets = await fetchDriftPerpMarkets();
  return new Set(markets.map((m) => m.symbol));
}

/**
 * Build a Map of symbol → max leverage for perp markets.
 */
export async function fetchDriftPerpLeverage(): Promise<Map<string, number>> {
  const markets = await fetchDriftPerpMarkets();
  return new Map(markets.map((m) => [m.symbol, m.maxLeverage]));
}
