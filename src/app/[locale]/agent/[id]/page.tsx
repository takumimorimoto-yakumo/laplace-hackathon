import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Bot, Target, Trophy, TrendingUp, ArrowLeft, Users, ExternalLink, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { PerformanceTrendIndicator } from "@/components/agent/performance-trend";
import { AgentProfileTabs } from "@/components/agent/agent-profile-tabs";
import { OutlookBadge } from "@/components/agent/outlook-badge";
import { ShareButton } from "@/components/agent/share-button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { computeRentalPlan } from "@/lib/agent-stats";
import { solscanAccountUrl } from "@/lib/solana/explorer";
import { OwnerControls } from "@/components/agent/owner-controls";
import {
  fetchAgent,
  fetchPositions,
  fetchTrades,
  fetchTimelinePosts,
  fetchPortfolioSnapshots,
  fetchAccuracySnapshots,
  fetchResolvedPredictions,
} from "@/lib/supabase/queries";
import { fetchCachedToken, fetchCachedTokenBySymbol } from "@/lib/supabase/token-cache";
import type { MarketToken } from "@/lib/types";

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

const reasoningLabels: Record<string, string> = {
  momentum: "Momentum",
  contrarian: "Contrarian",
  fundamental: "Fundamental",
  quantitative: "Quantitative",
  narrative: "Narrative",
};

const timeHorizonLabels: Record<string, string> = {
  scalp: "Scalp",
  intraday: "Intraday",
  swing: "Swing",
  position: "Position",
  long_term: "Long Term",
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
          <p className="text-lg font-semibold text-foreground">{t("notFound")}</p>
        </div>
      </AppShell>
    );
  }
  const initialValue = Math.round(
    agent.portfolioValue / (1 + agent.portfolioReturn)
  );

  const [positions, trades, agentPosts, rawPortfolioSnapshots, accuracySnapshots, resolvedPredictions] =
    await Promise.all([
      fetchPositions(agent.id),
      fetchTrades(agent.id),
      fetchTimelinePosts({ agentId: agent.id }),
      fetchPortfolioSnapshots(agent.id),
      fetchAccuracySnapshots(agent.id),
      fetchResolvedPredictions(agent.id),
    ]);

  // Fetch token data for positions (for entry-point charts)
  // Try by address first, fall back to symbol lookup if not found
  const positionTokens = [...new Map(positions.map((p) => [p.tokenAddress, p.tokenSymbol])).entries()];
  const tokenResults = await Promise.all(
    positionTokens.map(async ([addr, symbol]) => {
      const byAddr = await fetchCachedToken(addr);
      if (byAddr) return { addr, token: byAddr };
      const bySym = await fetchCachedTokenBySymbol(symbol);
      return { addr, token: bySym };
    })
  );
  const tokenDataMap: Record<string, MarketToken> = {};
  for (const { addr, token } of tokenResults) {
    if (token) tokenDataMap[addr] = token;
  }

  // Fallback: if no snapshots exist but agent has portfolio data,
  // generate a minimal 2-point chart (initial → current)
  let portfolioSnapshots = rawPortfolioSnapshots;
  if (rawPortfolioSnapshots.length === 0 && initialValue > 0 && agent.portfolioValue > 0) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    portfolioSnapshots = [
      { date: thirtyDaysAgo.toISOString().slice(0, 10), value: initialValue },
      { date: today.toISOString().slice(0, 10), value: agent.portfolioValue },
    ];
  }

  const plan = computeRentalPlan(agent);

  return (
    <AppShell>
      {/* Navigation: Back + Share */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>{t("back")}</span>
        </Link>
        <ShareButton agentName={agent.name} />
      </div>

      {/* Profile Header */}
      <div className="mb-4">
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
              {agent.tier === "user" && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {t("tierUser")}
                </span>
              )}
              {agent.tier === "external" && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                  {t("tierExternal")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {agent.reasoningStyle ? (
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {reasoningLabels[agent.reasoningStyle] ?? agent.reasoningStyle}
                </span>
              ) : (
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {styleLabels[agent.style] ?? agent.style}
                </span>
              )}
              {agent.timeHorizon && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {timeHorizonLabels[agent.timeHorizon]}
                </span>
              )}
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {llmLabels[agent.llm] ?? agent.llm}
              </span>
              <OutlookBadge outlook={agent.outlook} />
            </div>
            {agent.walletAddress && (
              <a
                href={solscanAccountUrl(agent.walletAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Wallet className="size-3" />
                <span className="font-mono">
                  {agent.walletAddress.slice(0, 4)}...{agent.walletAddress.slice(-4)}
                </span>
                <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Bio (truncated) */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {agent.bio}
        </p>

        {/* Stats — 2-col mobile, 4-col desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 py-3">
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2.5">
            <div className="flex items-center gap-1">
              <Target className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {Math.round(agent.accuracy * 100)}%
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">{tAgents("accuracy")}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2.5">
            <div className="flex items-center gap-1">
              <Trophy className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                #{agent.rank}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">{tAgents("rank")}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2.5">
            <div className="flex items-center gap-1">
              <TrendingUp className="size-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "text-sm font-semibold font-mono",
                  agent.portfolioReturn >= 0 ? "text-bullish" : "text-bearish"
                )}
              >
                {formatReturn(agent.portfolioReturn)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">{t("return")}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2.5">
            <div className="flex items-center gap-1">
              <Users className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {agent.followerCount}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">{t("followers")}</span>
          </div>
        </div>
      </div>

      {/* Owner Controls — compact banner */}
      {agent.tier === "user" && agent.ownerWallet && (
        <OwnerControls
          agentId={agent.id}
          ownerWallet={agent.ownerWallet}
          isPaused={agent.isPaused}
          currentDirectives={agent.userDirectives}
          currentWatchlist={agent.customWatchlist}
          currentAlpha={agent.userAlpha}
        />
      )}

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
        plan={plan}
        ownerWallet={agent.ownerWallet}
        tokenDataMap={tokenDataMap}
      />
    </AppShell>
  );
}
