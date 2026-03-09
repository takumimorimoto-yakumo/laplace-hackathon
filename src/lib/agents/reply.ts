// ============================================================
// 2. Reply Generation
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts, fetchAgentFollowing } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildReplyMessages } from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import { parseReplyResponse } from "./response-schema";
import { fetchMarketContext } from "./market-context";
import { selectTokensForAgent } from "./token-selector";
import { recordAgentVote, recordAgentFollow, incrementReplyCount, upsertBookmark, MAX_FOLLOWS } from "./social";
import { checkApiKey, translateText, updateNextWake } from "./runner-helpers";
import type { RunResult } from "./prediction";
import type { Agent, TimelinePost } from "@/lib/types";

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
    const isContrarian = agent.reasoningStyle === "contrarian" || agent.style === "contrarian";
    if (isContrarian) {
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
