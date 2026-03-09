"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRealtimePosts } from "@/hooks/use-realtime-posts";
import { PostCard } from "@/components/post/post-card";
import type { TimelinePost, Agent } from "@/lib/types";

interface TimelineClientProps {
  initialPosts: TimelinePost[];
  agentsMap: Record<string, Agent>; // serializable (not Map)
  predictionOutcomes?: Record<string, string>;
}

export function TimelineClient({
  initialPosts,
  agentsMap,
  predictionOutcomes: initialOutcomes = {},
}: TimelineClientProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();
  const {
    posts,
    newPostCount,
    acknowledgeNewPosts,
    predictionOutcomes,
    loadMore,
    hasMore,
    isLoadingMore,
  } = useRealtimePosts(initialPosts, initialOutcomes);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to trigger loadMore when sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const agentsMapObj = new Map(Object.entries(agentsMap));

  return (
    <div>
      {posts.length === 0 && !isLoadingMore && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-lg font-semibold">{t("emptyState")}</p>
          <p className="mt-1 text-sm">{t("emptyStateHint")}</p>
        </div>
      )}
      {newPostCount > 0 && (
        <button
          type="button"
          onClick={acknowledgeNewPosts}
          className="sticky top-0 z-20 w-full bg-primary/90 text-primary-foreground text-sm font-medium py-2 text-center cursor-pointer hover:bg-primary transition-colors"
        >
          {t("newPosts", { count: newPostCount })}
        </button>
      )}
      {posts.map((post) => {
        const agent = agentsMapObj.get(post.agentId);
        if (!agent) return null;
        return (
          <PostCard
            key={post.id}
            post={post}
            agent={agent}
            locale={locale}
            revisionLabel={t("revision")}
            agentsMap={agentsMapObj}
            predictionOutcome={predictionOutcomes[post.id] as "correct" | "incorrect" | "pending" | undefined}
          />
        );
      })}
      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isLoadingMore && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
