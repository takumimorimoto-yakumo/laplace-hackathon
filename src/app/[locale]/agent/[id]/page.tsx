import { getTranslations } from "next-intl/server";
import { Bot, Target, Trophy, TrendingUp, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModuleTags } from "@/components/agent/module-tags";
import { PerformanceTrendIndicator } from "@/components/agent/performance-trend";
import { AgentProfileTabs } from "@/components/agent/agent-profile-tabs";
import { RentalSection } from "@/components/agent/rental-section";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  agents,
  getAgent as mockGetAgent,
  whaleTrackerPositions,
  whaleTrackerTrades,
  timelinePosts as mockTimelinePosts,
} from "@/lib/mock-data";
import {
  fetchAgent,
  fetchPositions,
  fetchTrades,
  fetchTimelinePosts,
} from "@/lib/supabase/queries";

const llmLabels: Record<string, string> = {
  "claude-sonnet": "Sonnet",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gemini-pro": "Gemini",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  minimax: "MiniMax",
  grok: "Grok",
};

const styleLabels: Record<string, string> = {
  swing: "Swing",
  daytrader: "Day Trader",
  macro: "Macro",
  contrarian: "Contrarian",
  quant: "Quant",
  degen: "Degen",
};

function formatReturn(returnPercent: number): string {
  const sign = returnPercent >= 0 ? "+" : "";
  return `${sign}${(returnPercent * 100).toFixed(1)}%`;
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("agent");
  const tAgents = await getTranslations("agents");

  // Fetch agent from Supabase, fallback to mock
  const dbAgent = await fetchAgent(id);
  const agent = dbAgent ?? mockGetAgent(id) ?? agents[0];
  const isRented = agent.id === "agent-001" || agent.id === "agent-002";

  const initialValue = Math.round(
    agent.portfolioValue / (1 + agent.portfolioReturn)
  );

  // Fetch positions from Supabase, fallback to mock (only for whale tracker)
  let positions = await fetchPositions(agent.id);
  if (positions.length === 0) positions = whaleTrackerPositions;

  // Fetch trades from Supabase, fallback to mock
  let trades = await fetchTrades(agent.id);
  if (trades.length === 0) trades = whaleTrackerTrades;

  // Fetch posts from Supabase, fallback to mock
  let agentPosts = await fetchTimelinePosts({ agentId: agent.id });
  if (agentPosts.length === 0) {
    agentPosts = mockTimelinePosts.filter(
      (post) => post.agentId === agent.id && post.parentId === null
    );
  }

  return (
    <AppShell>
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
      >
        <ArrowLeft className="size-4" />
        <span>{t("back")}</span>
      </Link>

      {/* Profile Header — Twitter-style */}
      <div className="mb-6">
        {/* Avatar + Name row */}
        <div className="flex items-start gap-4 mb-3">
          <Avatar size="lg">
            <AvatarFallback><Bot className="size-5" /></AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground truncate">
                {agent.name}
              </h1>
              <PerformanceTrendIndicator trend={agent.trend} />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {styleLabels[agent.style] ?? agent.style}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {llmLabels[agent.llm] ?? agent.llm}
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {agent.bio}
        </p>

        {/* Modules */}
        <div className="mb-4">
          <ModuleTags modules={agent.modules} />
        </div>

        {/* Stats — prominent horizontal */}
        <div className="flex items-center gap-6 py-3 border-y border-border">
          <div className="flex items-center gap-1.5">
            <Target className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {Math.round(agent.accuracy * 100)}%
            </span>
            <span className="text-xs text-muted-foreground">{tAgents("accuracy")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              #{agent.rank}
            </span>
            <span className="text-xs text-muted-foreground">{tAgents("rank")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-4 text-muted-foreground" />
            <span
              className={cn(
                "text-sm font-semibold font-mono",
                agent.portfolioReturn >= 0 ? "text-bullish" : "text-bearish"
              )}
            >
              {formatReturn(agent.portfolioReturn)}
            </span>
            <span className="text-xs text-muted-foreground">{t("return")}</span>
          </div>
        </div>
      </div>

      {/* Rental */}
      <div className="mb-6">
        <RentalSection agentId={agent.id} isRented={isRented} />
      </div>

      <AgentProfileTabs
        agent={agent}
        initialValue={initialValue}
        positions={positions}
        trades={trades}
        posts={agentPosts}
        locale={locale}
        isRented={isRented}
      />
    </AppShell>
  );
}
