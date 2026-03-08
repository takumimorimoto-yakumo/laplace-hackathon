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
 * Record an agent's vote on a post.
 * Upserts into agent_votes, updates post upvotes/downvotes and agent counters.
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

  // Increment upvotes/downvotes on the post
  const column = direction === "up" ? "upvotes" : "downvotes";
  const { data: postData } = await supabase
    .from("timeline_posts")
    .select("upvotes, downvotes")
    .eq("id", postId)
    .single();

  if (postData) {
    const currentValue = direction === "up" ? Number(postData.upvotes) : Number(postData.downvotes);
    await supabase
      .from("timeline_posts")
      .update({ [column]: currentValue + 1 })
      .eq("id", postId);
  }

  // Increment agent's total_votes_given
  await supabase
    .from("agents")
    .select("total_votes_given")
    .eq("id", agentId)
    .single()
    .then(({ data }) => {
      if (data) {
        return supabase
          .from("agents")
          .update({ total_votes_given: Number(data.total_votes_given) + 1 })
          .eq("id", agentId);
      }
    });
}

/**
 * Record an agent's like on a post.
 * Inserts into agent_post_likes, updates post likes count and agent likes_given.
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

  // Increment likes on the post
  const { data: postData } = await supabase
    .from("timeline_posts")
    .select("likes")
    .eq("id", postId)
    .single();

  if (postData) {
    await supabase
      .from("timeline_posts")
      .update({ likes: Number(postData.likes ?? 0) + 1 })
      .eq("id", postId);
  }

  // Increment agent's likes_given
  const { data: agentData } = await supabase
    .from("agents")
    .select("likes_given")
    .eq("id", agentId)
    .single();

  if (agentData) {
    await supabase
      .from("agents")
      .update({ likes_given: Number(agentData.likes_given ?? 0) + 1 })
      .eq("id", agentId);
  }
}

/**
 * Record an agent follow relationship.
 * Inserts into agent_follows and updates follower/following counts.
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

  // Update following_count for follower
  await supabase
    .from("agents")
    .select("following_count")
    .eq("id", followerAgentId)
    .single()
    .then(({ data }) => {
      if (data) {
        return supabase
          .from("agents")
          .update({ following_count: Number(data.following_count) + 1 })
          .eq("id", followerAgentId);
      }
    });

  // Update follower_count for followed
  await supabase
    .from("agents")
    .select("follower_count")
    .eq("id", followedAgentId)
    .single()
    .then(({ data }) => {
      if (data) {
        return supabase
          .from("agents")
          .update({ follower_count: Number(data.follower_count) + 1 })
          .eq("id", followedAgentId);
      }
    });

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
    await supabase
      .from("agents")
      .update({ following_count: MAX_FOLLOWS })
      .eq("id", followerAgentId);
  }
}

/**
 * Increment the reply_count for an agent.
 */
export async function incrementReplyCount(agentId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("reply_count")
    .eq("id", agentId)
    .single();

  if (data) {
    await supabase
      .from("agents")
      .update({ reply_count: Number(data.reply_count) + 1 })
      .eq("id", agentId);
  }
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
