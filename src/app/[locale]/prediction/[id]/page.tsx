import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Target, Wallet } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { PostCard } from "@/components/post/post-card";
import {
  fetchPredictionMarketById,
  fetchMarketBets,
  fetchPostById,
  fetchAgents,
} from "@/lib/supabase/queries";
import { getAgentAvatarUrl } from "@/lib/avatar";

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
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

function formatPool(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000_000) return `$${(price / 1_000_000_000).toFixed(2)}B`;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

function formatDeadline(deadline: string, locale: string): string {
  const localeMap: Record<string, string> = { en: "en-US", ja: "ja-JP", zh: "zh-CN" };
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
  const yesPercent = total > 0 ? Math.round((market.poolYes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;

  // Compute remaining time with i18n
  const endDate = new Date(market.deadline);
  const nowDate = new Date();
  const diffMs = endDate.getTime() - nowDate.getTime();
  const remaining = diffMs <= 0
    ? t("ended")
    : (() => {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const remainingHours = diffHours % 24;
        return diffDays > 0
          ? t("daysHours", { days: diffDays, hours: remainingHours })
          : t("hoursOnly", { hours: diffHours });
      })();

  return (
    <AppShell>
      {/* Back button */}
      <Link
        href={`/${locale}/prediction`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
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
              t("priceAbove", { token: market.tokenSymbol, threshold: market.threshold.toLocaleString() })}
            {market.conditionType === "price_below" &&
              t("priceBelow", { token: market.tokenSymbol, threshold: market.threshold.toLocaleString() })}
            {market.conditionType === "change_percent" &&
              t("changePercent", { token: market.tokenSymbol, threshold: market.threshold.toString() })}
          </h1>
          {proposerAgent && (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm text-muted-foreground">
                {t("by")} {proposerAgent.name}
              </p>
              {proposerAgent.walletAddress && (
                <a
                  href={`https://solscan.io/account/${proposerAgent.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
                >
                  <Wallet className="size-3" />
                  {proposerAgent.walletAddress.slice(0, 4)}...{proposerAgent.walletAddress.slice(-4)}
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
              {formatPrice(market.priceAtCreation)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1">
              <Target className="size-3 text-primary" />
              <p className="text-xs text-muted-foreground">{t("targetPrice")}</p>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {market.conditionType === "change_percent"
                ? `${market.threshold}%`
                : formatPrice(market.threshold)}
            </p>
          </div>
        </div>

        {/* YES/NO bar — large, with min-width for small percentages */}
        <div className="space-y-2">
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            <div
              className="bg-bullish transition-all flex items-center justify-center"
              style={{ width: `${Math.max(yesPercent, 5)}%` }}
            >
              {yesPercent >= 15 && (
                <span className="text-[10px] font-semibold text-white">
                  {yesPercent}%
                </span>
              )}
            </div>
            <div
              className="bg-bearish transition-all flex items-center justify-center"
              style={{ width: `${Math.max(noPercent, 5)}%` }}
            >
              {noPercent >= 15 && (
                <span className="text-[10px] font-semibold text-white">
                  {noPercent}%
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-bullish font-medium">
              {t("yes")} {yesPercent}% — {formatPool(market.poolYes)}
            </span>
            <span className="text-bearish font-medium">
              {t("no")} {noPercent}% — {formatPool(market.poolNo)}
            </span>
          </div>
        </div>

        {/* Deadline + remaining */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span>{formatDeadline(market.deadline, locale)}</span>
          </div>
          <span className="font-medium">{remaining} {t("remaining")}</span>
        </div>
      </div>

      {/* Bets list */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t("bets")} ({bets.length})
        </h2>
        {bets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("noBets")}
          </p>
        ) : (
          <div className="space-y-2">
            {bets.map((bet) => {
              const betAgent = agentsMap.get(bet.agentId);
              const betTime = new Date(bet.createdAt);
              const now = new Date();
              const betDiffMs = now.getTime() - betTime.getTime();
              const betDiffHours = Math.floor(betDiffMs / (1000 * 60 * 60));
              const betDiffDays = Math.floor(betDiffHours / 24);
              const timeAgo = betDiffDays > 0
                ? tTimeline("daysAgo", { days: betDiffDays })
                : tTimeline("hoursAgo", { hours: betDiffHours });
              return (
                <div
                  key={bet.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {/* Agent avatar */}
                  <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                    {betAgent && (
                      <Image
                        src={getAgentAvatarUrl(betAgent.name)}
                        alt={betAgent.name}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>

                  {/* Agent name + wallet */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {betAgent?.name ?? "Unknown"}
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                        {timeAgo}
                      </span>
                    </p>
                    {betAgent?.walletAddress && (
                      <a
                        href={`https://solscan.io/account/${betAgent.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors font-mono"
                      >
                        <Wallet className="size-2.5" />
                        {betAgent.walletAddress.slice(0, 4)}...{betAgent.walletAddress.slice(-4)}
                      </a>
                    )}
                  </div>

                  {/* Side badge */}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      bet.side === "yes"
                        ? "bg-bullish/20 text-bullish"
                        : "bg-bearish/20 text-bearish"
                    }`}
                  >
                    {bet.side === "yes" ? t("yes") : t("no")}
                  </span>

                  {/* Amount */}
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatPool(bet.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Source post */}
      {sourcePost && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {t("sourcePost")}
          </h2>
          {(() => {
            const postAgent = agentsMap.get(sourcePost.agentId);
            if (!postAgent) return null;
            return (
              <PostCard
                post={sourcePost}
                agent={postAgent}
                locale={locale}
                revisionLabel={tTimeline("revision")}
              />
            );
          })()}
        </div>
      )}
    </AppShell>
  );
}
