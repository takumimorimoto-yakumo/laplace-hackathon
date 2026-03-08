// ============================================================
// Timeline Post Queries
// ============================================================

import { createReadOnlyClient } from "../server";
import { dbPostToTimelinePost } from "../mappers";
import type { DbTimelinePost } from "../mappers";
import type { TimelinePost, LocalizedContent, NewsItem } from "@/lib/types";

// ---------- Timeline Posts ----------

export async function fetchTimelinePosts(opts?: {
  limit?: number;
  agentId?: string;
  tokenAddress?: string;
  includeUnpublished?: boolean;
}): Promise<TimelinePost[]> {
  const supabase = createReadOnlyClient();
  let query = supabase
    .from("timeline_posts")
    .select("*")
    .is("parent_post_id", null) // top-level only
    .order("created_at", { ascending: false });

  if (opts?.agentId) {
    query = query.eq("agent_id", opts.agentId);
  }
  if (opts?.tokenAddress) {
    query = query.eq("token_address", opts.tokenAddress);
  }
  // published_at filter: only apply if not requesting unpublished posts
  // Gracefully skip if column doesn't exist yet (pre-migration)
  const applyPublishedFilter = !opts?.includeUnpublished;
  if (applyPublishedFilter) {
    query = query.lte("published_at", new Date().toISOString());
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  let { data, error } = await query;

  // Fallback: if published_at column doesn't exist yet, retry without the filter
  if (error && error.code === "42703" && applyPublishedFilter) {
    let fallbackQuery = supabase
      .from("timeline_posts")
      .select("*")
      .is("parent_post_id", null)
      .order("created_at", { ascending: false });
    if (opts?.agentId) fallbackQuery = fallbackQuery.eq("agent_id", opts.agentId);
    if (opts?.tokenAddress) fallbackQuery = fallbackQuery.eq("token_address", opts.tokenAddress);
    if (opts?.limit) fallbackQuery = fallbackQuery.limit(opts.limit);
    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("fetchTimelinePosts error:", error.message, error.code, error.details);
    return [];
  }

  const posts = data as DbTimelinePost[];

  // Fetch replies for all posts
  const postIds = posts.map((p) => p.id);
  const repliesMap = await fetchRepliesForPosts(postIds);

  return posts.map((p) => dbPostToTimelinePost(p, repliesMap.get(p.id) ?? []));
}

async function fetchRepliesForPosts(
  parentIds: string[]
): Promise<Map<string, TimelinePost[]>> {
  if (parentIds.length === 0) return new Map();

  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .in("parent_post_id", parentIds)
    .order("created_at", { ascending: true });

  if (error || !data) return new Map();

  const map = new Map<string, TimelinePost[]>();
  for (const row of data as DbTimelinePost[]) {
    const parentId = row.parent_post_id!;
    const existing = map.get(parentId) ?? [];
    existing.push(dbPostToTimelinePost(row, []));
    map.set(parentId, existing);
  }
  return map;
}

export async function fetchPostById(id: string): Promise<TimelinePost | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as DbTimelinePost;

  // Fetch replies
  const repliesMap = await fetchRepliesForPosts([row.id]);
  return dbPostToTimelinePost(row, repliesMap.get(row.id) ?? []);
}

export async function fetchPostWithReplies(id: string): Promise<TimelinePost | null> {
  return fetchPostById(id); // same implementation, replies are included
}

/**
 * Fetch multiple posts by their IDs (with replies).
 */
export async function fetchPostsByIds(ids: string[]): Promise<TimelinePost[]> {
  if (ids.length === 0) return [];

  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const posts = data as DbTimelinePost[];
  const postIds = posts.map((p) => p.id);
  const repliesMap = await fetchRepliesForPosts(postIds);
  return posts.map((p) => dbPostToTimelinePost(p, repliesMap.get(p.id) ?? []));
}

// ---------- Thinking Processes ----------

export async function fetchThinkingProcess(postId: string): Promise<import("@/lib/types").ThinkingProcess | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("thinking_processes")
    .select("*")
    .eq("post_id", postId)
    .single();

  if (error || !data) return null;

  return {
    postId: data.post_id as string,
    consensus: (data.consensus as LocalizedContent[]) ?? [],
    debatePoints: (data.debate_points as LocalizedContent[]) ?? [],
    blindSpots: (data.blind_spots as LocalizedContent[]) ?? [],
  };
}

// ---------- News from Posts ----------

export async function fetchNewsFromPosts(limit = 12): Promise<NewsItem[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .eq("post_type", "alert")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as DbTimelinePost[]).map((row) => {
    const localized = row.content_localized as Record<string, string> | null;
    const text = localized?.en ?? row.natural_text;

    // Parse "[CATEGORY] headline\n\nbody" format
    const categoryMatch = text.match(/^\[(\w+)\]\s*/);
    const category = categoryMatch
      ? (categoryMatch[1].toLowerCase() as NewsItem["category"])
      : "market";
    const afterCategory = categoryMatch ? text.slice(categoryMatch[0].length) : text;
    const [headline = "", ...bodyParts] = afterCategory.split("\n\n");

    const titleEn = headline || afterCategory.slice(0, 100);
    const titleJa = localized?.ja
      ? (localized.ja.match(/^\[\w+\]\s*(.+?)(?:\n|$)/)?.[1] ?? localized.ja.slice(0, 100))
      : "";
    const titleZh = localized?.zh
      ? (localized.zh.match(/^\[\w+\]\s*(.+?)(?:\n|$)/)?.[1] ?? localized.zh.slice(0, 100))
      : "";

    // Suppress unused variable warning
    void bodyParts;

    return {
      id: row.id,
      authorAgentId: row.agent_id,
      title: { en: titleEn, ja: titleJa, zh: titleZh },
      source: "Laplace AI",
      category,
      tokenSymbols: row.token_symbol ? [row.token_symbol] : [],
      publishedAt: row.created_at,
    };
  });
}
