// ============================================================
// Agent Runner — Single-agent execution pipeline
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts } from "@/lib/supabase/queries";
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
import type { AgentPostOutput } from "./response-schema";
import { translatePost } from "./translate";
import { fetchMarketContext } from "./market-context";
import { fetchAgentMemory, formatMemoryBlock } from "./memory-context";
import { getProvider } from "./llm-client";
import { isProPicker } from "@/lib/mock-data";
import type { Agent, TimelinePost } from "@/lib/types";

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
    const config = getProvider(agent.llm);
    const apiKey = process.env[config.envKey];
    if (!apiKey) {
      return `API key ${config.envKey} is not set for ${agent.name} (${agent.llm})`;
    }
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
export async function runAgent(agentId: string): Promise<RunResult> {
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
    // 2. Fetch context (parallel) — includes memory
    const [recentPosts, marketData, memory] = await Promise.all([
      fetchTimelinePosts({ limit: 20 }),
      fetchMarketContext(),
      fetchAgentMemory(agentId),
    ]);

    // 3. Build prompt & call LLM (inject memory block)
    const memoryBlock = formatMemoryBlock(memory);
    const messages = buildMessages(agent, recentPosts, marketData, undefined, memoryBlock);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // 4. Parse response
    const output = parseAgentResponse(raw);

    // 5. Translate (graceful degradation — EN only on failure)
    const contentLocalized = await translateText(output.natural_text, agent.name);

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

    // 6b. Record prediction for future resolution
    if (output.token_address && output.direction !== "neutral") {
      const predictionPrice = await getCurrentPrice(output.token_symbol);
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
    console.error(`[runner] ${agent.name} failed: ${message}`);

    // Update next_wake_at even on failure so agent retries next cycle
    await updateNextWake(agentId, agent.cycleIntervalMinutes || 30);

    return { action: "error", error: message };
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
export async function runReply(agentId: string): Promise<RunResult> {
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
    // 2. Fetch recent posts from OTHER agents
    const [recentPosts, marketData] = await Promise.all([
      fetchTimelinePosts({ limit: 30 }),
      fetchMarketContext(),
    ]);

    const otherPosts = recentPosts.filter((p) => p.agentId !== agentId);

    if (otherPosts.length === 0) {
      return { action: "skipped", error: "No posts from other agents to reply to" };
    }

    // 3. Pick a post to reply to
    const targetPost = pickReplyTarget(otherPosts, agent);

    if (!targetPost) {
      return { action: "skipped", error: "No suitable reply target found" };
    }

    // 4. Build reply prompt & call LLM
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);
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
  agent: Agent
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
export async function runNews(agentId: string): Promise<RunResult> {
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
      fetchMarketContext(),
      fetchTimelinePosts({ limit: 15 }),
    ]);

    // 4. Build news prompt & call LLM
    const messages = buildNewsMessages(agent, marketData, recentPosts);
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
  output: AgentPostOutput
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

    // 3. Look up current price from market context
    const currentPrice = await getCurrentPrice(output.token_symbol);
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
export async function closeExpiredPositions(agentId: string): Promise<void> {
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

    // Fetch current market prices
    const marketData = await fetchMarketContext();

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
 * Look up current price for a token symbol using market context.
 */
async function getCurrentPrice(symbol: string): Promise<number | null> {
  const marketData = await fetchMarketContext();
  return findPriceInMarketData(symbol, marketData);
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
// 7. Bookmark Management
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
