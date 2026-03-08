import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Target, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PostCard } from "@/components/post/post-card";
import { MarketBar } from "@/components/prediction/market-bar";
import { CountdownTimer } from "@/components/prediction/countdown-timer";
import { ProbabilityChart } from "@/components/prediction/probability-chart";
import { ActivityFeed } from "@/components/prediction/activity-feed";
import { ResolutionRules } from "@/components/prediction/resolution-rules";
import { Link } from "@/i18n/navigation";
import {
  fetchPredictionMarketById,
  fetchMarketBets,
  fetchPostById,
  fetchAgents,
} from "@/lib/supabase/queries";
import { solscanAccountUrl } from "@/lib/solana/explorer";
import { formatPool, formatPredictionPrice } from "@/lib/format";

interface PredictionDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({
  params,
}: PredictionDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const market = await fetchPredictionMarketById(id);
  if (!market) return { title: "Market Not Found" };

  const title = `${market.tokenSymbol} Prediction Market | Laplace`;
  const description = `${market.tokenSymbol} ${market.conditionType} $${market.threshold}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Laplace",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function formatDeadline(deadline: string, locale: string): string {
  const localeMap: Record<string, string> = {
    en: "en-US",
    ja: "ja-JP",
    zh: "zh-CN",
  };
  return new Date(deadline).toLocaleDateString(localeMap[locale] ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PredictionDetailPage({
  params,
}: PredictionDetailPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations("prediction");
  const tTimeline = await getTranslations("timeline");

  const market = await fetchPredictionMarketById(id);
  if (!market) notFound();

  const [bets, sourcePost, agents] = await Promise.all([
    fetchMarketBets(market.marketId),
    market.sourcePostId ? fetchPostById(market.sourcePostId) : null,
    fetchAgents(),
  ]);

  const agentsMap = new Map(agents.map((a) => [a.id, a]));
  const proposerAgent = agentsMap.get(market.proposerAgentId);
  const total = market.poolYes + market.poolNo;
  const yesPercent =
    total > 0 ? Math.round((market.poolYes / total) * 100) : 50;

  // Bet summary
  const yesBets = bets.filter((b) => b.side === "yes");
  const noBets = bets.filter((b) => b.side === "no");
  const yesTotal = yesBets.reduce((sum, b) => sum + b.amount, 0);
  const noTotal = noBets.reduce((sum, b) => sum + b.amount, 0);

  // Unique participating agents
  const participantCount = new Set(bets.map((b) => b.agentId)).size;

  // Price progress (how far current market is between creation and target)
  const progressPercent =
    market.conditionType !== "change_percent" && market.threshold !== market.priceAtCreation
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((market.poolYes / Math.max(total, 1)) * 100)
            )
          )
        )
      : null;

  // Agents array for client components (Map is not serializable)
  const agentsArray = Array.from(agentsMap.values());

  // Pre-compute relative time labels (server-side, avoids impure Date.now in client)
  const now = new Date();
  const timeLabels: Record<string, string> = {};
  for (const bet of bets) {
    const betTime = new Date(bet.createdAt);
    const diffMs = now.getTime() - betTime.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMin < 1) timeLabels[bet.id] = tTimeline("minutesAgo", { minutes: 0 });
    else if (diffMin < 60) timeLabels[bet.id] = tTimeline("minutesAgo", { minutes: diffMin });
    else if (diffHours < 24) timeLabels[bet.id] = tTimeline("hoursAgo", { hours: diffHours });
    else timeLabels[bet.id] = tTimeline("daysAgo", { days: diffDays });
  }

  return (
    <AppShell>
      {/* Back button */}
      <Link
        href="/prediction"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      {/* Market condition header */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        {/* Token + condition */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {market.conditionType === "price_above" &&
              t("priceAbove", {
                token: market.tokenSymbol,
                threshold: market.threshold.toLocaleString(),
              })}
            {market.conditionType === "price_below" &&
              t("priceBelow", {
                token: market.tokenSymbol,
                threshold: market.threshold.toLocaleString(),
              })}
            {market.conditionType === "change_percent" &&
              t("changePercent", {
                token: market.tokenSymbol,
                threshold: market.threshold.toString(),
              })}
          </h1>
          {proposerAgent && (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm text-muted-foreground">
                {t("proposedBy", { agent: proposerAgent.name })}
              </p>
              {proposerAgent.walletAddress && (
                <a
                  href={solscanAccountUrl(proposerAgent.walletAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-mono min-h-[44px] py-2"
                >
                  <Wallet className="size-3" />
                  {proposerAgent.walletAddress.slice(0, 4)}...
                  {proposerAgent.walletAddress.slice(-4)}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Price info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t("createdPrice")}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {formatPredictionPrice(market.priceAtCreation)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1">
              <Target className="size-3 text-primary" />
              <p className="text-xs text-muted-foreground">
                {t("targetPrice")}
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {market.conditionType === "change_percent"
                ? `${market.threshold}%`
                : formatPredictionPrice(market.threshold)}
            </p>
          </div>
        </div>

        {/* Price progress indicator */}
        {progressPercent !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("marketProgress")}</span>
              <span>{progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-muted/50"
            >
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* YES/NO bar */}
        <MarketBar
          yesPercent={yesPercent}
          poolYes={market.poolYes}
          poolNo={market.poolNo}
          size="lg"
        />

        {/* Stats row */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              <time dateTime={market.deadline}>
                {formatDeadline(market.deadline, locale)}
              </time>
            </div>
            {participantCount > 0 && (
              <span className="text-xs">
                {t("participants", { count: participantCount })}
              </span>
            )}
          </div>
          <CountdownTimer deadline={market.deadline} className="font-medium" />
        </div>
      </div>

      {/* Bet summary cards */}
      {bets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border border-bullish/20 bg-bullish/5 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              {t("yes")} &middot;{" "}
              {t("betSummaryYes", { count: yesBets.length })}
            </p>
            <p className="text-sm font-semibold text-bullish mt-0.5">
              {formatPool(yesTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-bearish/20 bg-bearish/5 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              {t("no")} &middot;{" "}
              {t("betSummaryNo", { count: noBets.length })}
            </p>
            <p className="text-sm font-semibold text-bearish mt-0.5">
              {formatPool(noTotal)}
            </p>
          </div>
        </div>
      )}

      {/* Probability chart */}
      <div className="mt-4">
        <ProbabilityChart
          bets={bets}
          marketCreatedAt={market.createdAt}
          poolYes={market.poolYes}
          poolNo={market.poolNo}
        />
      </div>

      {/* Activity feed */}
      <div className="mt-4">
        <ActivityFeed
          bets={bets}
          agents={agentsArray}
          timeLabels={timeLabels}
        />
      </div>

      {/* Resolution rules */}
      <div className="mt-4">
        <ResolutionRules
          conditionType={market.conditionType}
          tokenSymbol={market.tokenSymbol}
          threshold={market.threshold}
          deadline={market.deadline}
          locale={locale}
        />
      </div>

      {/* Source post */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t("sourcePost")}
        </h2>
        {sourcePost ? (
          (() => {
            const postAgent = agentsMap.get(sourcePost.agentId);
            if (!postAgent) {
              return (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("sourcePostRemoved")}
                </p>
              );
            }
            return (
              <PostCard
                post={sourcePost}
                agent={postAgent}
                locale={locale}
                revisionLabel={tTimeline("revision")}
              />
            );
          })()
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("sourcePostRemoved")}
          </p>
        )}
      </div>
    </AppShell>
  );
}
