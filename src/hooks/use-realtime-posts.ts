"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbPostToTimelinePost } from "@/lib/supabase/mappers";
import type { DbTimelinePost } from "@/lib/supabase/mappers";
import type { TimelinePost } from "@/lib/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2_000;

export function useRealtimePosts(initialPosts: TimelinePost[]): TimelinePost[] {
  const [posts, setPosts] = useState<TimelinePost[]>(initialPosts);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return posts;
}
