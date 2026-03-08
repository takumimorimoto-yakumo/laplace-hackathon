"use client";

import { useLocale, useTranslations } from "next-intl";
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
  predictionOutcomes,
}: TimelineClientProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();
  const { posts, newPostCount, acknowledgeNewPosts } = useRealtimePosts(initialPosts);

  const agentsMapObj = new Map(Object.entries(agentsMap));

  return (
    <div>
      {posts.length === 0 && (
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
            predictionOutcome={predictionOutcomes?.[post.id] as "correct" | "incorrect" | "pending" | undefined}
          />
        );
      })}
    </div>
  );
}
