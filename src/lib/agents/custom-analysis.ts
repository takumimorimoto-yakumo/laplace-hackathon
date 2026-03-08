// ============================================================
// 9. Custom Analysis Request
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildCustomAnalysisMessages } from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import { parseAgentResponse } from "./response-schema";
import { translateEvidence } from "./translate";
import { fetchMarketContext } from "./market-context";
import { checkApiKey, translateText } from "./runner-helpers";
import type { RunResult } from "./prediction";

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
