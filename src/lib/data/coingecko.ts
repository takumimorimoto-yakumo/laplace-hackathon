const BASE_URL = process.env.COINGECKO_API_BASE_URL ?? "https://api.coingecko.com/api/v3";

const SOLANA_TO_COINGECKO: Record<string, string> = {
  AI16Z: "ai16z",
  BOME: "book-of-meme",
  BONK: "bonk",
  BP: "backpack",
  CBBTC: "coinbase-wrapped-btc",
  DRIFT: "drift-protocol",
  EURC: "euro-coin",
  FARTCOIN: "fartcoin",
  GRASS: "grass",
  GUN: "gunz",
  HNT: "helium",
  HYPE: "wormhole-bridged-hype",
  IOT: "helium-iot",
  JLP: "jupiter-perpetuals-liquidity-provider-token",
  JITOSOL: "jito-staked-sol",
  JITO: "jito-governance-token",
  JSOL: "jupiter-staked-sol",
  JUP: "jupiter-exchange-solana",
  KMNO: "kamino",
  LAYER: "layer",
  MELANIA: "melania-meme",
  MEW: "cat-in-a-dogs-world",
  MET: "meteora",
  MOBILE: "helium-mobile",
  MSOL: "marinade-staked-sol",
  ONDO: "ondo-finance",
  ORCA: "orca",
  PENGU: "pengu",
  PIPPIN: "pippin",
  POPCAT: "popcat",
  PUMP: "pump-fun",
  PYTH: "pyth-network",
  RAY: "raydium",
  RNDR: "render-token",
  SANDY: "sanctum-2",
  SOL: "solana",
  SONIC: "sonic-3",
  STEP: "step-finance",
  TENSOR: "tensor-protocol",
  TRUMP: "official-trump",
  VIRTUAL: "virtual-protocol",
  WBTC: "wrapped-bitcoin",
  WETH: "ethereum-wormhole",
  WIF: "dogwifcoin",
  WMTX: "world-mobile-token",
  W: "wormhole",
};

export function getCoingeckoId(symbol: string): string | undefined {
  return SOLANA_TO_COINGECKO[symbol.toUpperCase()];
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  currentPrice: number;
  marketCap: number;
  totalVolume: number;
  priceChangePercentage24h: number;
  sparklineIn7d: number[];
  image: string | null;
}

interface CoinGeckoRawMarketItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  sparkline_in_7d?: {
    price: number[];
  };
  image: string;
}

function getHeaders(): HeadersInit {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) {
    return { "x-cg-demo-key": apiKey };
  }
  return {};
}

export async function fetchMarketData(
  ids: string[]
): Promise<CoinGeckoMarketData[] | null> {
  if (ids.length === 0) {
    return [];
  }

  try {
    const url = new URL(`${BASE_URL}/coins/markets`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("ids", ids.join(","));
    url.searchParams.set("sparkline", "true");

    const response = await fetch(url.toString(), {
      headers: getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[CoinGecko] Rate limited (429) on markets API, falling back`);
      } else {
        console.error(`CoinGecko markets API error: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const json = (await response.json()) as CoinGeckoRawMarketItem[];

    return json.map(
      (item: CoinGeckoRawMarketItem): CoinGeckoMarketData => ({
        id: item.id,
        symbol: item.symbol,
        currentPrice: item.current_price,
        marketCap: item.market_cap,
        totalVolume: item.total_volume,
        priceChangePercentage24h: item.price_change_percentage_24h,
        sparklineIn7d: item.sparkline_in_7d?.price ?? [],
        image: item.image || null,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch market data for [${ids.join(", ")}]: ${message}`);
    return null;
  }
}

// ---------- Solana Ecosystem Tokens ----------

/** Enriched token from CoinGecko solana-ecosystem category */
export interface SolanaEcosystemToken {
  coingeckoId: string;
  symbol: string;
  name: string;
  image: string | null;
  currentPrice: number;
  marketCap: number;
  totalVolume: number;
  priceChangePercentage24h: number;
  sparklineIn7d: number[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 300_000; // 5 minutes (extended to reduce 429s on free tier)
let ecosystemCache: CacheEntry<SolanaEcosystemToken[]> | null = null;

/**
 * Fetch top Solana ecosystem tokens from CoinGecko (up to 100).
 * Single page fetch — UI paginates at 20 so 100 tokens is sufficient.
 * Cached for 5 minutes in-memory + Next.js server cache (revalidate: 300).
 */
export async function fetchSolanaEcosystemTokens(): Promise<SolanaEcosystemToken[]> {
  if (ecosystemCache && Date.now() < ecosystemCache.expiresAt) {
    return ecosystemCache.data;
  }

  try {
    const url = new URL(`${BASE_URL}/coins/markets`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("category", "solana-ecosystem");
    url.searchParams.set("order", "volume_desc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", "1");
    url.searchParams.set("sparkline", "true");

    const response = await fetch(url.toString(), {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[CoinGecko] Rate limited (429) on ecosystem fetch, using fallback");
      } else {
        console.error(`CoinGecko ecosystem error: ${response.status}`);
      }
      return [];
    }

    const json = (await response.json()) as CoinGeckoRawMarketItem[];

    const results: SolanaEcosystemToken[] = json.map((item) => ({
      coingeckoId: item.id,
      symbol: item.symbol,
      name: item.name,
      image: item.image || null,
      currentPrice: item.current_price ?? 0,
      marketCap: item.market_cap ?? 0,
      totalVolume: item.total_volume ?? 0,
      priceChangePercentage24h: item.price_change_percentage_24h ?? 0,
      sparklineIn7d: item.sparkline_in_7d?.price ?? [],
    }));

    if (results.length > 0) {
      ecosystemCache = {
        data: results,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
    }

    return results;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`CoinGecko ecosystem fetch failed: ${message}`);
    return [];
  }
}

// ---------- CoinGecko ID → Solana Address Resolution ----------

/** Well-known CoinGecko ID → Solana mint address mapping */
const COINGECKO_TO_SOLANA: Record<string, { address: string; decimals: number }> = {
  // --- Native / LST ---
  "solana": { address: "So11111111111111111111111111111111111111112", decimals: 9 },
  "wrapped-solana": { address: "So11111111111111111111111111111111111111112", decimals: 9 },
  "marinade-staked-sol": { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", decimals: 9 },
  "msol": { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", decimals: 9 },
  "jito-staked-sol": { address: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9 },
  "jupiter-staked-sol": { address: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", decimals: 9 },

  // --- Stablecoins (kept for price resolution, not for trading predictions) ---
  "tether": { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  "usd-coin": { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  "euro-coin": { address: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", decimals: 6 },

  // --- DeFi / Infrastructure ---
  "aethir": { address: "GRFKaABC5HpoadZEFmY7SYDLCP3JjTjg1AXQ7EkPxiiC", decimals: 9 },
  "drift-protocol": { address: "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7", decimals: 6 },
  "grass": { address: "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs", decimals: 9 },
  "jito-governance-token": { address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9 },
  "jupiter-exchange-solana": { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
  "jupiter-perpetuals-liquidity-provider-token": { address: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", decimals: 6 },
  "kamino": { address: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", decimals: 6 },
  "layer": { address: "LAYER4xPpTCb3QL8S9u41EAhAX7mhBn8Q6xMTwY2Yzc", decimals: 6 },
  "meteora": { address: "METAewgxyPbgwsseH8T16a39CQ5VyVxGpJFhUBkiia1", decimals: 6 },
  "nosana": { address: "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7", decimals: 6 },
  "ondo-finance": { address: "ONDO1111111111111111111111111111111111111111", decimals: 9 },
  "orca": { address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6 },
  "parcl": { address: "PARCLfHgGBraWJWP3Jf9UZnMRfT57DibwDjJTCnWo9d", decimals: 6 },
  "phantom": { address: "PHTvJGfm1NHyJVK4C9Y4K4NXcxhqjgDtHQRkLmDpump", decimals: 6 },
  "pyth-network": { address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6 },
  "raydium": { address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6 },
  "render-token": { address: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8 },
  "sanctum-2": { address: "SANDYuP7VRzN3rmFWM1f9H4U4BNVBGGyRfinHjGpump", decimals: 6 },
  "solaxy": { address: "3CaGvByMkExzzmkBm7jqEkVSr2TXKKomSXHnFTfQprJr", decimals: 6 },
  "step-finance": { address: "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT", decimals: 9 },
  "tensor-protocol": { address: "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6", decimals: 9 },
  "wormhole": { address: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", decimals: 6 },

  // --- DePIN ---
  "helium": { address: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", decimals: 8 },
  "helium-mobile": { address: "mb1eu7TzEc71KxDpsmsKoucSSuuo6KWzBMdkhQAkuAE", decimals: 6 },
  "helium-iot": { address: "iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns", decimals: 6 },
  "world-mobile-token": { address: "WMTXyYKUMTG3VuZA5beXuHVRLpyTwwaoP7h2i8YpuRH", decimals: 6 },

  // --- AI / Meme ---
  "ai16z": { address: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC", decimals: 9 },
  "bonk": { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  "book-of-meme": { address: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", decimals: 6 },
  "cat-in-a-dogs-world": { address: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", decimals: 5 },
  "dogwifcoin": { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
  "fartcoin": { address: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", decimals: 6 },
  "mantra-dao": { address: "OMkfFMzg8kRMZBPYMbvWozCFQBAQiVGjBRaAPHqCpAj", decimals: 6 },
  "melania-meme": { address: "FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P", decimals: 6 },
  "official-trump": { address: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", decimals: 6 },
  "pengu": { address: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", decimals: 6 },
  "pippin": { address: "Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump", decimals: 6 },
  "popcat": { address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9 },
  "pump-fun": { address: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", decimals: 6 },
  "the-ai-prophecy": { address: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn", decimals: 9 },
  "virtual-protocol": { address: "3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y", decimals: 9 },

  // --- Gaming ---
  "gunz": { address: "3jUf2RTyXp867piSB2dt8uUcNiLDW58asjGtXkRAkBbe", decimals: 6 },
  "sonic-3": { address: "SonicxvLud67EceaEzCLRnMTBqzYUUYNr93DBkBdDES", decimals: 6 },

  // --- Exchange Tokens ---
  "backpack": { address: "BPxxfRCXkUVhig4HS1Lh7kZqV6SPJhzfEk4x6fVBjPCy", decimals: 6 },

  // --- Cross-chain Wrapped ---
  "chainlink": { address: "CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG", decimals: 9 },
  "coinbase-wrapped-btc": { address: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", decimals: 8 },
  "dego-finance": { address: "BU4eP1vCR99amXKsMXhctX8YpqUa7wbULQ26XaQbazkS", decimals: 9 },
  "ethereum-wormhole": { address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8 },
  "starknet": { address: "HsRpHQn6VbyMs5b5j5SV6xQ2VvpvvCCzu19GjytVSCoz", decimals: 8 },
  "wormhole-bridged-hype": { address: "4Ae83YgsBcwJTMx3am3gi5Ppnp1KwmunznWAoYeqgDgL", decimals: 8 },
  "wrapped-bitcoin": { address: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8 },
};

/** Resolve a Solana address + decimals from a CoinGecko ID. Returns null if unknown. */
export function resolveSolanaAddress(coingeckoId: string): { address: string; decimals: number } | null {
  return COINGECKO_TO_SOLANA[coingeckoId] ?? null;
}

// ---------- Solana Address → CoinGecko ID Reverse Lookup ----------

/** Reverse map: Solana mint address → CoinGecko ID (auto-generated from COINGECKO_TO_SOLANA) */
const SOLANA_TO_COINGECKO_ID = new Map<string, string>(
  Object.entries(COINGECKO_TO_SOLANA).map(([cgId, { address }]) => [address, cgId])
);

/** Resolve CoinGecko ID from a Solana mint address. Uses static map only. */
export function resolveCoingeckoId(address: string): string | null {
  return SOLANA_TO_COINGECKO_ID.get(address) ?? null;
}

/**
 * Resolve CoinGecko ID from a Solana mint address.
 * Checks static map first, then falls back to bulk coin list API.
 */
export async function fetchCoingeckoIdForAddress(address: string): Promise<string | null> {
  const known = SOLANA_TO_COINGECKO_ID.get(address);
  if (known) return known;

  const bulk = await fetchBulkSolanaAddresses();
  for (const [cgId, addr] of bulk.entries()) {
    if (addr === address) return cgId;
  }

  return null;
}

// ---------- Bulk Solana address resolution via /coins/list ----------

interface CoinListItem {
  id: string;
  platforms?: Record<string, string>;
}

let bulkAddressCache: CacheEntry<Map<string, string>> | null = null;
const BULK_CACHE_TTL_MS = 600_000; // 10 minutes

/**
 * Fetch the full CoinGecko coin list with platform addresses.
 * Builds a coingeckoId → Solana address map. Cached for 10 minutes.
 * Single API call, no rate limit issues.
 */
async function fetchBulkSolanaAddresses(): Promise<Map<string, string>> {
  if (bulkAddressCache && Date.now() < bulkAddressCache.expiresAt) {
    return bulkAddressCache.data;
  }

  try {
    const response = await fetch(`${BASE_URL}/coins/list?include_platform=true`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(`CoinGecko coins/list error: ${response.status}`);
      return new Map();
    }

    const json = (await response.json()) as CoinListItem[];
    const map = new Map<string, string>();

    for (const coin of json) {
      const addr = coin.platforms?.solana;
      if (addr) {
        map.set(coin.id, addr);
      }
    }

    bulkAddressCache = { data: map, expiresAt: Date.now() + BULK_CACHE_TTL_MS };
    return map;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`fetchBulkSolanaAddresses failed: ${message}`);
    return new Map();
  }
}

/**
 * Resolve Solana address for a CoinGecko ID.
 * Uses static map first, then bulk-fetched address list.
 */
export async function fetchSolanaAddressForCoin(
  coingeckoId: string
): Promise<{ address: string; decimals: number } | null> {
  // Check static map first (has decimals info)
  const known = COINGECKO_TO_SOLANA[coingeckoId];
  if (known) return known;

  // Check bulk address map
  const bulk = await fetchBulkSolanaAddresses();
  const addr = bulk.get(coingeckoId);
  if (addr) {
    // Default to 9 decimals when not in static map
    return { address: addr, decimals: 9 };
  }

  return null;
}

// ---------- Market Chart (Price History) ----------

export interface MarketChartData {
  prices: [number, number][]; // [timestamp_ms, price][]
}

type MarketChartDays = 1 | 7 | 30 | 365;

interface MarketChartCacheEntry {
  data: MarketChartData;
  expiresAt: number;
}

const marketChartCache = new Map<string, MarketChartCacheEntry>();

const CHART_TTL_MS: Record<MarketChartDays, number> = {
  1: 10 * 60_000,   // 10 min (extended from 5min to reduce 429s)
  7: 15 * 60_000,   // 15 min
  30: 30 * 60_000,  // 30 min
  365: 60 * 60_000, // 60 min
};

/**
 * Fetch price history from CoinGecko /coins/{id}/market_chart.
 *
 * Resolution by `days`:
 * - days=1   → ~5min intervals (~288 points)  → 1D timeframe
 * - days=7   → ~1h intervals  (~168 points)   → 1W timeframe
 * - days=30  → ~1h intervals  (~720 points)   → 1M timeframe
 * - days=365 → daily          (~365 points)   → 1Y timeframe
 */
export async function fetchMarketChart(
  coingeckoId: string,
  days: MarketChartDays
): Promise<MarketChartData | null> {
  const cacheKey = `${coingeckoId}:${days}`;
  const cached = marketChartCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const url = new URL(`${BASE_URL}/coins/${coingeckoId}/market_chart`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", String(days));

    const response = await fetch(url.toString(), {
      headers: getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[CoinGecko] Rate limited (429) on market_chart for ${coingeckoId}, falling back`);
      } else {
        console.error(`CoinGecko market_chart error: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const json = (await response.json()) as { prices?: [number, number][] };
    const data: MarketChartData = {
      prices: json.prices ?? [],
    };

    marketChartCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CHART_TTL_MS[days],
    });

    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`fetchMarketChart(${coingeckoId}, ${days}) failed: ${message}`);
    return null;
  }
}
