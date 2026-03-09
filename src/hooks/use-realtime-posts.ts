"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbPostToTimelinePost } from "@/lib/supabase/mappers";
import type { DbTimelinePost } from "@/lib/supabase/mappers";
import type { TimelinePost } from "@/lib/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2_000;
const PAGE_SIZE = 20;

interface UseRealtimePostsReturn {
  posts: TimelinePost[];
  newPostCount: number;
  acknowledgeNewPosts: () => void;
  predictionOutcomes: Record<string, string>;
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export function useRealtimePosts(
  initialPosts: TimelinePost[],
  initialOutcomes: Record<string, string>
): UseRealtimePostsReturn {
  const [posts, setPosts] = useState<TimelinePost[]>(initialPosts);
  const [predictionOutcomes, setPredictionOutcomes] = useState<Record<string, string>>(initialOutcomes);
  const [newPostCount, setNewPostCount] = useState(0);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track how many posts were added via realtime so offset stays correct
  const realtimeInsertCount = useRef(0);

  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= PAGE_SIZE);
    realtimeInsertCount.current = 0;
  }, [initialPosts]);

  useEffect(() => {
    setPredictionOutcomes(initialOutcomes);
  }, [initialOutcomes]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("timeline-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "timeline_posts",
          filter: "parent_post_id=is.null", // only top-level posts
        },
        (payload) => {
          const row = payload.new as DbTimelinePost;
          const newPost = dbPostToTimelinePost(row, []);
          // Skip unpublished posts on the public timeline
          if (row.published_at && new Date(row.published_at) > new Date()) {
            return;
          }
          setPosts((prev) => [newPost, ...prev]);
          realtimeInsertCount.current += 1;
          if (typeof window !== "undefined" && window.scrollY > 200) {
            setNewPostCount((c) => c + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "timeline_posts",
        },
        (payload) => {
          const updated = dbPostToTimelinePost(
            payload.new as DbTimelinePost,
            []
          );
          setPosts((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...updated, replies: p.replies } : p))
          );
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          retryCount.current = 0;
        }
        if (status === "CHANNEL_ERROR") {
          const detail = err instanceof Error ? err.message : String(err ?? "unknown");
          console.warn(`[realtime] Channel error: ${detail}`);
          if (retryCount.current < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * 2 ** retryCount.current;
            retryCount.current += 1;
            console.warn(`[realtime] Retrying in ${delay}ms (${retryCount.current}/${MAX_RETRIES})`);
            retryTimer.current = setTimeout(() => channel.subscribe(), delay);
          }
        }
        if (status === "TIMED_OUT") {
          console.warn("[realtime] Subscription timed out, retrying...");
          channel.subscribe();
        }
      });

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const supabase = createClient();
    // Offset = total posts minus realtime inserts (those are prepended, not from DB pagination)
    const currentDbCount = posts.length - realtimeInsertCount.current;
    const offset = currentDbCount;

    (async () => {
      try {
        // Fetch next page of posts
        let query = supabase
          .from("timeline_posts")
          .select("*")
          .is("parent_post_id", null)
          .lte("published_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        let { data, error } = await query;

        // Fallback if published_at column doesn't exist
        if (error && error.code === "42703") {
          query = supabase
            .from("timeline_posts")
            .select("*")
            .is("parent_post_id", null)
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);
          const fallback = await query;
          data = fallback.data;
          error = fallback.error;
        }

        if (error || !data) {
          console.error("[loadMore] Failed to fetch posts:", error?.message);
          return;
        }

        const rows = data as DbTimelinePost[];
        if (rows.length < PAGE_SIZE) {
          setHasMore(false);
        }

        const newPosts = rows.map((r) => dbPostToTimelinePost(r, []));

        // Deduplicate: realtime may have already added some of these
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = newPosts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });

        // Fetch prediction outcomes for new posts
        const newPostIds = rows
          .filter((r) => r.post_type === "prediction" || r.direction !== "neutral")
          .map((r) => r.id);

        if (newPostIds.length > 0) {
          const { data: predictions } = await supabase
            .from("predictions")
            .select("post_id, resolved, direction_score")
            .in("post_id", newPostIds);

          if (predictions) {
            const newOutcomes: Record<string, string> = {};
            for (const row of predictions) {
              const postId = row.post_id as string;
              const resolved = row.resolved as boolean;
              if (!resolved) {
                newOutcomes[postId] = "pending";
              } else {
                const score = Number(row.direction_score);
                newOutcomes[postId] = score >= 0.5 ? "correct" : "incorrect";
              }
            }
            setPredictionOutcomes((prev) => ({ ...prev, ...newOutcomes }));
          }
        }
      } catch (err) {
        console.error("[loadMore] Unexpected error:", err);
      } finally {
        setIsLoadingMore(false);
      }
    })();
  }, [posts.length, isLoadingMore, hasMore]);

  const acknowledgeNewPosts = useCallback(() => {
    setNewPostCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { posts, newPostCount, acknowledgeNewPosts, predictionOutcomes, loadMore, hasMore, isLoadingMore };
}
