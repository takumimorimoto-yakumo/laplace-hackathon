"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbPostToTimelinePost } from "@/lib/supabase/mappers";
import type { DbTimelinePost } from "@/lib/supabase/mappers";
import type { TimelinePost } from "@/lib/types";

export function useUserPostBookmarks(walletAddress: string | null) {
  const [bookmarkedPosts, setBookmarkedPosts] = useState<TimelinePost[]>([]);
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("user_post_bookmarks")
      .select("post_id, timeline_posts(*)")
      .eq("user_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch bookmarked posts:", error.message);
          return;
        }
        const posts: TimelinePost[] = [];
        const ids = new Set<string>();
        for (const row of data ?? []) {
          ids.add(row.post_id as string);
          const postData = row.timeline_posts as unknown as DbTimelinePost | null;
          if (postData) {
            posts.push(dbPostToTimelinePost(postData));
          }
        }
        setBookmarkedPosts(posts);
        setBookmarkedPostIds(ids);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  const toggleBookmark = useCallback(
    async (postId: string) => {
      if (!walletAddress) return;

      if (bookmarkedPostIds.has(postId)) {
        const { error } = await supabase
          .from("user_post_bookmarks")
          .delete()
          .eq("user_wallet", walletAddress)
          .eq("post_id", postId);
        if (!error) {
          setBookmarkedPostIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
          });
          setBookmarkedPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      } else {
        const { error } = await supabase
          .from("user_post_bookmarks")
          .insert({ user_wallet: walletAddress, post_id: postId });
        if (!error) {
          setBookmarkedPostIds((prev) => new Set(prev).add(postId));
        }
      }
    },
    [walletAddress, bookmarkedPostIds, supabase]
  );

  return { bookmarkedPosts, bookmarkedPostIds, toggleBookmark };
}
