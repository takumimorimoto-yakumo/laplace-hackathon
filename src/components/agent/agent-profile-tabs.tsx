"use client";

import { useTranslations } from "next-intl";
import { MessageSquare, Briefcase, BarChart3, Info } from "lucide-react";
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
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useWallet } from "@/components/wallet/wallet-provider";
import type { Agent, Position, Trade, TimelinePost, PortfolioSnapshot, AccuracySnapshot, AgentRentalPlan, MarketToken } from "@/lib/types";
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
  tokenDataMap?: Record<string, MarketToken>;
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
  tokenDataMap,
}: AgentProfileTabsProps) {
  const t = useTranslations("agent");
  const tTimeline = useTranslations("timeline");
  const isRented = useIsRented(agent.id);
  const isAdmin = useIsAdmin();
  const { publicKey } = useWallet();
  const connectedWallet = publicKey?.toBase58();
  const isOwner = !!connectedWallet && !!ownerWallet && connectedWallet === ownerWallet;

  return (
    <Tabs defaultValue="posts">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto scrollbar-hide">
        <TabsTrigger value="posts" className="flex-none"><MessageSquare className="size-4" /> {t("posts")}</TabsTrigger>
        <TabsTrigger value="portfolio" className="flex-none"><Briefcase className="size-4" /> {t("portfolio")}</TabsTrigger>
        <TabsTrigger value="performance" className="flex-none"><BarChart3 className="size-4" /> {t("performance")}</TabsTrigger>
        <TabsTrigger value="about" className="flex-none"><Info className="size-4" /> {t("about")}</TabsTrigger>
      </TabsList>

      <TabsContent value="posts">
        {posts.length > 0 ? (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} agent={agent} locale={locale} revisionLabel={tTimeline("revision")} showThinking={isRented || isAdmin} />
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
          return24h={agent.return24h}
          return7d={agent.return7d}
          return30d={agent.return30d}
          labels={{
            title: t("virtualPortfolio"),
            initial: t("initial"),
            current: t("current"),
            periodReturns: {
              period24h: t("period24h"),
              period7d: t("period7d"),
              period30d: t("period30d"),
            },
          }}
        />

        <PortfolioChart snapshots={portfolioSnapshots} />

        <PositionList
          positions={positions}
          trades={trades}
          agentId={agent.id}
          agentName={agent.name}
          tokenDataMap={tokenDataMap}
          showStrategy={isRented || isOwner || isAdmin}
        />
      </TabsContent>

      <TabsContent value="performance" className="space-y-4">
        <PredictionStats stats={computePredictionStats(resolvedPredictions, agent)} />

        <AccuracyChart snapshots={accuracySnapshots} />

        <ResolvedPredictions predictions={resolvedPredictions} locale={locale} />

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

      <TabsContent value="about" className="space-y-3">
        {/* Full bio */}
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("aboutAgent")}</h3>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {agent.bio}
          </p>
        </div>

        {/* Personality */}
        {agent.personality && (
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("personalityTitle")}</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {agent.personality}
            </p>
          </div>
        )}

        {/* Modules */}
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Modules</h3>
          <ModuleTags modules={agent.modules} />
        </div>

        {/* Rental */}
        <RentalSection plan={plan} isRented={isRented} />

        {/* Premium Features (visible when rented or admin) */}
        {(isRented || isAdmin) && (
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
