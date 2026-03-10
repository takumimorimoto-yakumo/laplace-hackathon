// ============================================================
// Trade Review — LLM-based post-trade analysis
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";

// ---------- Constants ----------

/** Cumulative loss threshold (in USD) over lookback period to trigger a review */
const LOSS_THRESHOLD = -200;

/** Number of consecutive losing trades to trigger a streak review */
const LOSS_STREAK_THRESHOLD = 3;

/** Number of closed trades between periodic reviews */
const PERIODIC_TRADE_INTERVAL = 20;

/** Minimum hours between reviews for the same agent */
const REVIEW_COOLDOWN_HOURS = 24;

/** Number of recent closed trades to analyze */
const TRADES_TO_ANALYZE = 20;

/** Lookback period in days for loss threshold check */
const LOOKBACK_DAYS = 7;

// ---------- Types ----------

interface TradeReviewTrigger {
  type: "loss_threshold" | "streak" | "periodic";
  value: number;
}

interface TradeReviewOutput {
  what_went_wrong: string | null;
  what_went_right: string | null;
  pattern_identified: string | null;
  lesson_learned: string;
  confidence_score: number;
}

// ---------- Trigger Check ----------

/**
 * Determine if a trade review should be generated for this agent.
 * Returns the trigger info or null if no review is needed.
 */
export async function shouldGenerateReview(
  agentId: string
): Promise<TradeReviewTrigger | null> {
  const supabase = createAdminClient();

  // Rate limit: max 1 review per agent per REVIEW_COOLDOWN_HOURS
  const cooldownCutoff = new Date(
    Date.now() - REVIEW_COOLDOWN_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { count: recentReviews } = await supabase
    .from("trade_reviews")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .gte("created_at", cooldownCutoff);

  if ((recentReviews ?? 0) > 0) return null;

  // Check 1: Loss threshold — cumulative P&L < LOSS_THRESHOLD in lookback period
  const lookbackCutoff = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: recentTrades } = await supabase
    .from("virtual_trades")
    .select("realized_pnl")
    .eq("agent_id", agentId)
    .eq("action", "close")
    .gte("executed_at", lookbackCutoff);

  if (recentTrades && recentTrades.length > 0) {
    const cumulativePnl = recentTrades.reduce(
      (sum, t) => sum + Number(t.realized_pnl ?? 0),
      0
    );
    if (cumulativePnl < LOSS_THRESHOLD) {
      return { type: "loss_threshold", value: cumulativePnl };
    }
  }

  // Check 2: Loss streak — N consecutive losing trades
  const { data: lastTrades } = await supabase
    .from("virtual_trades")
    .select("realized_pnl")
    .eq("agent_id", agentId)
    .eq("action", "close")
    .order("executed_at", { ascending: false })
    .limit(LOSS_STREAK_THRESHOLD);

  if (lastTrades && lastTrades.length >= LOSS_STREAK_THRESHOLD) {
    const allLosing = lastTrades.every((t) => Number(t.realized_pnl ?? 0) < 0);
    if (allLosing) {
      return { type: "streak", value: LOSS_STREAK_THRESHOLD };
    }
  }

  // Check 3: Periodic — every PERIODIC_TRADE_INTERVAL closed trades since last review
  const { data: lastReview } = await supabase
    .from("trade_reviews")
    .select("created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(1);

  const sinceDate = lastReview?.[0]?.created_at ?? "1970-01-01T00:00:00Z";

  const { count: tradesSinceReview } = await supabase
    .from("virtual_trades")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("action", "close")
    .gt("executed_at", sinceDate as string);

  if ((tradesSinceReview ?? 0) >= PERIODIC_TRADE_INTERVAL) {
    return { type: "periodic", value: tradesSinceReview ?? 0 };
  }

  return null;
}

// ---------- Review Generation ----------

/**
 * Generate a trade review using the agent's own LLM.
 * Analyzes recent closed trades and extracts lessons.
 */
export async function generateTradeReview(
  agentId: string,
  trigger: TradeReviewTrigger
): Promise<void> {
  const supabase = createAdminClient();

  const agent = await fetchAgent(agentId);
  if (!agent) return;

  // Fetch recent closed trades with full context
  const { data: trades } = await supabase
    .from("virtual_trades")
    .select(
      "token_symbol, side, action, price, amount_usdc, realized_pnl, realized_pnl_pct, executed_at, close_reason, reasoning, entry_price, price_target, stop_loss"
    )
    .eq("agent_id", agentId)
    .eq("action", "close")
    .order("executed_at", { ascending: false })
    .limit(TRADES_TO_ANALYZE);

  if (!trades || trades.length === 0) return;

  // Build trade summary for LLM
  const tradeSummary = trades
    .map((t, i) => {
      const pnl = Number(t.realized_pnl ?? 0);
      const pnlPct = Number(t.realized_pnl_pct ?? 0);
      const result = pnl >= 0 ? "WIN" : "LOSS";
      const reason = t.close_reason ? ` (${(t.close_reason as string).toUpperCase()})` : "";
      const entry = t.entry_price ? ` entry:$${Number(t.entry_price).toFixed(2)}` : "";
      const target = t.price_target ? ` target:$${Number(t.price_target).toFixed(2)}` : "";
      const sl = t.stop_loss ? ` SL:$${Number(t.stop_loss).toFixed(2)}` : "";
      const rationale = t.reasoning ? ` | Reasoning: ${(t.reasoning as string).slice(0, 100)}` : "";

      return `${i + 1}. ${result} ${t.side} ${t.token_symbol} $${Number(t.amount_usdc).toFixed(0)} P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)${reason}${entry}${target}${sl}${rationale}`;
    })
    .join("\n");

  const triggerDesc =
    trigger.type === "loss_threshold"
      ? `Cumulative P&L of $${trigger.value.toFixed(0)} over the last ${LOOKBACK_DAYS} days.`
      : trigger.type === "streak"
        ? `${trigger.value} consecutive losing trades.`
        : `${trigger.value} trades since your last review.`;

  const prompt = `You are "${agent.name}", reviewing your recent trading performance.

## Trigger
${triggerDesc}

## Your Recent Closed Trades (most recent first)
${tradeSummary}

## Task
Analyze your trading results and extract actionable lessons. Be honest and specific.

Respond with a single JSON object:
{
  "what_went_wrong": "Specific mistakes or bad patterns (null if mostly wins)",
  "what_went_right": "What worked well (null if mostly losses)",
  "pattern_identified": "A recurring pattern you notice (e.g., 'SL hit on meme coins 4/5 times')",
  "lesson_learned": "One concrete, actionable lesson for future trades (required)",
  "confidence_score": 0.7
}

confidence_score: How confident you are in this lesson (0.0-1.0). Higher = more data supports it.`;

  const raw = await chatCompletion(
    [
      { role: "system", content: "You are a trading performance analyst. Respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    { llmModel: agent.llm, temperature: 0.3 }
  );

  // Parse LLM response
  let review: TradeReviewOutput;
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    review = JSON.parse(cleaned) as TradeReviewOutput;
  } catch {
    console.warn(`[trade-review] Failed to parse review for ${agent.name}: ${raw.slice(0, 200)}`);
    return;
  }

  // Validate required field
  if (!review.lesson_learned) {
    console.warn(`[trade-review] Missing lesson_learned for ${agent.name}`);
    return;
  }

  // Save to DB
  const { error } = await supabase.from("trade_reviews").insert({
    agent_id: agentId,
    review_type: trigger.type,
    trigger_value: trigger.value,
    analyzed_trades_count: trades.length,
    lookback_period_days: LOOKBACK_DAYS,
    what_went_wrong: review.what_went_wrong ?? null,
    what_went_right: review.what_went_right ?? null,
    pattern_identified: review.pattern_identified ?? null,
    lesson_learned: review.lesson_learned,
    confidence_score: Math.max(0, Math.min(1, review.confidence_score ?? 0.5)),
  });

  if (error) {
    console.error(`[trade-review] Failed to save review for ${agent.name}: ${error.message}`);
  } else {
    console.log(
      `[trade-review] Generated ${trigger.type} review for ${agent.name}: "${review.lesson_learned.slice(0, 80)}"`
    );
  }
}

// ---------- Orchestration ----------

/**
 * Check if a review should be generated and generate it if needed.
 * Safe to call after every position close — it handles rate limiting internally.
 */
export async function maybeGenerateTradeReview(
  agentId: string
): Promise<void> {
  const trigger = await shouldGenerateReview(agentId);
  if (!trigger) return;

  await generateTradeReview(agentId, trigger);
}
