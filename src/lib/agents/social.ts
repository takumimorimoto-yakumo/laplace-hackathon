// ============================================================
// Agent Social: Vote, Like, Follow, Bookmark, Reply Count
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { VoteDirection } from "./response-schema";

/** Maximum follows per agent */
const MAX_FOLLOWS = 20;

/** Maximum bookmarks per agent */
const MAX_BOOKMARKS = 10;

// Re-export MAX_FOLLOWS so reply.ts can use it for fetchAgentFollowing
export { MAX_FOLLOWS };

/**
 * Atomically increment a counter column on the agents table.
 */
async function incrementAgentCounter(
  agentId: string,
  column: string,
  amount: number = 1
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("increment_agent_counter", {
    p_agent_id: agentId,
    p_column: column,
    p_amount: amount,
  });
  if (error) {
    console.warn(`[social] increment_agent_counter(${column}) failed: ${error.message}`);
  }
}

/**
 * Record an agent's vote on a post.
 * Uses increment_vote RPC for atomic post counter + total_votes_received update,
 * plus atomic increment for total_votes_given on the voting agent.
 */
export async function recordAgentVote(
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

  // Atomically increment post upvotes/downvotes AND author's total_votes_received
  const pgDirection = direction === "up" ? "up" : "down";
  const { error: incError } = await supabase.rpc("increment_vote", {
    p_post_id: postId,
    p_direction: pgDirection,
    p_amount: 0, // agent votes have no USDC amount
  });

  if (incError) {
    console.warn(`[social] increment_vote RPC failed: ${incError.message}`);
  }

  // Atomically increment voting agent's total_votes_given
  await incrementAgentCounter(agentId, "total_votes_given");
}

/**
 * Record an agent's like on a post.
 * Uses atomic increments for post likes and agent likes_given.
 */
export async function recordAgentLike(
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

  // Atomically increment likes on the post
  const { error: incError } = await supabase.rpc("increment_post_likes", {
    p_post_id: postId,
  });

  if (incError) {
    console.warn(`[social] increment_post_likes RPC failed: ${incError.message}`);
  }

  // Atomically increment agent's likes_given
  await incrementAgentCounter(agentId, "likes_given");
}

/**
 * Record an agent follow relationship.
 * Inserts into agent_follows and atomically updates follower/following counts.
 * Prunes oldest follows if over MAX_FOLLOWS.
 */
export async function recordAgentFollow(
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

  // Atomically update counters
  await incrementAgentCounter(followerAgentId, "following_count");
  await incrementAgentCounter(followedAgentId, "follower_count");

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
    const { error: fixErr } = await supabase
      .from("agents")
      .update({ following_count: MAX_FOLLOWS })
      .eq("id", followerAgentId);
    if (fixErr) {
      console.warn(`[social] following_count fix failed: ${fixErr.message}`);
    }
  }
}

/**
 * Atomically increment the reply_count for an agent.
 */
export async function incrementReplyCount(agentId: string): Promise<void> {
  await incrementAgentCounter(agentId, "reply_count");
}

/**
 * Upsert a bookmark for an agent, pruning old ones if over limit.
 */
export async function upsertBookmark(
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
