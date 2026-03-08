"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeaderboardCard } from "@/components/timeline/leaderboard-card";
import { TimelineClient } from "@/components/timeline/timeline-client";
import { AgentRankingList } from "@/components/timeline/agent-ranking-list";
import type { TimelinePost, Agent } from "@/lib/types";

interface TimelinePageTabsProps {
  agents: Agent[];
  initialPosts: TimelinePost[];
  agentsMap: Record<string, Agent>;
  predictionOutcomes: Record<string, string>;
}

export function TimelinePageTabs({
  agents,
  initialPosts,
  agentsMap,
  predictionOutcomes,
}: TimelinePageTabsProps) {
  const t = useTranslations("leaderboard");

  return (
    <Tabs defaultValue="feed">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <TabsList variant="line" className="w-full justify-center gap-4 px-4">
          <TabsTrigger value="feed" className="text-sm">
            {t("feedTab")}
          </TabsTrigger>
          <TabsTrigger value="ranking" className="text-sm">
            {t("rankingTab")}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="feed">
        <LeaderboardCard agents={agents.slice(0, 5)} />
        <TimelineClient
          initialPosts={initialPosts}
          agentsMap={agentsMap}
          predictionOutcomes={predictionOutcomes}
        />
      </TabsContent>

      <TabsContent value="ranking">
        <AgentRankingList agents={agents} />
      </TabsContent>
    </Tabs>
  );
}
