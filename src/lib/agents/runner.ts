// ============================================================
// Agent Runner — Single-agent execution pipeline
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildMessages } from "./prompt-builder";
import { parseAgentResponse } from "./response-schema";
import { translatePost } from "./translate";
import { fetchMarketContext } from "./market-context";
import { getProvider } from "./llm-client";

export interface RunResult {
  action: "posted" | "skipped" | "error";
  postId?: string;
  error?: string;
}

/**
 * Execute one cycle for a single agent:
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
  try {
    const config = getProvider(agent.llm);
    const apiKey = process.env[config.envKey];
    if (!apiKey) {
      return { action: "error", error: `API key ${config.envKey} is not set for ${agent.name} (${agent.llm})` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { action: "error", error: `Provider check failed for ${agent.name}: ${message}` };
  }

  try {
    // 2. Fetch context (parallel)
    const [recentPosts, marketData] = await Promise.all([
      fetchTimelinePosts({ limit: 20 }),
      fetchMarketContext(),
    ]);

    // 3. Build prompt & call LLM
    const messages = buildMessages(agent, recentPosts, marketData);
    const raw = await chatCompletion(messages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
    });

    // 4. Parse response
    const output = parseAgentResponse(raw);

    // 5. Translate (graceful degradation — EN only on failure)
    let contentLocalized: Record<string, string> = { en: output.natural_text };
    try {
      const translations = await translatePost(output.natural_text);
      contentLocalized = {
        en: output.natural_text,
        ja: translations.ja,
        zh: translations.zh,
      };
    } catch (translateErr: unknown) {
      const msg = translateErr instanceof Error ? translateErr.message : String(translateErr);
      console.warn(`[runner] Translation failed for ${agent.name}, posting EN only: ${msg}`);
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

    // 7. Update agent timestamps
    const cycleMinutes = agent.cycleIntervalMinutes || 30;
    const nextWake = new Date(Date.now() + cycleMinutes * 60 * 1000).toISOString();

    await supabase
      .from("agents")
      .update({
        last_active_at: now,
        next_wake_at: nextWake,
      })
      .eq("id", agentId);

    console.log(`[runner] ${agent.name} posted ${output.direction} on ${output.token_symbol} (conf: ${output.confidence})`);

    return { action: "posted", postId: post.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] ${agent.name} failed: ${message}`);

    // Update next_wake_at even on failure so agent retries next cycle
    const cycleMinutes = agent.cycleIntervalMinutes || 30;
    const nextWake = new Date(Date.now() + cycleMinutes * 60 * 1000).toISOString();

    await supabase
      .from("agents")
      .update({ next_wake_at: nextWake })
      .eq("id", agentId);

    return { action: "error", error: message };
  }
}
