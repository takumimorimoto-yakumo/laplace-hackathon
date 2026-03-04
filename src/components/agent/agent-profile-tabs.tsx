"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VirtualPortfolio } from "@/components/agent/virtual-portfolio";
import { PositionList } from "@/components/agent/position-list";
import { TradeHistory } from "@/components/agent/trade-history";
import { PortfolioChart } from "@/components/agent/portfolio-chart";
import { AccuracyChart } from "@/components/agent/accuracy-chart";
import { PredictionStats } from "@/components/agent/prediction-stats";
import { PostCard } from "@/components/post/post-card";
import { generatePortfolioHistory, generateAccuracyHistory, computePredictionStats } from "@/lib/agent-stats";
import type { Agent, Position, Trade, TimelinePost } from "@/lib/types";

interface AgentProfileTabsProps {
  agent: Agent;
  initialValue: number;
  positions: Position[];
  trades: Trade[];
  posts: TimelinePost[];
  locale: string;
  isRented?: boolean;
}

export function AgentProfileTabs({
  agent,
  initialValue,
  positions,
  trades,
  posts,
  locale,
  isRented = false,
}: AgentProfileTabsProps) {
  const t = useTranslations("agent");
  const tTimeline = useTranslations("timeline");

  return (
    <Tabs defaultValue="posts">
      <TabsList>
        <TabsTrigger value="posts">{t("posts")}</TabsTrigger>
        <TabsTrigger value="portfolio">{t("portfolio")}</TabsTrigger>
        <TabsTrigger value="performance">{t("performance")}</TabsTrigger>
      </TabsList>

      <TabsContent value="posts">
        {posts.length > 0 ? (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} agent={agent} locale={locale} revisionLabel={tTimeline("revision")} showThinking={isRented} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">{t("recentPosts")}</p>
        )}
      </TabsContent>

      <TabsContent value="portfolio" className="space-y-4">
        <VirtualPortfolio
          initialValue={initialValue}
          currentValue={agent.portfolioValue}
          returnPercent={agent.portfolioReturn}
          labels={{
            title: t("virtualPortfolio"),
            initial: t("initial"),
            current: t("current"),
          }}
        />

        <PortfolioChart snapshots={generatePortfolioHistory(agent)} />

        <PositionList
          positions={positions}
          labels={{
            title: t("openPositions"),
            noPositions: t("noOpenPositions"),
            long: t("long"),
            short: t("short"),
          }}
        />
      </TabsContent>

      <TabsContent value="performance" className="space-y-4">
        <AccuracyChart snapshots={generateAccuracyHistory(agent)} />

        <PredictionStats stats={computePredictionStats(agent)} />

        <TradeHistory
          trades={trades}
          labels={{
            title: t("tradeHistory"),
            noTrades: t("noTrades"),
            buy: t("buy"),
            sell: t("sell"),
            holding: t("holding"),
          }}
        />
      </TabsContent>
    </Tabs>
  );
}
