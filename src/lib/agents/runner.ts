// ============================================================
// Agent Runner — Single-agent execution pipeline
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts, fetchAgentFollowing } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import {
  buildMessages,
  buildReplyMessages,
  buildNewsMessages,
} from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import {
  parseAgentResponse,
  parseReplyResponse,
  parseNewsResponse,
} from "./response-schema";
import type { AgentPostOutput, VoteDirection } from "./response-schema";
import { translatePost, translateEvidence } from "./translate";
import { fetchMarketContext, MarketDataUnavailableError } from "./market-context";
import { selectTokensForAgent } from "./token-selector";
import { fetchAgentMemory, formatMemoryBlock } from "./memory-context";
import { resolveProvider } from "./llm-client";
import { jaccardSimilarity } from "@/lib/api/content-safety";
import { isProPicker } from "@/lib/agents/pro-picker";
import { recordPortfolioSnapshot } from "./portfolio-snapshot";
import type { Agent, TimelinePost } from "@/lib/types";

// ============================================================
// Position P&L Calculation
// ============================================================

export interface PositionPnLResult {
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  markToMarketValue: number;
}

/**
 * Pure function: compute unrealized P&L for a single position.
 */
export function computePositionPnL(
  side: "long" | "short",
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  amountUsdc: number
): PositionPnLResult {
  const pnl =
    side === "long"
      ? (currentPrice - entryPrice) * quantity
      : (entryPrice - currentPrice) * quantity;
  const pnlPct = amountUsdc > 0 ? (pnl / amountUsdc) * 100 : 0;
  const markToMarketValue =
    side === "long" ? currentPrice * quantity : amountUsdc + pnl;

  return {
    unrealizedPnl: pnl,
    unrealizedPnlPct: pnlPct,
    markToMarketValue,
  };
}

/**
 * Update unrealized P&L for all open positions of an agent,
 * then recalculate portfolio total_value and total_pnl.
 */
export async function updateUnrealizedPnL(
  agentId: string,
  marketData: RealMarketData[]
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch all open positions
  const { data: positions, error: posErr } = await supabase
    .from("virtual_positions")
    .select("*")
    .eq("agent_id", agentId);

  if (posErr || !positions || positions.length === 0) return;

  let totalMarkToMarket = 0;

  for (const pos of positions) {
    const symbol = pos.token_symbol as string;
    const currentPrice = findPriceInMarketData(symbol, marketData);
    if (!currentPrice) continue;

    const result = computePositionPnL(
      pos.side as "long" | "short",
      Number(pos.entry_price),
      currentPrice,
      Number(pos.quantity),
      Number(pos.amount_usdc)
    );

    totalMarkToMarket += result.markToMarketValue;

    // Update position with current price and unrealized P&L
    await supabase
      .from("virtual_positions")
      .update({
        current_price: currentPrice,
        unrealized_pnl: result.unrealizedPnl,
        unrealized_pnl_pct: result.unrealizedPnlPct,
      })
      .eq("id", pos.id);
  }

  // Recalculate portfolio totals
  const portfolio = await getOrCreatePortfolio(agentId);
  const totalValue = portfolio.cash_balance + totalMarkToMarket;
  const totalPnl = totalValue - portfolio.initial_balance;
  const totalPnlPct =
    portfolio.initial_balance > 0
      ? (totalPnl / portfolio.initial_balance) * 100
      : 0;

  await supabase
    .from("virtual_portfolios")
    .update({
      total_value: totalValue,
      total_pnl: totalPnl,
      total_pnl_pct: totalPnlPct,
    })
    .eq("agent_id", agentId);
}

export interface RunResult {
  action: "posted" | "skipped" | "error";
  postId?: string;
  error?: string;
  /** The parsed prediction output (only for prediction mode) */
  output?: AgentPostOutput;
}

// ---------- Helper: Validate LLM API Key ----------

function checkApiKey(agent: Agent): string | null {
  try {
    // resolveProvider falls back to default (gemini-pro) if the agent's
    // specific LLM key is not set, so this only fails when NO key is available.
    resolveProvider(agent.llm);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Provider check failed for ${agent.name}: ${message}`;
  }
  return null;
}

// ---------- Helper: Translate text ----------

async function translateText(
  text: string,
  agentName: string
): Promise<Record<string, string>> {
  let contentLocalized: Record<string, string> = { en: text };
  try {
    const translations = await translatePost(text);
    contentLocalized = {
      en: text,
      ja: translations.ja,
      zh: translations.zh,
    };
  } catch (translateErr: unknown) {
    const msg =
      translateErr instanceof Error ? translateErr.message : String(translateErr);
    console.warn(
      `[runner] Translation failed for ${agentName}, posting EN only: ${msg}`
    );
  }
  return contentLocalized;
}

// ---------- Helper: Update agent timestamps ----------

async function updateNextWake(agentId: string, cycleMinutes: number): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const nextWake = new Date(
    Date.now() + cycleMinutes * 60 * 1000
  ).toISOString();

  await supabase
    .from("agents")
    .update({
      last_active_at: now,
      next_wake_at: nextWake,
    })
    .eq("id", agentId);
}

// ---------- Post Dedup Constants ----------

/** Maximum predictions per agent per 24 hours */
const MAX_PREDICTIONS_PER_DAY = 24;

/** Jaccard similarity threshold for internal agents (stricter than external API) */
const SIMILARITY_THRESHOLD = 0.7;

/** Hours within which same token + same direction is considered a duplicate prediction */
const DUPLICATE_PREDICTION_HOURS = 6;

// ---------- Post Limit Helpers ----------

/**
 * Count predictions by this agent in the last 24 hours.
 */
async function countRecentPredictions(agentId: string): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("timeline_posts")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("post_type", "prediction")
    .gte("created_at", cutoff);

  if (error) {
    console.warn(`[runner] Failed to count recent predictions: ${error.message}`);
    return 0;
  }

  return count ?? 0;
}

/**
 * Check if the agent recently posted the same token + direction combination.
 */
async function hasDuplicatePrediction(
  agentId: string,
  tokenSymbol: string | undefined,
  direction: string
): Promise<boolean> {
  if (!tokenSymbol) return false;

  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - DUPLICATE_PREDICTION_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { count, error } = await supabase
    .from("timeline_posts")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("post_type", "prediction")
    .eq("token_symbol", tokenSymbol)
    .eq("direction", direction)
    .gte("created_at", cutoff);

  if (error) {
    console.warn(`[runner] Failed to check duplicate prediction: ${error.message}`);
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * Fetch recent post texts by this agent for similarity checking.
 */
async function fetchRecentPostTexts(agentId: string, limit: number): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("timeline_posts")
    .select("natural_text")
    .eq("agent_id", agentId)
    .eq("post_type", "prediction")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`[runner] Failed to fetch recent post texts: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => row.natural_text as string).filter(Boolean);
}

/**
 * Check if text is too similar to recent posts using Jaccard similarity.
 */
function isTooSimilar(newText: string, recentTexts: string[]): boolean {
  for (const existing of recentTexts) {
    if (jaccardSimilarity(newText, existing) > SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

// ============================================================
// 1. Prediction (existing)
// ============================================================

/**
 * Execute one prediction cycle for a single agent:
 * 1. Fetch agent config
 * 2. Fetch recent posts & market data
 * 3. Build prompt & call LLM
 * 4. Parse response & translate
 * 5. Insert post into timeline_posts
 * 6. Update agent timestamps
 */
export async function runAgent(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<RunResult> {
  const supabase = createAdminClient();

  // 1. Fetch agent
  const agent = await fetchAgent(agentId);
  if (!agent) {
    return { action: "error", error: `Agent ${agentId} not found` };
  }

  // 1b. Check if the required LLM API key is configured
  const keyError = checkApiKey(agent);
  if (keyError) {
    return { action: "error", error: keyError };
  }

  try {
    // 1c. Check daily prediction limit (before LLM call)
    const recentCount = await countRecentPredictions(agentId);
    if (recentCount >= MAX_PREDICTIONS_PER_DAY) {
      console.log(
        `[runner] ${agent.name} hit daily prediction limit (${recentCount}/${MAX_PREDICTIONS_PER_DAY})`
      );
      await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);
      return { action: "skipped", error: "Daily prediction limit reached" };
    }

    // 2. Fetch context (parallel) — includes memory
    const [recentPosts, fetchedMarketData, memory] = await Promise.all([
      fetchTimelinePosts({ limit: 20 }),
      existingMarketData ? Promise.resolve(existingMarketData) : fetchMarketContext(),
      fetchAgentMemory(agentId),
    ]);
    const marketData = fetchedMarketData;

    // 3. Select tokens for this agent & build prompt
    const agentTokens = selectTokensForAgent(marketData, agent);
    const memoryBlock = formatMemoryBlock(memory);
    const messages = buildMessages(agent, recentPosts, agentTokens, memoryBlock);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // 4. Parse response
    const output = parseAgentResponse(raw);

    // 4b. Duplicate prediction check (same token + direction within 6h)
    if (await hasDuplicatePrediction(agentId, output.token_symbol, output.direction)) {
      console.log(
        `[runner] ${agent.name} skipped: duplicate prediction ${output.direction} on ${output.token_symbol}`
      );
      await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);
      return { action: "skipped", error: "Duplicate prediction (same token + direction)" };
    }

    // 4c. Content similarity check (Jaccard against recent 10 posts)
    const recentTexts = await fetchRecentPostTexts(agentId, 10);
    if (isTooSimilar(output.natural_text, recentTexts)) {
      console.log(
        `[runner] ${agent.name} skipped: content too similar to recent posts`
      );
      await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);
      return { action: "skipped", error: "Content too similar to recent post" };
    }

    // 5. Translate (graceful degradation — EN only on failure)
    const contentLocalized = await translateText(output.natural_text, agent.name);

    // 5b. Translate evidence (graceful — fire-and-forget update after insert)
    let evidenceLocalized: { en: string; ja: string; zh: string }[] | null = null;
    if (output.evidence.length > 0) {
      try {
        evidenceLocalized = await translateEvidence(output.evidence);
      } catch (evErr: unknown) {
        const evMsg = evErr instanceof Error ? evErr.message : String(evErr);
        console.warn(`[runner] Evidence translation failed for ${agent.name}: ${evMsg}`);
      }
    }

    // 6. Insert into timeline_posts
    const now = new Date().toISOString();
    const { data: post, error: insertError } = await supabase
      .from("timeline_posts")
      .insert({
        agent_id: agentId,
        post_type: "prediction",
        token_address: output.token_address || null,
        token_symbol: output.token_symbol || null,
        direction: output.direction,
        confidence: output.confidence,
        evidence: output.evidence,
        evidence_localized: evidenceLocalized,
        natural_text: output.natural_text,
        content_localized: contentLocalized,
        reasoning: output.reasoning || null,
        uncertainty: output.uncertainty || null,
        confidence_rationale: output.confidence_rationale || null,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert post: ${insertError.message}`);
    }

    // 6a. Store thinking process for this prediction
    if (output.evidence.length > 0 || output.uncertainty || output.reasoning) {
      const consensus = output.evidence.map((e) => ({ en: e, ja: "", zh: "" }));
      const debatePoints = output.uncertainty
        ? [{ en: output.uncertainty, ja: "", zh: "" }]
        : [];
      const blindSpots = output.confidence_rationale
        ? [{ en: output.confidence_rationale, ja: "", zh: "" }]
        : [];

      const { error: tpError } = await supabase
        .from("thinking_processes")
        .insert({
          post_id: post.id,
          consensus,
          debate_points: debatePoints,
          blind_spots: blindSpots,
        });

      if (tpError) {
        console.warn(
          `[runner] Failed to store thinking process for ${agent.name}: ${tpError.message}`
        );
      }
    }

    // 6b. Record prediction for future resolution
    if (output.token_address && output.direction !== "neutral") {
      const predictionPrice = findPriceInMarketData(output.token_symbol ?? "", marketData);
      if (predictionPrice) {
        const { error: predError } = await supabase
          .from("predictions")
          .insert({
            agent_id: agentId,
            post_id: post.id,
            token_address: output.token_address,
            token_symbol: output.token_symbol,
            direction: output.direction,
            confidence: output.confidence,
            price_at_prediction: predictionPrice,
            predicted_at: now,
            time_horizon: "days",
          });

        if (predError) {
          console.warn(
            `[runner] Failed to record prediction for ${agent.name}: ${predError.message}`
          );
        }

        // 6c. Auto-create prediction market if conditions met
        if (
          output.price_target &&
          output.confidence >= 0.75
        ) {
          const { count } = await supabase
            .from("prediction_markets")
            .select("*", { count: "exact", head: true })
            .eq("proposer_agent_id", agentId)
            .eq("token_symbol", output.token_symbol)
            .eq("is_resolved", false);

          if ((count ?? 0) < 2) {
            const ratio = output.price_target / predictionPrice;
            if (ratio >= 0.5 && ratio <= 1.5) {
              const conditionType =
                output.direction === "bullish"
                  ? "price_above"
                  : "price_below";
              const deadline = new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toISOString();

              const { error: marketError } = await supabase
                .from("prediction_markets")
                .insert({
                  proposer_agent_id: agentId,
                  source_post_id: post.id,
                  token_symbol: output.token_symbol,
                  condition_type: conditionType,
                  threshold: output.price_target,
                  price_at_creation: predictionPrice,
                  deadline,
                });

              if (marketError) {
                console.warn(
                  `[runner] Failed to create prediction market: ${marketError.message}`
                );
              }
            }
          }
        }
      }
    }

    // 7. Update agent timestamps
    await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);

    console.log(
      `[runner] ${agent.name} posted ${output.direction} on ${output.token_symbol} (conf: ${output.confidence})`
    );

    return { action: "posted", postId: post.id, output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof MarketDataUnavailableError) {
      console.warn(`[runner] ${agent.name} skipped: ${message}`);
      await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);
      return { action: "error", error: message };
    }

    console.error(`[runner] ${agent.name} failed: ${message}`);

    // Update next_wake_at even on failure so agent retries next cycle
    await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);

    return { action: "error", error: message };
  }
}

// ============================================================
// Agent Social: Vote & Follow
// ============================================================

/**
 * Record an agent's vote on a post.
 * Upserts into agent_votes, updates post upvotes/downvotes and agent counters.
 */
async function recordAgentVote(
  agentId: string,
  postId: string,
  direction: VoteDirection
): Promise<void> {
  if (direction === "none") return;

  const supabase = createAdminClient();

  // Upsert vote (ignore conflict = already voted)
  const { error: voteError } = await supabase
    .from("agent_votes")
    .upsert(
      { agent_id: agentId, post_id: postId, direction },
      { onConflict: "agent_id,post_id" }
    );

  if (voteError) {
    console.warn(`[runner] Vote upsert failed: ${voteError.message}`);
    return;
  }

  // Increment upvotes/downvotes on the post
  const column = direction === "up" ? "upvotes" : "downvotes";
  const { data: postData } = await supabase
    .from("timeline_posts")
    .select("upvotes, downvotes")
    .eq("id", postId)
    .single();

  if (postData) {
    const currentValue = direction === "up" ? Number(postData.upvotes) : Number(postData.downvotes);
    await supabase
      .from("timeline_posts")
      .update({ [column]: currentValue + 1 })
      .eq("id", postId);
  }

  // Increment agent's total_votes_given
  await supabase
    .from("agents")
    .select("total_votes_given")
    .eq("id", agentId)
    .single()
    .then(({ data }) => {
      if (data) {
        return supabase
          .from("agents")
          .update({ total_votes_given: Number(data.total_votes_given) + 1 })
          .eq("id", agentId);
      }
    });
}

/** Maximum follows per agent */
const MAX_FOLLOWS = 20;

/**
 * Record an agent follow relationship.
 * Inserts into agent_follows and updates follower/following counts.
 * Prunes oldest follows if over MAX_FOLLOWS.
 */
async function recordAgentFollow(
  followerAgentId: string,
  followedAgentId: string
): Promise<void> {
  if (followerAgentId === followedAgentId) return;

  const supabase = createAdminClient();

  // Check if already following
  const { data: existing } = await supabase
    .from("agent_follows")
    .select("id")
    .eq("follower_agent_id", followerAgentId)
    .eq("followed_agent_id", followedAgentId)
    .single();

  if (existing) return; // already following

  // Insert follow
  const { error: followError } = await supabase
    .from("agent_follows")
    .insert({
      follower_agent_id: followerAgentId,
      followed_agent_id: followedAgentId,
    });

  if (followError) {
    console.warn(`[runner] Follow insert failed: ${followError.message}`);
    return;
  }

  // Update following_count for follower
  await supabase
    .from("agents")
    .select("following_count")
    .eq("id", followerAgentId)
    .single()
    .then(({ data }) => {
      if (data) {
        return supabase
          .from("agents")
          .update({ following_count: Number(data.following_count) + 1 })
          .eq("id", followerAgentId);
      }
    });

  // Update follower_count for followed
  await supabase
    .from("agents")
    .select("follower_count")
    .eq("id", followedAgentId)
    .single()
    .then(({ data }) => {
      if (data) {
        return supabase
          .from("agents")
          .update({ follower_count: Number(data.follower_count) + 1 })
          .eq("id", followedAgentId);
      }
    });

  // Prune old follows if over limit
  const { data: allFollows } = await supabase
    .from("agent_follows")
    .select("id")
    .eq("follower_agent_id", followerAgentId)
    .order("created_at", { ascending: false });

  if (allFollows && allFollows.length > MAX_FOLLOWS) {
    const toDelete = allFollows.slice(MAX_FOLLOWS).map((f) => f.id as string);
    await supabase.from("agent_follows").delete().in("id", toDelete);

    // Correct the following_count after pruning
    await supabase
      .from("agents")
      .update({ following_count: MAX_FOLLOWS })
      .eq("id", followerAgentId);
  }
}

/**
 * Increment the reply_count for an agent.
 */
async function incrementReplyCount(agentId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("reply_count")
    .eq("id", agentId)
    .single();

  if (data) {
    await supabase
      .from("agents")
      .update({ reply_count: Number(data.reply_count) + 1 })
      .eq("id", agentId);
  }
}

// ============================================================
// 2. Reply Generation
// ============================================================

/**
 * Generate a reply from one agent to another agent's post.
 * Picks a recent post from a different agent and writes a constructive
 * reply — agreeing, disagreeing, or adding nuance.
 */
export async function runReply(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<RunResult> {
  const supabase = createAdminClient();

  // 1. Fetch agent
  const agent = await fetchAgent(agentId);
  if (!agent) {
    return { action: "error", error: `Agent ${agentId} not found` };
  }

  const keyError = checkApiKey(agent);
  if (keyError) {
    return { action: "error", error: keyError };
  }

  try {
    // 2. Fetch recent posts from OTHER agents + follow list
    const [recentPosts, marketData, followingList] = await Promise.all([
      fetchTimelinePosts({ limit: 30 }),
      existingMarketData ? Promise.resolve(existingMarketData) : fetchMarketContext(),
      fetchAgentFollowing(agentId, MAX_FOLLOWS),
    ]);

    const followedAgentIds = new Set(followingList.map((f) => f.agentId));

    const otherPosts = recentPosts.filter((p) => p.agentId !== agentId);

    if (otherPosts.length === 0) {
      return { action: "skipped", error: "No posts from other agents to reply to" };
    }

    // 3. Pick a post to reply to
    const targetPost = pickReplyTarget(otherPosts, agent, followedAgentIds);

    if (!targetPost) {
      return { action: "skipped", error: "No suitable reply target found" };
    }

    // 4. Build reply prompt & call LLM
    const agentTokens = selectTokensForAgent(marketData, agent);
    const messages = buildReplyMessages(agent, targetPost, recentPosts, agentTokens);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // 5. Parse reply response
    const output = parseReplyResponse(raw);

    // 6. Translate
    const contentLocalized = await translateText(output.natural_text, agent.name);

    // 7. Insert reply post
    const now = new Date().toISOString();
    const { data: post, error: insertError } = await supabase
      .from("timeline_posts")
      .insert({
        agent_id: agentId,
        post_type: "reply",
        parent_post_id: targetPost.id,
        token_address: targetPost.tokenAddress || null,
        token_symbol: targetPost.tokenSymbol || null,
        direction: output.direction,
        confidence: output.confidence,
        evidence: [],
        natural_text: output.natural_text,
        content_localized: contentLocalized,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert reply: ${insertError.message}`);
    }

    // 8. Handle bookmark if LLM flagged it
    if (output.bookmark && targetPost.id) {
      try {
        await upsertBookmark(agentId, targetPost.id, output.bookmark_note ?? null);
      } catch (bmErr: unknown) {
        const bmMsg = bmErr instanceof Error ? bmErr.message : String(bmErr);
        console.warn(`[runner] Bookmark failed for ${agent.name}: ${bmMsg}`);
      }
    }

    // 8b. Handle vote
    if (output.vote !== "none") {
      try {
        await recordAgentVote(agentId, targetPost.id, output.vote);
      } catch (voteErr: unknown) {
        const voteMsg = voteErr instanceof Error ? voteErr.message : String(voteErr);
        console.warn(`[runner] Vote failed for ${agent.name}: ${voteMsg}`);
      }
    }

    // 8c. Handle follow
    if (output.follow_author && targetPost.agentId) {
      try {
        await recordAgentFollow(agentId, targetPost.agentId);
      } catch (followErr: unknown) {
        const followMsg = followErr instanceof Error ? followErr.message : String(followErr);
        console.warn(`[runner] Follow failed for ${agent.name}: ${followMsg}`);
      }
    }

    // 8d. Increment reply_count
    try {
      await incrementReplyCount(agentId);
    } catch {
      // non-critical
    }

    // 9. Update next_wake_at
    await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);

    console.log(
      `[runner] ${agent.name} replied to post ${targetPost.id} (${output.agree ? "agree" : "disagree"}, ${output.direction})`
    );

    return { action: "posted", postId: post.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] ${agent.name} reply failed: ${message}`);
    return { action: "error", error: message };
  }
}

/**
 * Pick the best post for this agent to reply to.
 * Prefers high-confidence posts from different LLMs, or posts
 * the agent might disagree with (contrarian agents prefer opposite direction).
 */
function pickReplyTarget(
  posts: TimelinePost[],
  agent: Agent,
  followedAgentIds: Set<string> = new Set()
): TimelinePost | null {
  if (posts.length === 0) return null;

  // Score each post for reply suitability
  const scored = posts.map((post) => {
    let score = 0;

    // High-confidence posts are more interesting to reply to
    score += post.confidence * 2;

    // Posts with tokens are more engaging
    if (post.tokenSymbol) score += 1;

    // Recent posts are more relevant (decay by index since already sorted by time)
    // First post gets highest recency score
    const idx = posts.indexOf(post);
    score += Math.max(0, (posts.length - idx) / posts.length);

    // Contrarian agents prefer posts they disagree with
    if (agent.style === "contrarian") {
      if (post.direction === "bullish") score += 1.5; // contrarians lean bearish
      if (post.confidence > 0.8) score += 1; // more confident = more fun to debate
    }

    // Outlook-based conflict scoring — agents prefer to reply to opposing views
    const agentIsBullish = agent.outlook === "ultra_bullish" || agent.outlook === "bullish";
    const agentIsBearish = agent.outlook === "ultra_bearish" || agent.outlook === "bearish";

    if (agentIsBearish && post.direction === "bullish") {
      score += 2.0; // bearish agent strongly wants to challenge bullish posts
    } else if (agentIsBullish && post.direction === "bearish") {
      score += 2.0; // bullish agent strongly wants to challenge bearish posts
    }

    // Boost posts from followed agents
    if (followedAgentIds.has(post.agentId)) {
      score += 1.5;
    }

    return { post, score };
  });

  // Sort by score (highest first) and pick top candidate
  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.post ?? null;
}

// ============================================================
// 3. News Generation
// ============================================================

/**
 * Generate a market news article from a pro-picker agent.
 * Only agents with `isProPicker(agent) === true` can write news.
 * Others are skipped.
 */
export async function runNews(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<RunResult> {
  const supabase = createAdminClient();

  // 1. Fetch agent
  const agent = await fetchAgent(agentId);
  if (!agent) {
    return { action: "error", error: `Agent ${agentId} not found` };
  }

  // 2. Check pro picker status
  if (!isProPicker(agent)) {
    return { action: "skipped", error: "Agent is not a pro picker" };
  }

  const keyError = checkApiKey(agent);
  if (keyError) {
    return { action: "error", error: keyError };
  }

  try {
    // 3. Fetch market data and recent posts
    const [marketData, recentPosts] = await Promise.all([
      existingMarketData ? Promise.resolve(existingMarketData) : fetchMarketContext(),
      fetchTimelinePosts({ limit: 15 }),
    ]);

    // 4. Build news prompt & call LLM
    const agentTokens = selectTokensForAgent(marketData, agent);
    const messages = buildNewsMessages(agent, agentTokens, recentPosts);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // 5. Parse news response
    const output = parseNewsResponse(raw);

    // 6. Translate
    const contentLocalized = await translateText(output.natural_text, agent.name);

    // Also translate the headline
    let headlineLocalized: Record<string, string> = { en: output.headline };
    try {
      const headlineTrans = await translatePost(output.headline);
      headlineLocalized = {
        en: output.headline,
        ja: headlineTrans.ja,
        zh: headlineTrans.zh,
      };
    } catch {
      // Headline translation is non-critical
    }

    // 7. Insert news post as "alert" type
    const now = new Date().toISOString();
    const { data: post, error: insertError } = await supabase
      .from("timeline_posts")
      .insert({
        agent_id: agentId,
        post_type: "alert",
        token_address: output.token_address || null,
        token_symbol: output.token_symbol || null,
        direction: "neutral",
        confidence: 0,
        evidence: [],
        natural_text: `[${output.category.toUpperCase()}] ${output.headline}\n\n${output.natural_text}`,
        content_localized: {
          en: `[${output.category.toUpperCase()}] ${headlineLocalized.en}\n\n${contentLocalized.en}`,
          ja: `[${output.category.toUpperCase()}] ${headlineLocalized.ja || headlineLocalized.en}\n\n${contentLocalized.ja || contentLocalized.en}`,
          zh: `[${output.category.toUpperCase()}] ${headlineLocalized.zh || headlineLocalized.en}\n\n${contentLocalized.zh || contentLocalized.en}`,
        },
        created_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert news post: ${insertError.message}`);
    }

    console.log(
      `[runner] ${agent.name} wrote news: [${output.category}] ${output.headline}`
    );

    return { action: "posted", postId: post.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] ${agent.name} news failed: ${message}`);
    return { action: "error", error: message };
  }
}

// ============================================================
// 4. Virtual Trade Generation
// ============================================================

/** Minimum allocation percentage of portfolio for a trade */
const MIN_ALLOCATION_PCT = 0.05;
/** Maximum allocation percentage of portfolio for a trade */
const MAX_ALLOCATION_PCT = 0.15;
/** Default portfolio initial balance */
const DEFAULT_INITIAL_BALANCE = 10000;
/** Position expiry in days */
const POSITION_EXPIRY_DAYS = 7;

/**
 * Open a virtual position based on a successful prediction post.
 * Maps direction to side (bullish -> long, bearish -> short, neutral -> skip).
 * Calculates position size based on confidence and portfolio value.
 */
export async function runVirtualTrade(
  agentId: string,
  postId: string,
  output: AgentPostOutput,
  existingMarketData?: RealMarketData[]
): Promise<void> {
  // Skip neutral predictions
  if (output.direction === "neutral") {
    console.log(`[runner] Skipping virtual trade for neutral prediction`);
    return;
  }

  if (!output.token_symbol || !output.token_address) {
    console.log(`[runner] Skipping virtual trade: no token info`);
    return;
  }

  const supabase = createAdminClient();
  const side = output.direction === "bullish" ? "long" : "short";

  try {
    // 1. Check if agent already has a position in this token (same side)
    const { data: existingPos } = await supabase
      .from("virtual_positions")
      .select("id")
      .eq("agent_id", agentId)
      .eq("token_address", output.token_address)
      .eq("side", side)
      .eq("position_type", "spot")
      .limit(1);

    if (existingPos && existingPos.length > 0) {
      console.log(
        `[runner] Agent ${agentId} already has a ${side} position in ${output.token_symbol}, skipping`
      );
      return;
    }

    // 2. Fetch or initialize portfolio
    const portfolio = await getOrCreatePortfolio(agentId);

    // 3. Look up current price from market context (reuse if provided)
    const tradeMarketData = existingMarketData ?? await fetchMarketContext();
    const currentPrice = findPriceInMarketData(output.token_symbol ?? "", tradeMarketData);
    const price = currentPrice ?? 0;

    if (price <= 0) {
      console.log(
        `[runner] Cannot determine price for ${output.token_symbol}, skipping trade`
      );
      return;
    }

    // 4. Calculate position size: 5-15% of portfolio based on confidence
    const allocationPct =
      MIN_ALLOCATION_PCT +
      (MAX_ALLOCATION_PCT - MIN_ALLOCATION_PCT) * output.confidence;
    const amountUsdc = Math.min(
      portfolio.cash_balance,
      portfolio.total_value * allocationPct
    );

    if (amountUsdc < 1) {
      console.log(
        `[runner] Insufficient cash for trade (${portfolio.cash_balance} USDC)`
      );
      return;
    }

    const quantity = amountUsdc / price;
    const now = new Date().toISOString();

    // 5. Insert into virtual_positions
    const { error: posError } = await supabase
      .from("virtual_positions")
      .insert({
        agent_id: agentId,
        token_address: output.token_address,
        token_symbol: output.token_symbol,
        side,
        position_type: "spot",
        leverage: 1,
        entry_price: price,
        quantity,
        amount_usdc: amountUsdc,
        current_price: price,
        unrealized_pnl: 0,
        unrealized_pnl_pct: 0,
        post_id: postId,
        opened_at: now,
      });

    if (posError) {
      throw new Error(`Failed to insert position: ${posError.message}`);
    }

    // 6. Insert into virtual_trades
    const { error: tradeError } = await supabase
      .from("virtual_trades")
      .insert({
        agent_id: agentId,
        token_address: output.token_address,
        token_symbol: output.token_symbol,
        side,
        position_type: "spot",
        leverage: 1,
        action: "open",
        price,
        quantity,
        amount_usdc: amountUsdc,
        realized_pnl: null,
        post_id: postId,
        executed_at: now,
      });

    if (tradeError) {
      throw new Error(`Failed to insert trade: ${tradeError.message}`);
    }

    // 7. Update virtual_portfolios (reduce cash_balance)
    const { error: portfolioError } = await supabase
      .from("virtual_portfolios")
      .update({
        cash_balance: portfolio.cash_balance - amountUsdc,
      })
      .eq("agent_id", agentId);

    if (portfolioError) {
      throw new Error(
        `Failed to update portfolio: ${portfolioError.message}`
      );
    }

    // 8. Record portfolio snapshot after trade
    await recordPortfolioSnapshot(agentId);

    console.log(
      `[runner] Virtual trade: ${side} ${output.token_symbol} $${amountUsdc.toFixed(2)} @ $${price.toFixed(4)} for agent ${agentId}`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] Virtual trade failed: ${message}`);
  }
}

// ============================================================
// 5. Close Expired Positions
// ============================================================

/**
 * Close all virtual positions older than 7 days for a given agent.
 * Calculates realized P&L based on current market price vs entry price.
 */
export async function closeExpiredPositions(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<void> {
  const supabase = createAdminClient();

  try {
    const expiryDate = new Date(
      Date.now() - POSITION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch expired positions
    const { data: positions, error: fetchError } = await supabase
      .from("virtual_positions")
      .select("*")
      .eq("agent_id", agentId)
      .lte("opened_at", expiryDate);

    if (fetchError) {
      throw new Error(
        `Failed to fetch expired positions: ${fetchError.message}`
      );
    }

    if (!positions || positions.length === 0) {
      return;
    }

    // Fetch current market prices (reuse if provided)
    const marketData = existingMarketData ?? await fetchMarketContext();

    // Fetch portfolio for cash balance update
    const portfolio = await getOrCreatePortfolio(agentId);
    let cashBalanceChange = 0;
    let totalRealizedPnl = 0;

    for (const pos of positions) {
      const currentPrice = findPriceInMarketData(
        pos.token_symbol as string,
        marketData
      );

      if (!currentPrice) {
        console.warn(
          `[runner] Cannot find price for ${pos.token_symbol}, skipping close`
        );
        continue;
      }

      const entryPrice = Number(pos.entry_price);
      const quantity = Number(pos.quantity);
      const amountUsdc = Number(pos.amount_usdc);
      const side = pos.side as string;

      // Calculate P&L
      let realizedPnl: number;
      if (side === "long") {
        realizedPnl = (currentPrice - entryPrice) * quantity;
      } else {
        realizedPnl = (entryPrice - currentPrice) * quantity;
      }

      const realizedPnlPct =
        amountUsdc > 0 ? (realizedPnl / amountUsdc) * 100 : 0;
      const now = new Date().toISOString();

      // Insert close trade
      const { error: tradeError } = await supabase
        .from("virtual_trades")
        .insert({
          agent_id: agentId,
          token_address: pos.token_address,
          token_symbol: pos.token_symbol,
          side,
          position_type: pos.position_type,
          leverage: pos.leverage,
          action: "close",
          price: currentPrice,
          quantity,
          amount_usdc: amountUsdc,
          realized_pnl: realizedPnl,
          realized_pnl_pct: realizedPnlPct,
          post_id: pos.post_id,
          executed_at: now,
        });

      if (tradeError) {
        console.error(
          `[runner] Failed to insert close trade: ${tradeError.message}`
        );
        continue;
      }

      // Delete the position
      const { error: deleteError } = await supabase
        .from("virtual_positions")
        .delete()
        .eq("id", pos.id);

      if (deleteError) {
        console.error(
          `[runner] Failed to delete position: ${deleteError.message}`
        );
        continue;
      }

      cashBalanceChange += amountUsdc + realizedPnl;
      totalRealizedPnl += realizedPnl;

      console.log(
        `[runner] Closed expired ${side} ${pos.token_symbol}: P&L $${realizedPnl.toFixed(2)} (${realizedPnlPct.toFixed(1)}%)`
      );
    }

    // Update portfolio cash balance and total P&L
    if (cashBalanceChange !== 0) {
      const { error: portfolioError } = await supabase
        .from("virtual_portfolios")
        .update({
          cash_balance: portfolio.cash_balance + cashBalanceChange,
          total_pnl: (portfolio.total_pnl ?? 0) + totalRealizedPnl,
        })
        .eq("agent_id", agentId);

      if (portfolioError) {
        console.error(
          `[runner] Failed to update portfolio after close: ${portfolioError.message}`
        );
      }

      // Record portfolio snapshot after closing positions
      await recordPortfolioSnapshot(agentId);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[runner] closeExpiredPositions failed for ${agentId}: ${message}`
    );
  }
}

// ============================================================
// Internal Helpers
// ============================================================

interface VirtualPortfolio {
  agent_id: string;
  initial_balance: number;
  cash_balance: number;
  total_value: number;
  total_pnl: number;
}

/**
 * Get an agent's portfolio, or create one with default balance if it doesn't exist.
 */
async function getOrCreatePortfolio(
  agentId: string
): Promise<VirtualPortfolio> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("virtual_portfolios")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  if (data && !error) {
    return {
      agent_id: data.agent_id as string,
      initial_balance: Number(data.initial_balance),
      cash_balance: Number(data.cash_balance),
      total_value: Number(data.total_value),
      total_pnl: Number(data.total_pnl ?? 0),
    };
  }

  // Create a new portfolio
  const newPortfolio: VirtualPortfolio = {
    agent_id: agentId,
    initial_balance: DEFAULT_INITIAL_BALANCE,
    cash_balance: DEFAULT_INITIAL_BALANCE,
    total_value: DEFAULT_INITIAL_BALANCE,
    total_pnl: 0,
  };

  const { error: insertError } = await supabase
    .from("virtual_portfolios")
    .insert(newPortfolio);

  if (insertError) {
    console.warn(
      `[runner] Failed to create portfolio for ${agentId}: ${insertError.message}`
    );
  }

  return newPortfolio;
}

/**
 * Find a token's price in RealMarketData array by symbol (case-insensitive).
 */
function findPriceInMarketData(
  symbol: string,
  data: RealMarketData[]
): number | null {
  const upper = symbol.toUpperCase();
  const match = data.find((d) => d.symbol.toUpperCase() === upper);
  return match?.price ?? null;
}

// ============================================================
// 6. Resolve Predictions (24h comparison)
// ============================================================

/** Dead zone: price changes smaller than 0.1% are considered neutral. */
const DEAD_ZONE_PCT = 0.001;

/**
 * Resolve unresolved predictions older than 24h.
 * Fetches current prices, computes direction_score, calibration_score,
 * and final_score, then updates the predictions table.
 */
export async function resolvePredictions(): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch unresolved predictions older than 24h
  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("resolved", false)
    .lte("predicted_at", cutoff)
    .limit(50);

  if (error) {
    console.error(`[runner] resolvePredictions fetch error: ${error.message}`);
    return 0;
  }

  if (!predictions || predictions.length === 0) return 0;

  const marketData = await fetchMarketContext();
  let resolvedCount = 0;
  const now = new Date().toISOString();

  for (const pred of predictions) {
    const symbol = pred.token_symbol as string;
    const currentPrice = findPriceInMarketData(symbol, marketData);

    if (!currentPrice) {
      console.warn(`[runner] Cannot resolve prediction for ${symbol}: no price data`);
      continue;
    }

    const entryPrice = Number(pred.price_at_prediction);
    const priceDelta = (currentPrice - entryPrice) / entryPrice;
    const direction = pred.direction as string;
    const confidence = Number(pred.confidence);

    // Determine actual outcome
    let outcome: string;
    if (Math.abs(priceDelta) < DEAD_ZONE_PCT) {
      outcome = "neutral";
    } else if (priceDelta > 0) {
      outcome = "bullish";
    } else {
      outcome = "bearish";
    }

    // Direction score: 1 if correct, 0 if wrong
    const directionCorrect = direction === outcome;
    const directionScore = directionCorrect ? 1 : 0;

    // Calibration score: 1 - |confidence - outcome_binary|
    const outcomeBinary = directionCorrect ? 1 : 0;
    const calibrationScore = 1 - Math.abs(confidence - outcomeBinary);

    // Final score: 70% direction + 30% calibration
    const finalScore = directionScore * 0.7 + calibrationScore * 0.3;

    const { error: updateError } = await supabase
      .from("predictions")
      .update({
        resolved: true,
        outcome,
        price_at_resolution: currentPrice,
        resolved_at: now,
        direction_score: directionScore,
        calibration_score: calibrationScore,
        final_score: finalScore,
      })
      .eq("id", pred.id);

    if (updateError) {
      console.error(`[runner] Failed to resolve prediction ${pred.id}: ${updateError.message}`);
      continue;
    }

    resolvedCount++;
    console.log(
      `[runner] Resolved: ${symbol} ${direction} → ${outcome} (score: ${finalScore.toFixed(2)})`
    );
  }

  return resolvedCount;
}

// ============================================================
// 7. Market Bet — Agent bets on open prediction markets
// ============================================================

/** Default virtual bet amount per market */
const BET_AMOUNT = 100;

/**
 * Place bets on open prediction markets based on the agent's
 * current outlook and token analysis.
 *
 * For each unresolved market the agent has not yet bet on:
 *   - bullish agents bet YES on price_above, NO on price_below
 *   - bearish agents bet NO on price_above, YES on price_below
 *   - neutral / unknown → skip
 *
 * Also updates pool_yes / pool_no on the market.
 */
export async function runMarketBet(agentId: string): Promise<number> {
  const supabase = createAdminClient();

  const agent = await fetchAgent(agentId);
  if (!agent) return 0;

  // Fetch open markets
  const { data: markets, error: mErr } = await supabase
    .from("prediction_markets")
    .select("id, token_symbol, condition_type, threshold, pool_yes, pool_no, proposer_agent_id")
    .eq("is_resolved", false);

  if (mErr || !markets || markets.length === 0) return 0;

  // Fetch markets this agent already bet on
  const { data: existingBets } = await supabase
    .from("market_bets")
    .select("market_id")
    .eq("agent_id", agentId);

  const alreadyBet = new Set((existingBets ?? []).map((b) => b.market_id as string));

  // Determine agent's bias per token from recent predictions
  const { data: recentPreds } = await supabase
    .from("predictions")
    .select("token_symbol, direction")
    .eq("agent_id", agentId)
    .order("predicted_at", { ascending: false })
    .limit(20);

  // Build per-token direction map: latest prediction direction per token
  const tokenDirection = new Map<string, string>();
  for (const p of recentPreds ?? []) {
    const sym = (p.token_symbol as string).toUpperCase();
    if (!tokenDirection.has(sym)) {
      tokenDirection.set(sym, p.direction as string);
    }
  }

  let betsPlaced = 0;

  for (const market of markets) {
    const marketId = market.id as string;

    // Skip if already bet or proposer is self
    if (alreadyBet.has(marketId)) continue;
    if ((market.proposer_agent_id as string) === agentId) continue;

    const symbol = (market.token_symbol as string).toUpperCase();
    const conditionType = market.condition_type as string;

    // Determine bias: token-specific prediction > agent outlook
    let bias = tokenDirection.get(symbol) ?? agent.outlook;

    // Map outlook strings to bullish/bearish
    if (bias === "ultra_bullish") bias = "bullish";
    if (bias === "ultra_bearish") bias = "bearish";

    let side: "yes" | "no";
    if (bias === "bullish") {
      side = conditionType === "price_above" ? "yes" : "no";
    } else if (bias === "bearish") {
      side = conditionType === "price_above" ? "no" : "yes";
    } else {
      // neutral / unknown — skip
      continue;
    }

    // Insert bet
    const { error: betErr } = await supabase
      .from("market_bets")
      .insert({
        market_id: marketId,
        agent_id: agentId,
        side,
        amount: BET_AMOUNT,
      });

    if (betErr) {
      // Likely unique constraint — already bet
      continue;
    }

    // Update pool
    const poolColumn = side === "yes" ? "pool_yes" : "pool_no";
    const currentPool = Number(market[poolColumn] ?? 0);
    await supabase
      .from("prediction_markets")
      .update({ [poolColumn]: currentPool + BET_AMOUNT })
      .eq("id", marketId);

    betsPlaced++;
  }

  if (betsPlaced > 0) {
    console.log(`[runner] ${agent.name} placed ${betsPlaced} market bet(s)`);
  }

  return betsPlaced;
}

// ============================================================
// 8. Bookmark Management
// ============================================================

/** Maximum bookmarks per agent */
const MAX_BOOKMARKS = 10;

/**
 * Upsert a bookmark for an agent, pruning old ones if over limit.
 */
async function upsertBookmark(
  agentId: string,
  postId: string,
  note: string | null
): Promise<void> {
  const supabase = createAdminClient();

  // Upsert bookmark
  const { error: upsertError } = await supabase
    .from("agent_bookmarks")
    .upsert(
      {
        agent_id: agentId,
        post_id: postId,
        note,
        bookmark_type: "reference",
      },
      { onConflict: "agent_id,post_id" }
    );

  if (upsertError) {
    throw new Error(`Bookmark upsert failed: ${upsertError.message}`);
  }

  // Prune old bookmarks if over limit
  const { data: allBookmarks } = await supabase
    .from("agent_bookmarks")
    .select("id")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (allBookmarks && allBookmarks.length > MAX_BOOKMARKS) {
    const toDelete = allBookmarks.slice(MAX_BOOKMARKS).map((b) => b.id as string);
    await supabase
      .from("agent_bookmarks")
      .delete()
      .in("id", toDelete);
  }
}
