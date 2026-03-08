// ============================================================
// Jupiter API Client — Token List & Prices
// ============================================================

const JUPITER_TOKENS_API = process.env.JUPITER_TOKENS_API_BASE_URL ?? "https://tokens.jup.ag";
const JUPITER_PRICE_API = process.env.JUPITER_PRICE_API_BASE_URL ?? "https://api.jup.ag";

/** Jupiter Token List item */
export interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  daily_volume: number | null;
}

/** Jupiter Price API response */
interface JupiterPriceResponse {
  data: Record<string, { id: string; price: string }>;
}

// ---------- In-memory cache ----------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

let verifiedTokensCache: CacheEntry<JupiterToken[]> | null = null;
const priceCache = new Map<string, CacheEntry<number>>();

// ---------- Fetch verified tokens ----------

/**
 * Fetch verified tokens from Jupiter, sorted by daily_volume descending.
 * Returns top 250 tokens.
 */
export async function fetchVerifiedTokens(): Promise<JupiterToken[]> {
  if (verifiedTokensCache && Date.now() < verifiedTokensCache.expiresAt) {
    return verifiedTokensCache.data;
  }

  const res = await fetch(`${JUPITER_TOKENS_API}/tokens?tags=verified`);
  if (!res.ok) {
    console.error(`Jupiter token list error: ${res.status} ${res.statusText}`);
    return [];
  }

  const tokens = (await res.json()) as JupiterToken[];

  // Sort by daily_volume descending, nulls last
  tokens.sort((a, b) => (b.daily_volume ?? 0) - (a.daily_volume ?? 0));

  const top = tokens.slice(0, 250);

  verifiedTokensCache = {
    data: top,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return top;
}

// ---------- Batch price fetch ----------

const PRICE_BATCH_SIZE = 100;

/**
 * Fetch prices for multiple token addresses from Jupiter Price API v2.
 * Batches requests in chunks of 100.
 */
export async function fetchTokenPrices(
  addresses: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // Check cache first
  const uncached: string[] = [];
  for (const addr of addresses) {
    const cached = priceCache.get(addr);
    if (cached && Date.now() < cached.expiresAt) {
      result.set(addr, cached.data);
    } else {
      uncached.push(addr);
    }
  }

  if (uncached.length === 0) return result;

  // Batch into chunks of 100
  const chunks: string[][] = [];
  for (let i = 0; i < uncached.length; i += PRICE_BATCH_SIZE) {
    chunks.push(uncached.slice(i, i + PRICE_BATCH_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const ids = chunk.join(",");
        const res = await fetch(`${JUPITER_PRICE_API}/price/v2?ids=${ids}`);
        if (!res.ok) {
          console.error(`Jupiter price API error: ${res.status}`);
          return new Map<string, number>();
        }
        const json = (await res.json()) as JupiterPriceResponse;
        const map = new Map<string, number>();
        for (const [addr, info] of Object.entries(json.data)) {
          if (info?.price) {
            const price = Number(info.price);
            map.set(addr, price);
            priceCache.set(addr, {
              data: price,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
          }
        }
        return map;
      } catch (err) {
        console.error("Jupiter price batch failed:", err instanceof Error ? err.message : err);
        return new Map<string, number>();
      }
    })
  );

  for (const map of chunkResults) {
    for (const [addr, price] of map) {
      result.set(addr, price);
    }
  }

  return result;
}

// ---------- Single token fetch ----------

/**
 * Fetch a single token's metadata from Jupiter by address.
 * Works for any Solana token address.
 */
export async function fetchSingleToken(
  address: string
): Promise<JupiterToken | null> {
  try {
    const res = await fetch(`${JUPITER_TOKENS_API}/token/${address}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      console.error(`Jupiter single token error: ${res.status}`);
      return null;
    }
    return (await res.json()) as JupiterToken;
  } catch (err) {
    console.error("fetchSingleToken failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
