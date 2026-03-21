// ============================================================
// Token Cache — Read/write CoinGecko data from Supabase
// Falls back to CoinGecko direct fetch when cache is empty.
// ============================================================

import { createReadOnlyClient } from "./server";
import { createAdminClient } from "./admin";
import { fetchTokenSentiment, fetchTokenSentimentByHorizon } from "./queries";
import {
  fetchSolanaEcosystemTokens,
  resolveSolanaAddress,
} from "@/lib/data/coingecko";
import { fetchAllProtocolTVLs } from "@/lib/data/defillama";
import { inferTags } from "@/lib/token-utils";
import type { Chain, MarketToken, TimeHorizon, HorizonSentiment } from "@/lib/types";

// ---------- DB Row Type ----------

interface TokenCacheRow {
  address: string;
  chain: Chain;
  coingecko_id: string | null;
  symbol: string;
  name: string;
  logo_uri: string | null;
  decimals: number;
  price: number;
  change_24h: number;
  tags: string[];
  tvl: number | null;
  volume_24h: number;
  market_cap: number | null;
  sparkline_7d: number[];
  updated_at: string;
}

// ---------- Row → MarketToken ----------

const defaultHorizonSentiment: Record<TimeHorizon, HorizonSentiment> = {
  short: { bullishPercent: 50, count: 0 },
  mid: { bullishPercent: 50, count: 0 },
  long: { bullishPercent: 50, count: 0 },
};

function rowToMarketToken(
  row: TokenCacheRow,
  sentiment?: { agentCount: number; bullishPercent: number },
  horizonSentiment?: Record<TimeHorizon, HorizonSentiment>,
): MarketToken {
  const sparkline7d: number[] = Array.isArray(row.sparkline_7d) ? row.sparkline_7d : [];
  const priceHistory48h =
    sparkline7d.length >= 48 ? sparkline7d.slice(-48) : sparkline7d;

  return {
    address: row.address,
    chain: row.chain,
    symbol: row.symbol,
    name: row.name,
    logoURI: row.logo_uri,
    decimals: row.decimals,
    price: Number(row.price),
    change24h: Number(row.change_24h),
    tags: row.tags,
    tvl: row.tvl != null ? Number(row.tvl) : null,
    volume24h: Number(row.volume_24h),
    marketCap: row.market_cap != null ? Number(row.market_cap) : null,
    agentCount: sentiment?.agentCount ?? 0,
    bullishPercent: sentiment?.bullishPercent ?? 50,
    sparkline7d,
    priceHistory48h,
    sentimentByHorizon: horizonSentiment ?? { ...defaultHorizonSentiment },
  };
}

// ---------- CoinGecko Direct Fetch (fallback when cache is empty) ----------

/**
 * Fetch tokens directly from CoinGecko + DeFi Llama and convert to MarketToken[].
 * Used as a fallback when the DB cache is empty (e.g. before first cron run).
 */
async function fetchFromCoinGeckoDirectly(
  sentimentMap: Map<string, { agentCount: number; bullishPercent: number }>,
  horizonMap?: Map<string, Record<TimeHorizon, HorizonSentiment>>,
): Promise<MarketToken[]> {
  const ecosystemTokens = await fetchSolanaEcosystemTokens();
  if (ecosystemTokens.length === 0) return [];

  const tvlMap = await fetchAllProtocolTVLs();
  const seenAddresses = new Set<string>();
  const tokens: MarketToken[] = [];

  for (const eco of ecosystemTokens) {
    const resolved = resolveSolanaAddress(eco.coingeckoId);
    if (!resolved) continue;
    if (seenAddresses.has(resolved.address)) continue;
    seenAddresses.add(resolved.address);

    const sentiment = sentimentMap.get(resolved.address);
    const tvl = tvlMap[eco.symbol.toUpperCase()] ?? null;
    const sparkline7d = eco.sparklineIn7d.length > 0
      ? eco.sparklineIn7d
      : [];
    const priceHistory48h = sparkline7d.length >= 48
      ? sparkline7d.slice(-48)
      : sparkline7d;

    tokens.push({
      address: resolved.address,
      symbol: eco.symbol.toUpperCase(),
      name: eco.name,
      logoURI: eco.image,
      decimals: resolved.decimals,
      price: eco.currentPrice,
      change24h: eco.priceChangePercentage24h,
      tags: inferTags(eco.coingeckoId, eco.symbol),
      tvl,
      volume24h: eco.totalVolume,
      marketCap: eco.marketCap || null,
      agentCount: sentiment?.agentCount ?? 0,
      bullishPercent: sentiment?.bullishPercent ?? 50,
      sparkline7d,
      priceHistory48h,
      sentimentByHorizon: horizonMap?.get(resolved.address) ?? { ...defaultHorizonSentiment },
    });
  }

  return tokens;
}

// ---------- Staleness ----------

/** Maximum age of cached data before it's considered stale (30 minutes) */
const MAX_CACHE_AGE_MS = 30 * 60 * 1000;

/**
 * Check if the token cache is stale by examining the most recent updated_at.
 * Returns true if the newest cache entry is older than MAX_CACHE_AGE_MS.
 */
function isCacheStale(rows: TokenCacheRow[]): boolean {
  if (rows.length === 0) return true;

  let newest = 0;
  for (const row of rows) {
    const ts = new Date(row.updated_at).getTime();
    if (ts > newest) newest = ts;
  }

  const ageMs = Date.now() - newest;
  if (ageMs > MAX_CACHE_AGE_MS) {
    console.warn(
      `[token-cache] Cache is stale: newest entry is ${Math.round(ageMs / 60000)} minutes old`
    );
    return true;
  }

  return false;
}

// ---------- Public API ----------

/**
 * Fetch all cached tokens with sentiment data merged.
 * Falls back to CoinGecko direct fetch when cache is empty or stale.
 */
export async function fetchCachedTokens(): Promise<MarketToken[]> {
  const supabase = createReadOnlyClient();

  const { data, error } = await supabase
    .from("token_cache")
    .select("*")
    .order("volume_24h", { ascending: false });

  // Fetch sentiment once — used by both DB path and CoinGecko fallback
  const [sentimentMap, horizonMap] = await Promise.all([
    fetchTokenSentiment(),
    fetchTokenSentimentByHorizon(),
  ]);

  if (error) {
    console.warn("[token-cache] DB read failed, falling back to CoinGecko:", error.message);
    return fetchFromCoinGeckoDirectly(sentimentMap, horizonMap);
  }

  if (!data || data.length === 0) {
    console.warn("[token-cache] Cache empty, falling back to CoinGecko direct fetch");
    return fetchFromCoinGeckoDirectly(sentimentMap, horizonMap);
  }

  const rows = data as unknown as TokenCacheRow[];

  // Check staleness — try CoinGecko first if cache is too old
  if (isCacheStale(rows)) {
    try {
      const fresh = await fetchFromCoinGeckoDirectly(sentimentMap, horizonMap);
      if (fresh.length > 0) return fresh;
    } catch {
      // CoinGecko also failed — fall through to stale cache with warning
      console.warn("[token-cache] CoinGecko fallback also failed, using stale cache");
    }
  }

  return rows.map((row) =>
    rowToMarketToken(row, sentimentMap.get(row.address), horizonMap.get(row.address)),
  );
}

/**
 * Fetch a single cached token by address and chain.
 */
export async function fetchCachedToken(
  address: string,
  chain: Chain = "solana",
): Promise<MarketToken | null> {
  const supabase = createReadOnlyClient();

  const { data, error } = await supabase
    .from("token_cache")
    .select("*")
    .eq("chain", chain)
    .eq("address", address)
    .single();

  if (error || !data) return null;

  const [sentimentMap, horizonMap] = await Promise.all([
    fetchTokenSentiment(),
    fetchTokenSentimentByHorizon(),
  ]);
  const row = data as unknown as TokenCacheRow;
  return rowToMarketToken(row, sentimentMap.get(row.address), horizonMap.get(row.address));
}

/**
 * Fetch a single cached token by symbol (case-insensitive), optionally filtered by chain.
 */
export async function fetchCachedTokenBySymbol(
  symbol: string,
  chain: Chain = "solana",
): Promise<MarketToken | null> {
  const supabase = createReadOnlyClient();

  const { data, error } = await supabase
    .from("token_cache")
    .select("*")
    .eq("chain", chain)
    .ilike("symbol", symbol)
    .limit(1)
    .single();

  if (error || !data) return null;

  const [sentimentMap, horizonMap] = await Promise.all([
    fetchTokenSentiment(),
    fetchTokenSentimentByHorizon(),
  ]);
  const row = data as unknown as TokenCacheRow;
  return rowToMarketToken(row, sentimentMap.get(row.address), horizonMap.get(row.address));
}

// ---------- Write API (for cron) ----------

export interface TokenCacheInput {
  address: string;
  chain?: Chain;
  coingeckoId: string | null;
  symbol: string;
  name: string;
  logoUri: string | null;
  decimals: number;
  price: number;
  change24h: number;
  tags: string[];
  tvl: number | null;
  volume24h: number;
  marketCap: number | null;
  sparkline7d: number[];
}

/**
 * Upsert tokens into the cache table.
 * Uses admin client (service role key) for write access.
 */
export async function upsertTokenCache(tokens: TokenCacheInput[]): Promise<number> {
  if (tokens.length === 0) return 0;

  const supabase = createAdminClient();

  const rows = tokens.map((t) => ({
    address: t.address,
    chain: t.chain ?? "solana",
    coingecko_id: t.coingeckoId,
    symbol: t.symbol,
    name: t.name,
    logo_uri: t.logoUri,
    decimals: t.decimals,
    price: t.price,
    change_24h: t.change24h,
    tags: t.tags,
    tvl: t.tvl,
    volume_24h: t.volume24h,
    market_cap: t.marketCap,
    sparkline_7d: t.sparkline7d,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("token_cache")
    .upsert(rows, { onConflict: "chain,address" });

  if (error) {
    console.error("[token-cache] upsertTokenCache error:", error.message);
    return 0;
  }

  return rows.length;
}
