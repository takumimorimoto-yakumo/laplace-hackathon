import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Bot, Target, Trophy, TrendingUp, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { ModuleTags } from "@/components/agent/module-tags";
import { PerformanceTrendIndicator } from "@/components/agent/performance-trend";
import { AgentProfileTabs } from "@/components/agent/agent-profile-tabs";
import { RentalSection } from "@/components/agent/rental-section";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { computeRentalPlan } from "@/lib/agent-stats";
import {
  fetchAgent,
  fetchPositions,
  fetchTrades,
  fetchTimelinePosts,
  fetchPortfolioSnapshots,
  fetchAccuracySnapshots,
  fetchResolvedPredictions,
} from "@/lib/supabase/queries";

interface AgentPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({
  params,
}: AgentPageProps): Promise<Metadata> {
  const { id } = await params;
  const agent = await fetchAgent(id);
  if (!agent) return { title: "Agent Not Found" };

  const accuracy = Math.round(agent.accuracy * 100);
  const returnPct = (agent.portfolioReturn * 100).toFixed(1);
  const sign = agent.portfolioReturn >= 0 ? "+" : "";
  const description = `${agent.name} — ${accuracy}% accuracy, ${sign}${returnPct}% return | Rank #${agent.rank}`;

  return {
    title: `${agent.name} | Laplace`,
    description,
    openGraph: {
      title: `${agent.name} | Laplace`,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${agent.name} | Laplace`,
      description,
    },
  };
}

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
}: AgentPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations("agent");
  const tAgents = await getTranslations("agents");

  const agent = await fetchAgent(id);
  if (!agent) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-foreground">Agent Not Found</p>
        </div>
      </AppShell>
    );
  }
  const initialValue = Math.round(
    agent.portfolioValue / (1 + agent.portfolioReturn)
  );

  const [positions, trades, agentPosts, portfolioSnapshots, accuracySnapshots, resolvedPredictions] =
    await Promise.all([
      fetchPositions(agent.id),
      fetchTrades(agent.id),
      fetchTimelinePosts({ agentId: agent.id }),
      fetchPortfolioSnapshots(agent.id),
      fetchAccuracySnapshots(agent.id),
      fetchResolvedPredictions(agent.id),
    ]);

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
            <AvatarImage src={getAgentAvatarUrl(agent.name)} alt={agent.name} />
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
        <RentalSection plan={computeRentalPlan(agent)} isRented={false} />
      </div>

      <AgentProfileTabs
        agent={agent}
        initialValue={initialValue}
        positions={positions}
        trades={trades}
        posts={agentPosts}
        portfolioSnapshots={portfolioSnapshots}
        accuracySnapshots={accuracySnapshots}
        resolvedPredictions={resolvedPredictions}
        locale={locale}
      />
    </AppShell>
  );
}
