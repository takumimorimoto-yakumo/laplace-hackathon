"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VirtualPortfolio } from "@/components/agent/virtual-portfolio";
import { PositionList } from "@/components/agent/position-list";
import { TradeHistory } from "@/components/agent/trade-history";
import { PortfolioChart } from "@/components/agent/portfolio-chart";
import { AccuracyChart } from "@/components/agent/accuracy-chart";
import { ResolvedPredictions } from "@/components/agent/resolved-predictions";
import { PredictionStats } from "@/components/agent/prediction-stats";
import { PostCard } from "@/components/post/post-card";
import { RentalSection } from "@/components/agent/rental-section";
import { ChatButton } from "@/components/agent/chat-button";
import { AnalysisRequestForm } from "@/components/agent/analysis-request-form";
import { EarningsSection } from "@/components/agent/earnings-section";
import { ModuleTags } from "@/components/agent/module-tags";
import { computePredictionStats } from "@/lib/agent-stats";
import { useIsRented } from "@/hooks/use-is-rented";
import type { Agent, Position, Trade, TimelinePost, PortfolioSnapshot, AccuracySnapshot, AgentRentalPlan } from "@/lib/types";
import type { ResolvedPrediction } from "@/lib/supabase/queries";

interface AgentProfileTabsProps {
  agent: Agent;
  initialValue: number;
  positions: Position[];
  trades: Trade[];
  posts: TimelinePost[];
  portfolioSnapshots: PortfolioSnapshot[];
  accuracySnapshots: AccuracySnapshot[];
  resolvedPredictions: ResolvedPrediction[];
  locale: string;
  plan: AgentRentalPlan;
  ownerWallet?: string;
}

export function AgentProfileTabs({
  agent,
  initialValue,
  positions,
  trades,
  posts,
  portfolioSnapshots,
  accuracySnapshots,
  resolvedPredictions,
  locale,
  plan,
  ownerWallet,
}: AgentProfileTabsProps) {
  const t = useTranslations("agent");
  const tTimeline = useTranslations("timeline");
  const isRented = useIsRented(agent.id);

  return (
    <Tabs defaultValue="posts">
      <TabsList>
        <TabsTrigger value="posts">{t("posts")}</TabsTrigger>
        <TabsTrigger value="portfolio">{t("portfolio")}</TabsTrigger>
        <TabsTrigger value="performance">{t("performance")}</TabsTrigger>
        <TabsTrigger value="about">{t("about")}</TabsTrigger>
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

        <PortfolioChart snapshots={portfolioSnapshots} />

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
        <AccuracyChart snapshots={accuracySnapshots} />

        <ResolvedPredictions predictions={resolvedPredictions} />

        <PredictionStats stats={computePredictionStats(resolvedPredictions, agent)} />

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

      <TabsContent value="about" className="space-y-4">
        {/* Full bio */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1.5">{t("aboutAgent")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {agent.bio}
          </p>
        </div>

        {/* Personality */}
        {agent.personality && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1.5">{t("personalityTitle")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {agent.personality}
            </p>
          </div>
        )}

        {/* Modules */}
        <div>
          <ModuleTags modules={agent.modules} />
        </div>

        {/* Rental */}
        <RentalSection plan={plan} isRented={isRented} />

        {/* Premium Features (visible when rented) */}
        {isRented && (
          <div className="flex flex-col gap-3">
            <ChatButton agentId={agent.id} agentName={agent.name} />
            <AnalysisRequestForm agentId={agent.id} />
          </div>
        )}

        {/* Earnings (owner only) */}
        {agent.tier === "user" && ownerWallet && (
          <EarningsSection agentId={agent.id} ownerWallet={ownerWallet} />
        )}
      </TabsContent>
    </Tabs>
  );
}
