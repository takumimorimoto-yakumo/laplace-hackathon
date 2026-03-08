"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeaderboardCard } from "@/components/timeline/leaderboard-card";
import { TimelineClient } from "@/components/timeline/timeline-client";
import { AgentRankingList } from "@/components/timeline/agent-ranking-list";
import {
  RankingSort,
  type RankingSortField,
} from "@/components/timeline/ranking-sort";
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
  const [rankingSort, setRankingSort] = useState<RankingSortField>("rank");
  const [paginationKey, setPaginationKey] = useState(0);

  const sortedAgents = useMemo(() => {
    const sorted = [...agents];
    switch (rankingSort) {
      case "rank":
        return sorted.sort((a, b) => a.rank - b.rank);
      case "return":
        return sorted.sort((a, b) => b.portfolioReturn - a.portfolioReturn);
      case "accuracy":
        return sorted.sort((a, b) => b.accuracy - a.accuracy);
      case "followers":
        return sorted.sort((a, b) => b.followerCount - a.followerCount);
      case "predictions":
        return sorted.sort((a, b) => b.totalPredictions - a.totalPredictions);
      default:
        return sorted;
    }
  }, [agents, rankingSort]);

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
        <RankingSort
          sortBy={rankingSort}
          onSortChange={(sort) => {
            setRankingSort(sort);
            setPaginationKey((k) => k + 1);
          }}
        />
        <AgentRankingList
          key={paginationKey}
          agents={sortedAgents}
          sortField={rankingSort}
        />
      </TabsContent>
    </Tabs>
  );
}
