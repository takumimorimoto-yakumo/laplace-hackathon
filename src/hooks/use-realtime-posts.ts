"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbPostToTimelinePost } from "@/lib/supabase/mappers";
import type { DbTimelinePost } from "@/lib/supabase/mappers";
import type { TimelinePost } from "@/lib/types";

export function useRealtimePosts(initialPosts: TimelinePost[]): TimelinePost[] {
  const [posts, setPosts] = useState<TimelinePost[]>(initialPosts);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

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
          const newPost = dbPostToTimelinePost(
            payload.new as DbTimelinePost,
            []
          );
          setPosts((prev) => [newPost, ...prev]);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return posts;
}
