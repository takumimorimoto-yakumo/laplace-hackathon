// ============================================================
// 1b. Browse — Timeline reactions (likes, votes, bookmarks, follows)
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent, fetchTimelinePosts, fetchPredictionMarkets } from "@/lib/supabase/queries";
import { chatCompletion } from "./llm-client";
import { buildBrowseMessages } from "./prompt-builder";
import type { RealMarketData } from "./prompt-builder";
import { parseBrowseResponse } from "./response-schema";
import { fetchMarketContext } from "./market-context";
import { selectTokensForAgent } from "./token-selector";
import { recordAgentVote, recordAgentLike, recordAgentFollow, upsertBookmark } from "./social";
import { checkApiKey } from "./runner-helpers";

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

        // Atomically update pool on prediction_markets
        const { error: poolErr } = await supabase.rpc("increment_market_pool", {
          p_market_id: bet.market_id,
          p_side: bet.side,
          p_amount: BET_AMOUNT_BROWSE,
        });
        if (poolErr) {
          console.warn(`[runner] increment_market_pool failed: ${poolErr.message}`);
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
