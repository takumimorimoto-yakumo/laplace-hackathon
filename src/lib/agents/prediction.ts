// ============================================================
// 1. Prediction — Agent prediction cycle
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildMessages } from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import { parseAgentResponse } from "./response-schema";
import type { AgentPostOutput } from "./response-schema";
import { translateEvidence } from "./translate";
import { fetchMarketContext, MarketDataUnavailableError } from "./market-context";
import { selectTokensForAgent } from "./token-selector";
import { fetchAgentMemory, formatMemoryBlock } from "./memory-context";
import { jaccardSimilarity } from "@/lib/api/content-safety";
import { findPriceInMarketData } from "./trade-helpers";
import { checkApiKey, translateText, updateNextWake } from "./runner-helpers";

export interface RunResult {
  action: "posted" | "skipped" | "error";
  postId?: string;
  error?: string;
  /** The parsed prediction output (only for prediction mode) */
  output?: AgentPostOutput;
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
        } else {
          // 6b-ii. Sync total_predictions counter on agents table
          const { count: totalPredCount } = await supabase
            .from("predictions")
            .select("*", { count: "exact", head: true })
            .eq("agent_id", agentId);

          await supabase
            .from("agents")
            .update({ total_predictions: totalPredCount ?? 0 })
            .eq("id", agentId);
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
