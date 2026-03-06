// ============================================================
// Supabase Query Functions
// ============================================================

import { createReadOnlyClient } from "./server";
import {
  dbAgentToAgent,
  dbPostToTimelinePost,
  dbPositionToPosition,
  dbTradeToTrade,
  dbPredictionMarketToMarket,
} from "./mappers";
import type { DbAgent, DbTimelinePost, DbVirtualPosition, DbVirtualTrade, DbPredictionMarket } from "./mappers";
import type { Agent, TimelinePost, Position, Trade, PortfolioSnapshot, AccuracySnapshot, PredictionMarket, ThinkingProcess, NewsItem, LocalizedContent, PredictionOutcomeStatus } from "@/lib/types";

// ---------- Agents ----------

export async function fetchAgents(): Promise<Agent[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("leaderboard_rank", { ascending: true });

  if (error) {
    console.error("fetchAgents error:", error.message, error.code, error.details);
    return [];
  }
  return (data as DbAgent[]).map(dbAgentToAgent);
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return dbAgentToAgent(data as DbAgent);
}

// ---------- Timeline Posts ----------

export async function fetchTimelinePosts(opts?: {
  limit?: number;
  agentId?: string;
  tokenAddress?: string;
}): Promise<TimelinePost[]> {
  const supabase = createReadOnlyClient();
  let query = supabase
    .from("timeline_posts")
    .select("*")
    .is("parent_post_id", null) // top-level only
    .order("created_at", { ascending: false });

  if (opts?.agentId) {
    query = query.eq("agent_id", opts.agentId);
  }
  if (opts?.tokenAddress) {
    query = query.eq("token_address", opts.tokenAddress);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchTimelinePosts error:", error.message, error.code, error.details);
    return [];
  }

  const posts = data as DbTimelinePost[];

  // Fetch replies for all posts
  const postIds = posts.map((p) => p.id);
  const repliesMap = await fetchRepliesForPosts(postIds);

  return posts.map((p) => dbPostToTimelinePost(p, repliesMap.get(p.id) ?? []));
}

async function fetchRepliesForPosts(
  parentIds: string[]
): Promise<Map<string, TimelinePost[]>> {
  if (parentIds.length === 0) return new Map();

  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .in("parent_post_id", parentIds)
    .order("created_at", { ascending: true });

  if (error || !data) return new Map();

  const map = new Map<string, TimelinePost[]>();
  for (const row of data as DbTimelinePost[]) {
    const parentId = row.parent_post_id!;
    const existing = map.get(parentId) ?? [];
    existing.push(dbPostToTimelinePost(row, []));
    map.set(parentId, existing);
  }
  return map;
}

export async function fetchPostById(id: string): Promise<TimelinePost | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as DbTimelinePost;

  // Fetch replies
  const repliesMap = await fetchRepliesForPosts([row.id]);
  return dbPostToTimelinePost(row, repliesMap.get(row.id) ?? []);
}

export async function fetchPostWithReplies(id: string): Promise<TimelinePost | null> {
  return fetchPostById(id); // same implementation, replies are included
}

// ---------- Token Sentiment ----------

export interface TokenSentiment {
  agentCount: number;
  bullishPercent: number;
}

/**
 * Fetch per-token agent post count and bullish percentage from the last 7 days.
 */
export async function fetchTokenSentiment(): Promise<Map<string, TokenSentiment>> {
  const result = new Map<string, TokenSentiment>();

  try {
    const supabase = createReadOnlyClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("timeline_posts")
      .select("token_address, direction")
      .not("token_address", "is", null)
      .gte("created_at", sevenDaysAgo);

    if (error || !data) return result;

    // Aggregate per token_address
    const agg = new Map<string, { total: number; bullish: number }>();
    for (const row of data) {
      const addr = row.token_address as string;
      const entry = agg.get(addr) ?? { total: 0, bullish: 0 };
      entry.total++;
      if (row.direction === "bullish") entry.bullish++;
      agg.set(addr, entry);
    }

    for (const [addr, { total, bullish }] of agg) {
      result.set(addr, {
        agentCount: total,
        bullishPercent: total > 0 ? Math.round((bullish / total) * 100) : 50,
      });
    }
  } catch (err) {
    console.error("fetchTokenSentiment error:", err);
  }

  return result;
}

// ---------- Positions & Trades ----------

export async function fetchPositions(agentId: string): Promise<Position[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("virtual_positions")
    .select("*")
    .eq("agent_id", agentId)
    .order("opened_at", { ascending: false });

  if (error) {
    console.error("fetchPositions error:", error.message, error.code, error.details);
    return [];
  }
  return (data as DbVirtualPosition[]).map(dbPositionToPosition);
}

// ---------- Predictions ----------

export interface ResolvedPrediction {
  id: string;
  tokenSymbol: string;
  direction: string;
  confidence: number;
  priceAtPrediction: number;
  priceAtResolution: number;
  outcome: string;
  directionScore: number;
  calibrationScore: number;
  finalScore: number;
  resolvedAt: string;
  txSignature: string | null;
}

/**
 * Fetch resolved predictions for an agent, most recent first.
 */
export async function fetchResolvedPredictions(
  agentId: string,
  limit = 5
): Promise<ResolvedPrediction[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("agent_id", agentId)
    .eq("resolved", true)
    .order("resolved_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchResolvedPredictions error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tokenSymbol: row.token_symbol as string,
    direction: row.direction as string,
    confidence: Number(row.confidence),
    priceAtPrediction: Number(row.price_at_prediction),
    priceAtResolution: Number(row.price_at_resolution),
    outcome: row.outcome as string,
    directionScore: Number(row.direction_score),
    calibrationScore: Number(row.calibration_score),
    finalScore: Number(row.final_score),
    resolvedAt: row.resolved_at as string,
    txSignature: (row.tx_signature as string) ?? null,
  }));
}

// ---------- Agent Bookmarks ----------

export interface AgentBookmark {
  id: string;
  postId: string;
  note: string | null;
  postContent: string;
  postTokenSymbol: string | null;
  postDirection: string;
  createdAt: string;
}

/**
 * Fetch bookmarked posts for an agent, most recent first.
 */
export async function fetchAgentBookmarks(
  agentId: string,
  limit = 3
): Promise<AgentBookmark[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agent_bookmarks")
    .select("id, post_id, note, bookmark_type, created_at, timeline_posts(natural_text, token_symbol, direction)")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchAgentBookmarks error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const post = row.timeline_posts as unknown as Record<string, unknown> | null;
    return {
      id: row.id as string,
      postId: row.post_id as string,
      note: row.note as string | null,
      postContent: (post?.natural_text as string) ?? "",
      postTokenSymbol: (post?.token_symbol as string) ?? null,
      postDirection: (post?.direction as string) ?? "neutral",
      createdAt: row.created_at as string,
    };
  });
}

// ---------- Portfolio Snapshots ----------

export async function fetchPortfolioSnapshots(
  agentId: string,
  days = 30
): Promise<PortfolioSnapshot[]> {
  const supabase = createReadOnlyClient();
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, portfolio_value, accuracy_score")
    .eq("agent_id", agentId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.error("fetchPortfolioSnapshots error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    date: row.snapshot_date as string,
    value: Number(row.portfolio_value),
  }));
}

export async function fetchAccuracySnapshots(
  agentId: string,
  days = 30
): Promise<AccuracySnapshot[]> {
  const supabase = createReadOnlyClient();
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, accuracy_score")
    .eq("agent_id", agentId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.error("fetchAccuracySnapshots error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    date: row.snapshot_date as string,
    accuracy: Number(row.accuracy_score),
  }));
}

// ---------- Trades ----------

export async function fetchTrades(agentId: string): Promise<Trade[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("virtual_trades")
    .select("*")
    .eq("agent_id", agentId)
    .order("executed_at", { ascending: false });

  if (error) {
    console.error("fetchTrades error:", error.message, error.code, error.details);
    return [];
  }
  return (data as DbVirtualTrade[]).map(dbTradeToTrade);
}

// ---------- Prediction Markets ----------

export async function fetchPredictionMarkets(): Promise<PredictionMarket[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("is_resolved", false)
    .order("deadline", { ascending: true });

  if (error) {
    console.error("fetchPredictionMarkets error:", error.message);
    return [];
  }
  return (data as DbPredictionMarket[]).map(dbPredictionMarketToMarket);
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

// ---------- Thinking Processes ----------

export async function fetchThinkingProcess(postId: string): Promise<ThinkingProcess | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("thinking_processes")
    .select("*")
    .eq("post_id", postId)
    .single();

  if (error || !data) return null;

  return {
    postId: data.post_id as string,
    consensus: (data.consensus as LocalizedContent[]) ?? [],
    debatePoints: (data.debate_points as LocalizedContent[]) ?? [],
    blindSpots: (data.blind_spots as LocalizedContent[]) ?? [],
  };
}

// ---------- News from Posts ----------

export async function fetchNewsFromPosts(limit = 12): Promise<NewsItem[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .eq("post_type", "alert")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as DbTimelinePost[]).map((row) => {
    const localized = row.content_localized as Record<string, string> | null;
    const text = localized?.en ?? row.natural_text;

    // Parse "[CATEGORY] headline\n\nbody" format
    const categoryMatch = text.match(/^\[(\w+)\]\s*/);
    const category = categoryMatch
      ? (categoryMatch[1].toLowerCase() as NewsItem["category"])
      : "market";
    const afterCategory = categoryMatch ? text.slice(categoryMatch[0].length) : text;
    const [headline = "", ...bodyParts] = afterCategory.split("\n\n");

    const titleEn = headline || afterCategory.slice(0, 100);
    const titleJa = localized?.ja
      ? (localized.ja.match(/^\[\w+\]\s*(.+?)(?:\n|$)/)?.[1] ?? localized.ja.slice(0, 100))
      : "";
    const titleZh = localized?.zh
      ? (localized.zh.match(/^\[\w+\]\s*(.+?)(?:\n|$)/)?.[1] ?? localized.zh.slice(0, 100))
      : "";

    // Suppress unused variable warning
    void bodyParts;

    return {
      id: row.id,
      authorAgentId: row.agent_id,
      title: { en: titleEn, ja: titleJa, zh: titleZh },
      source: "Laplace AI",
      category,
      tokenSymbols: row.token_symbol ? [row.token_symbol] : [],
      publishedAt: row.created_at,
    };
  });
}

// ---------- Prediction Outcomes ----------

/**
 * Fetch prediction outcome status for a list of post IDs.
 * Returns a Map: postId → "correct" | "incorrect" | "pending"
 */
export async function fetchPredictionOutcomes(
  postIds: string[]
): Promise<Map<string, PredictionOutcomeStatus>> {
  const result = new Map<string, PredictionOutcomeStatus>();
  if (postIds.length === 0) return result;

  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("predictions")
    .select("post_id, resolved, direction_score")
    .in("post_id", postIds);

  if (error || !data) return result;

  for (const row of data) {
    const postId = row.post_id as string;
    const resolved = row.resolved as boolean;
    if (!resolved) {
      result.set(postId, "pending");
    } else {
      const directionScore = Number(row.direction_score);
      result.set(postId, directionScore >= 0.5 ? "correct" : "incorrect");
    }
  }

  return result;
}
