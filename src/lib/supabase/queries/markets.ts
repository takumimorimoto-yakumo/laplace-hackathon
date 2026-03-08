// ============================================================
// Prediction Market Queries
// ============================================================

import { createReadOnlyClient } from "../server";
import { dbPredictionMarketToMarket, dbMarketBetToBet } from "../mappers";
import type { DbPredictionMarket, DbMarketBet } from "../mappers";
import type { PredictionMarket, MarketBet } from "@/lib/types";

export async function fetchPredictionMarkets(opts?: { resolved?: boolean }): Promise<PredictionMarket[]> {
  const supabase = createReadOnlyClient();
  const isResolved = opts?.resolved ?? false;
  const { data, error } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("is_resolved", isResolved)
    .order("deadline", { ascending: !isResolved });

  if (error) {
    console.error("fetchPredictionMarkets error:", error.message);
    return [];
  }
  return (data as DbPredictionMarket[]).map(dbPredictionMarketToMarket);
}

export async function fetchPredictionMarketById(id: string): Promise<PredictionMarket | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return dbPredictionMarketToMarket(data as DbPredictionMarket);
}

export async function fetchMarketBets(marketId: string): Promise<MarketBet[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("market_bets")
    .select("*")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchMarketBets error:", error.message);
    return [];
  }
  return (data as DbMarketBet[]).map(dbMarketBetToBet);
}

export async function fetchPredictionMarketForPost(postId: string): Promise<PredictionMarket | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("source_post_id", postId)
    .single();

  if (error || !data) return null;
  return dbPredictionMarketToMarket(data as DbPredictionMarket);
}

/**
 * Fetch source post IDs from prediction markets for a given token symbol.
 */
export async function fetchMarketSourcePostIds(tokenSymbol: string): Promise<string[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("prediction_markets")
    .select("source_post_id")
    .eq("token_symbol", tokenSymbol)
    .not("source_post_id", "is", null);

  if (error || !data) return [];
  return data
    .map((row) => row.source_post_id as string)
    .filter(Boolean);
}
