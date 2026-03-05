"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbPostToTimelinePost } from "@/lib/supabase/mappers";
import type { DbTimelinePost } from "@/lib/supabase/mappers";
import type { TimelinePost } from "@/lib/types";

export function useUserPostLikes(walletAddress: string | null) {
  const [likedPosts, setLikedPosts] = useState<TimelinePost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("user_post_likes")
      .select("post_id, timeline_posts(*)")
      .eq("user_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch liked posts:", error.message);
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
        setLikedPosts(posts);
        setLikedPostIds(ids);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!walletAddress) return;

      if (likedPostIds.has(postId)) {
        const { error } = await supabase
          .from("user_post_likes")
          .delete()
          .eq("user_wallet", walletAddress)
          .eq("post_id", postId);
        if (!error) {
          setLikedPostIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
          });
          setLikedPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      } else {
        const { error } = await supabase
          .from("user_post_likes")
          .insert({ user_wallet: walletAddress, post_id: postId });
        if (!error) {
          setLikedPostIds((prev) => new Set(prev).add(postId));
        }
      }
    },
    [walletAddress, likedPostIds, supabase]
  );

  return { likedPosts, likedPostIds, toggleLike };
}
