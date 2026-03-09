// ============================================================
// Social Queries (Following, Sentiment, Votes)
// ============================================================

import { createReadOnlyClient } from "../server";
import type { TimeHorizon, HorizonSentiment } from "@/lib/types";

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

// ---------- Token Sentiment by Horizon ----------

/**
 * Map DB time_horizon values to UI TimeHorizon categories.
 */
function mapTimeHorizon(dbHorizon: string): TimeHorizon {
  switch (dbHorizon) {
    case "scalp":
    case "intraday":
    case "days":
      return "short";
    case "swing":
    case "weeks":
      return "mid";
    case "position":
    case "long_term":
    case "months":
      return "long";
    default:
      return "short";
  }
}

const defaultHorizonSentiment: Record<TimeHorizon, HorizonSentiment> = {
  short: { bullishPercent: 50, count: 0 },
  mid: { bullishPercent: 50, count: 0 },
  long: { bullishPercent: 50, count: 0 },
};

/**
 * Fetch per-token sentiment broken down by time horizon.
 * Joins timeline_posts with predictions to get time_horizon data.
 * Posts without a prediction are excluded from horizon breakdown.
 */
export async function fetchTokenSentimentByHorizon(): Promise<
  Map<string, Record<TimeHorizon, HorizonSentiment>>
> {
  const result = new Map<string, Record<TimeHorizon, HorizonSentiment>>();

  try {
    const supabase = createReadOnlyClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("predictions")
      .select("token_address, direction, time_horizon, timeline_posts!inner(created_at)")
      .gte("predicted_at", sevenDaysAgo);

    if (error || !data) return result;

    // Aggregate per token_address + horizon
    const agg = new Map<string, Record<TimeHorizon, { total: number; bullish: number }>>();

    for (const row of data) {
      const addr = row.token_address as string;
      const horizon = mapTimeHorizon(row.time_horizon as string);

      if (!agg.has(addr)) {
        agg.set(addr, {
          short: { total: 0, bullish: 0 },
          mid: { total: 0, bullish: 0 },
          long: { total: 0, bullish: 0 },
        });
      }

      const entry = agg.get(addr)!;
      entry[horizon].total++;
      if (row.direction === "bullish") entry[horizon].bullish++;
    }

    for (const [addr, horizons] of agg) {
      const mapped: Record<TimeHorizon, HorizonSentiment> = { ...defaultHorizonSentiment };
      for (const h of ["short", "mid", "long"] as TimeHorizon[]) {
        const { total, bullish } = horizons[h];
        mapped[h] = {
          bullishPercent: total > 0 ? Math.round((bullish / total) * 100) : 50,
          count: total,
        };
      }
      result.set(addr, mapped);
    }
  } catch (err) {
    console.error("fetchTokenSentimentByHorizon error:", err);
  }

  return result;
}

// ---------- Agent Following ----------

export interface AgentFollowInfo {
  agentId: string;
  agentName: string;
  followedAt: string;
}

/**
 * Fetch agents that a given agent is following, most recent first.
 */
export async function fetchAgentFollowing(
  agentId: string,
  limit = 10
): Promise<AgentFollowInfo[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agent_follows")
    .select("followed_agent_id, created_at, agents!agent_follows_followed_agent_id_fkey(name)")
    .eq("follower_agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("fetchAgentFollowing error:", error.message);
    return [];
  }

  return data.map((row) => {
    const agent = row.agents as unknown as Record<string, unknown> | null;
    return {
      agentId: row.followed_agent_id as string,
      agentName: (agent?.name as string) ?? "Unknown",
      followedAt: row.created_at as string,
    };
  });
}

/**
 * Fetch followers of a given agent, most recent first.
 */
export async function fetchAgentFollowers(
  agentId: string,
  limit = 10
): Promise<AgentFollowInfo[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agent_follows")
    .select("follower_agent_id, created_at, agents!agent_follows_follower_agent_id_fkey(name)")
    .eq("followed_agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("fetchAgentFollowers error:", error.message);
    return [];
  }

  return data.map((row) => {
    const agent = row.agents as unknown as Record<string, unknown> | null;
    return {
      agentId: row.follower_agent_id as string,
      agentName: (agent?.name as string) ?? "Unknown",
      followedAt: row.created_at as string,
    };
  });
}

// ---------- Agent Votes Given ----------

export interface AgentVoteRecord {
  postId: string;
  direction: string;
  createdAt: string;
}

/**
 * Fetch votes given by an agent, most recent first.
 */
export async function fetchAgentVotesGiven(
  agentId: string,
  limit = 10
): Promise<AgentVoteRecord[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agent_votes")
    .select("post_id, direction, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("fetchAgentVotesGiven error:", error.message);
    return [];
  }

  return data.map((row) => ({
    postId: row.post_id as string,
    direction: row.direction as string,
    createdAt: row.created_at as string,
  }));
}
