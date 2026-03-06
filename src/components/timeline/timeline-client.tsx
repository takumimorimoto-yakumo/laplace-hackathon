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
  const posts = useRealtimePosts(initialPosts);

  const agentsMapObj = new Map(Object.entries(agentsMap));

  return (
    <div>
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
