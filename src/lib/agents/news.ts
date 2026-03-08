// ============================================================
// 3. News Generation
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildNewsMessages } from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import { parseNewsResponse } from "./response-schema";
import { translatePost } from "./translate";
import { fetchMarketContext } from "./market-context";
import { selectTokensForAgent } from "./token-selector";
import { isProPicker } from "@/lib/agents/pro-picker";
import { checkApiKey, translateText } from "./runner-helpers";
import type { RunResult } from "./prediction";

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
