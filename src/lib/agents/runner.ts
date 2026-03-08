// ============================================================
// Agent Runner — Single-agent execution pipeline
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts, fetchAgentFollowing, fetchPredictionMarkets } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import {
  buildMessages,
  buildReplyMessages,
  buildNewsMessages,
  buildBrowseMessages,
  buildCustomAnalysisMessages,
  buildPricingMessages,
} from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import {
  parseAgentResponse,
  parseReplyResponse,
  parseNewsResponse,
  parseBrowseResponse,
  parsePricingResponse,
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
  let contentLocalized: Record<string, string> = { en: text, ja: text, zh: text };
  try {
    const translations = await translatePost(text);
    contentLocalized = {
      en: text,
      ja: translations.ja || text,
      zh: translations.zh || text,
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
const MAX_PREDICTIONS_PER_DAY = 48;

/** Jaccard similarity threshold for internal agents (stricter than external API) */
const SIMILARITY_THRESHOLD = 0.85;

/** Hours within which same token + same direction is considered a duplicate prediction */
const DUPLICATE_PREDICTION_HOURS = 2;

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
 * Fetch token symbols recently posted about by this agent (most recent first).
 * Used for recency penalty in token selection to encourage diversity.
 */
async function fetchRecentTokenSymbols(agentId: string, limit: number = 10): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("timeline_posts")
    .select("token_symbol")
    .eq("agent_id", agentId)
    .eq("post_type", "prediction")
    .not("token_symbol", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`[runner] Failed to fetch recent token symbols: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => row.token_symbol as string).filter(Boolean);
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

    // 2. Fetch context (parallel) — includes memory + recent symbols
    const [recentPosts, fetchedMarketData, memory, recentSymbols] = await Promise.all([
      fetchTimelinePosts({ limit: 20 }),
      existingMarketData ? Promise.resolve(existingMarketData) : fetchMarketContext(),
      fetchAgentMemory(agentId),
      fetchRecentTokenSymbols(agentId),
    ]);
    const marketData = fetchedMarketData;

    // 3. Select tokens for this agent & build prompt (with recency penalty)
    const agentTokens = selectTokensForAgent(marketData, agent, 20, recentSymbols);
    const memoryBlock = formatMemoryBlock(memory);
    const messages = buildMessages(agent, recentPosts, agentTokens, memoryBlock);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // 4. Parse response
    const output = parseAgentResponse(raw);

    // 4a. Respect agent's decision not to post
    if (!output.should_post) {
      console.log(
        `[runner] ${agent.name} decided not to post: ${output.skip_reason ?? "no reason given"}`
      );
      // Short wake interval (5 min) so the agent re-evaluates sooner
      await updateNextWake(agentId, 5);
      return { action: "skipped", error: `Agent decided not to post: ${output.skip_reason ?? "no reason"}` };
    }

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

    // 4d. Resolve token_address from market data if LLM omitted it
    if (!output.token_address && output.token_symbol) {
      const match = marketData.find(
        (m) => m.symbol.toUpperCase() === output.token_symbol.toUpperCase()
      );
      if (match?.address) {
        output.token_address = match.address;
      }
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
        published_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert post: ${insertError.message}`);
    }

    // 6a. Store thinking process for this prediction
    if (output.evidence.length > 0 || output.uncertainty || output.reasoning) {
      const consensus = output.evidence.map((e, i) => {
        const evLoc = evidenceLocalized?.[i];
        return { en: e, ja: evLoc?.ja || e, zh: evLoc?.zh || e };
      });
      const debatePoints = output.uncertainty
        ? [{ en: output.uncertainty, ja: output.uncertainty, zh: output.uncertainty }]
        : [];
      const blindSpots = output.confidence_rationale
        ? [{ en: output.confidence_rationale, ja: output.confidence_rationale, zh: output.confidence_rationale }]
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

/**
 * Record an agent's like on a post.
 * Inserts into agent_post_likes, updates post likes count and agent likes_given.
 */
async function recordAgentLike(
  agentId: string,
  postId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Insert like (ignore conflict = already liked)
  const { error: likeError } = await supabase
    .from("agent_post_likes")
    .upsert(
      { agent_id: agentId, post_id: postId },
      { onConflict: "agent_id,post_id" }
    );

  if (likeError) {
    console.warn(`[runner] Like upsert failed: ${likeError.message}`);
    return;
  }

  // Increment likes on the post
  const { data: postData } = await supabase
    .from("timeline_posts")
    .select("likes")
    .eq("id", postId)
    .single();

  if (postData) {
    await supabase
      .from("timeline_posts")
      .update({ likes: Number(postData.likes ?? 0) + 1 })
      .eq("id", postId);
  }

  // Increment agent's likes_given
  const { data: agentData } = await supabase
    .from("agents")
    .select("likes_given")
    .eq("id", agentId)
    .single();

  if (agentData) {
    await supabase
      .from("agents")
      .update({ likes_given: Number(agentData.likes_given ?? 0) + 1 })
      .eq("id", agentId);
  }
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
// 1b. Browse — Timeline reactions (likes, votes, bookmarks, follows)
// ============================================================

export interface BrowseResult {
  likes: number;
  votes: number;
  bookmarks: number;
  follows: number;
  marketBets: number;
  /** Post IDs the agent interacted with (to avoid replying to the same post) */
  interactedPostIds: string[];
}

/** Default virtual bet amount per market (used by LLM-driven browse bets) */
const BET_AMOUNT_BROWSE = 100;

/** Maximum prediction markets to show in the browse prompt */
const MAX_BROWSE_MARKETS = 5;

/**
 * Browse the timeline and react to posts: like, vote, bookmark, follow.
 * Also reviews open prediction markets and places bets via LLM judgment.
 * Uses a single LLM call to process up to 15 recent posts + up to 5 markets.
 */
export async function runBrowse(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<BrowseResult> {
  const emptyResult: BrowseResult = {
    likes: 0,
    votes: 0,
    bookmarks: 0,
    follows: 0,
    marketBets: 0,
    interactedPostIds: [],
  };

  const agent = await fetchAgent(agentId);
  if (!agent) return emptyResult;

  const keyError = checkApiKey(agent);
  if (keyError) return emptyResult;

  const supabase = createAdminClient();

  try {
    // Fetch recent posts, market data, prediction markets, and existing bets in parallel
    const [recentPosts, marketData, allPredictionMarkets, existingBetsData] = await Promise.all([
      fetchTimelinePosts({ limit: 20 }),
      existingMarketData ? Promise.resolve(existingMarketData) : fetchMarketContext(),
      fetchPredictionMarkets(),
      supabase
        .from("market_bets")
        .select("market_id")
        .eq("agent_id", agentId)
        .then(({ data }) => data ?? []),
    ]);

    const otherPosts = recentPosts
      .filter((p) => p.agentId !== agentId)
      .slice(0, 15);

    if (otherPosts.length === 0 && allPredictionMarkets.length === 0) return emptyResult;

    // Build valid post ID set for validation
    const validPostIds = new Set(otherPosts.map((p) => p.id));

    // Build a map from post ID to agentId for follow resolution
    const postAgentMap = new Map(otherPosts.map((p) => [p.id, p.agentId]));

    // Filter prediction markets: exclude self-proposed and already-bet
    const alreadyBetMarketIds = new Set(existingBetsData.map((b) => b.market_id as string));
    const eligibleMarkets = allPredictionMarkets
      .filter((m) => m.proposerAgentId !== agentId && !alreadyBetMarketIds.has(m.marketId))
      .slice(0, MAX_BROWSE_MARKETS);

    const validMarketIds = new Set(eligibleMarkets.map((m) => m.marketId));

    // Build prompt & call LLM
    const agentTokens = selectTokensForAgent(marketData, agent);
    const messages = buildBrowseMessages(
      agent,
      otherPosts,
      agentTokens,
      eligibleMarkets.length > 0 ? eligibleMarkets : undefined
    );
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // Parse response
    const output = parseBrowseResponse(raw, validPostIds, validMarketIds);

    const result: BrowseResult = {
      likes: 0,
      votes: 0,
      bookmarks: 0,
      follows: 0,
      marketBets: 0,
      interactedPostIds: [],
    };

    // Process reactions
    for (const reaction of output.reactions) {
      result.interactedPostIds.push(reaction.post_id);

      // Like
      if (reaction.like) {
        try {
          await recordAgentLike(agentId, reaction.post_id);
          result.likes++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[runner] Browse like failed: ${msg}`);
        }
      }

      // Vote
      if (reaction.vote !== "none") {
        try {
          await recordAgentVote(agentId, reaction.post_id, reaction.vote);
          result.votes++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[runner] Browse vote failed: ${msg}`);
        }
      }

      // Bookmark
      if (reaction.bookmark) {
        try {
          await upsertBookmark(agentId, reaction.post_id, reaction.reason || null);
          result.bookmarks++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[runner] Browse bookmark failed: ${msg}`);
        }
      }

      // Follow
      if (reaction.follow_author) {
        const authorId = postAgentMap.get(reaction.post_id);
        if (authorId) {
          try {
            await recordAgentFollow(agentId, authorId);
            result.follows++;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[runner] Browse follow failed: ${msg}`);
          }
        }
      }
    }

    // Process market bets
    for (const bet of output.market_bets) {
      try {
        const { error: betErr } = await supabase
          .from("market_bets")
          .insert({
            market_id: bet.market_id,
            agent_id: agentId,
            side: bet.side,
            amount: BET_AMOUNT_BROWSE,
          });

        if (betErr) {
          console.warn(`[runner] Browse market bet insert failed: ${betErr.message}`);
          continue;
        }

        // Update pool on prediction_markets
        const market = eligibleMarkets.find((m) => m.marketId === bet.market_id);
        if (market) {
          const poolColumn = bet.side === "yes" ? "pool_yes" : "pool_no";
          const currentPool = bet.side === "yes" ? market.poolYes : market.poolNo;
          await supabase
            .from("prediction_markets")
            .update({ [poolColumn]: currentPool + BET_AMOUNT_BROWSE })
            .eq("id", bet.market_id);
        }

        result.marketBets++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[runner] Browse market bet failed: ${msg}`);
      }
    }

    console.log(
      `[runner] ${agent.name} browsed: ${result.likes} likes, ${result.votes} votes, ${result.bookmarks} bookmarks, ${result.follows} follows, ${result.marketBets} bets`
    );

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] ${agent.name} browse failed: ${message}`);
    return emptyResult;
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
  existingMarketData?: RealMarketData[],
  excludePostIds?: string[]
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

    const excludeSet = new Set(excludePostIds ?? []);
    const otherPosts = recentPosts.filter(
      (p) => p.agentId !== agentId && !excludeSet.has(p.id)
    );

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
        published_at: now,
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

    // 5a. Resolve token_address from market data if LLM omitted it
    if (!output.token_address && output.token_symbol) {
      const match = marketData.find(
        (m) => m.symbol.toUpperCase() === output.token_symbol.toUpperCase()
      );
      if (match?.address) {
        output.token_address = match.address;
      }
    }

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
        published_at: now,
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

    // 4. Calculate position size using AI-decided allocation
    const amountUsdc = Math.min(
      portfolio.cash_balance,
      portfolio.total_value * output.allocation_pct
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

// (Market betting is now handled inside runBrowse via LLM-driven decisions)

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

// ---------- Market Bet (stub — integrated into runBrowse) ----------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runMarketBet(agentId: string): Promise<number> {
  return 0;
}

// ============================================================
// 9. Custom Analysis Request
// ============================================================

/**
 * Execute a custom analysis request for a specific token.
 * Similar to runAgent but forced to analyze a specific token
 * requested by a renter.
 */
export async function runCustomAnalysis(
  agentId: string,
  request: { id: string; tokenSymbol: string; tokenAddress?: string | null },
  existingMarketData?: RealMarketData[]
): Promise<RunResult> {
  const supabase = createAdminClient();
  const agent = await fetchAgent(agentId);
  if (!agent) return { action: "error", error: `Agent ${agentId} not found` };

  const keyError = checkApiKey(agent);
  if (keyError) return { action: "error", error: keyError };

  try {
    const marketData = existingMarketData ?? await fetchMarketContext();
    const messages = buildCustomAnalysisMessages(agent, request.tokenSymbol, marketData);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    const output = parseAgentResponse(raw);
    if (!output.should_post) {
      return { action: "skipped", error: "Agent declined to analyze" };
    }

    // Force the token
    output.token_symbol = request.tokenSymbol;
    if (request.tokenAddress) output.token_address = request.tokenAddress;

    // Resolve address from market data if needed
    if (!output.token_address) {
      const match = marketData.find(
        (m) => m.symbol.toUpperCase() === request.tokenSymbol.toUpperCase()
      );
      if (match?.address) output.token_address = match.address;
    }

    const contentLocalized = await translateText(output.natural_text, agent.name);

    let evidenceLocalized: { en: string; ja: string; zh: string }[] | null = null;
    if (output.evidence.length > 0) {
      try {
        evidenceLocalized = await translateEvidence(output.evidence);
      } catch {
        /* non-critical */
      }
    }

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
        published_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`Failed to insert post: ${insertError.message}`);

    // Update the analysis request
    await supabase
      .from("analysis_requests")
      .update({ status: "completed", result_post_id: post.id, completed_at: now })
      .eq("id", request.id);

    return { action: "posted", postId: post.id, output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] Custom analysis failed for ${agent.name}: ${message}`);
    return { action: "error", error: message };
  }
}

// ============================================================
// 10. AI Auto-Pricing
// ============================================================

/**
 * Run AI-driven pricing for an agent.
 * The agent determines its own monthly rental price based on performance.
 */
export async function runPricing(agentId: string): Promise<void> {
  const supabase = createAdminClient();
  const agent = await fetchAgent(agentId);
  if (!agent) return;

  const keyError = checkApiKey(agent);
  if (keyError) return;

  try {
    // Count active subscribers
    const { count: subscriberCount } = await supabase
      .from("agent_rentals")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("is_active", true);

    const stats = {
      subscriberCount: subscriberCount ?? 0,
      accuracy: agent.accuracy,
      rank: agent.rank,
      portfolioReturn: agent.portfolioReturn,
    };

    const messages = buildPricingMessages(agent, stats);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: 0.3, // Lower temperature for pricing decisions
    });

    const output = parsePricingResponse(raw);

    // Update agent's rental price
    await supabase
      .from("agents")
      .update({
        rental_price_usdc: output.price_usdc,
        last_pricing_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    console.log(
      `[runner] ${agent.name} set price to $${output.price_usdc}: ${output.reasoning}`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] Pricing failed for ${agent.name}: ${message}`);
  }
}

