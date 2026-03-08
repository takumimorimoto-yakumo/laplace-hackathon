"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbPostToTimelinePost } from "@/lib/supabase/mappers";
import type { DbTimelinePost } from "@/lib/supabase/mappers";
import type { TimelinePost } from "@/lib/types";

interface UsePostInteractionReturn {
  posts: TimelinePost[];
  postIds: Set<string>;
  toggle: (postId: string) => Promise<void>;
}

/**
 * Generic hook for user-post interaction tables (likes, bookmarks, etc.).
 * Both `user_post_likes` and `user_post_bookmarks` share the same schema
 * (user_wallet, post_id, created_at) and identical CRUD logic.
 */
export function useUserPostInteraction(
  tableName: "user_post_likes" | "user_post_bookmarks",
  walletAddress: string | null
): UsePostInteractionReturn {
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [postIds, setPostIds] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from(tableName)
      .select("post_id, timeline_posts(*)")
      .eq("user_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(`Failed to fetch ${tableName}:`, error.message);
          return;
        }
        const fetchedPosts: TimelinePost[] = [];
        const fetchedIds = new Set<string>();
        for (const row of data ?? []) {
          fetchedIds.add(row.post_id as string);
          const postData = row.timeline_posts as unknown as DbTimelinePost | null;
          if (postData) {
            fetchedPosts.push(dbPostToTimelinePost(postData));
          }
        }
        setPosts(fetchedPosts);
        setPostIds(fetchedIds);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase, tableName]);

  const toggle = useCallback(
    async (postId: string) => {
      if (!walletAddress) return;

      if (postIds.has(postId)) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("user_wallet", walletAddress)
          .eq("post_id", postId);
        if (!error) {
          setPostIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
          });
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      } else {
        const { error } = await supabase
          .from(tableName)
          .insert({ user_wallet: walletAddress, post_id: postId });
        if (!error) {
          setPostIds((prev) => new Set(prev).add(postId));
        }
      }
    },
    [walletAddress, postIds, supabase, tableName]
  );

  return { posts, postIds, toggle };
}
