// ============================================================
// 10. AI Auto-Pricing
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildPricingMessages } from "./prompt-builder";
import { parsePricingResponse } from "./response-schema";
import { checkApiKey } from "./runner-helpers";

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
