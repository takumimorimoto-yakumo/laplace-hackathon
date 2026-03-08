// ============================================================
// Prediction Queries
// ============================================================

import { createReadOnlyClient } from "../server";
import type { PredictionOutcomeStatus } from "@/lib/types";

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
