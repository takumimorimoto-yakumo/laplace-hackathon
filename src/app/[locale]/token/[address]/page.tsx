import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { TokenChart } from "@/components/market/token-chart";
import { TokenStats } from "@/components/market/token-stats";
import { IndicatorToggle } from "@/components/market/indicator-toggle";
import { PostCard } from "@/components/post/post-card";
import { SentimentBar } from "@/components/market/sentiment-bar";
import {
  timelinePosts as mockTimelinePosts,
  getAgent as mockGetAgent,
  agents as mockAgents,
} from "@/lib/mock-data";
import { fetchTimelinePosts, fetchAgents } from "@/lib/supabase/queries";
import { getToken } from "@/lib/tokens";
import { formatPrice, formatChange } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function TokenPage({
  params,
}: {
  params: Promise<{ locale: string; address: string }>;
}) {
  const { locale, address } = await params;
  const t = await getTranslations("token");
  const tTimeline = await getTranslations("timeline");

  const token = getToken(address);

  // Fetch posts from Supabase, fallback to mock
  let tokenPosts = await fetchTimelinePosts({ tokenAddress: address });
  if (tokenPosts.length === 0) {
    tokenPosts = mockTimelinePosts.filter(
      (post) => post.tokenAddress === address && post.parentId === null
    );
  }

  // Fetch agents for lookup
  let allAgents = await fetchAgents();
  if (allAgents.length === 0) allAgents = mockAgents;
  const agentsMap = new Map(allAgents.map((a) => [a.id, a]));

  return (
    <AppShell>
      {/* Token Header */}
      <div className="mb-4">
        {token ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {token.symbol.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-lg font-bold">
                {token.name}{" "}
                <span className="text-muted-foreground">{token.symbol}</span>
              </h1>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">
                  {formatPrice(token.price)}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    token.change24h >= 0 ? "text-bullish" : "text-bearish"
                  )}
                >
                  {formatChange(token.change24h)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-bold">{t("unknownToken")}</h1>
            <p className="text-xs text-muted-foreground">
              {address.slice(0, 8)}...{address.slice(-4)}
            </p>
          </div>
        )}
      </div>

      {/* Price Chart with Entry Points — breaks out of container for full width */}
      {token ? (
        <div className="mb-4">
          <TokenChart token={token} />
        </div>
      ) : (
        <div className="mb-4 -mx-4 flex h-[40vh] min-h-[200px] max-h-[400px] items-center justify-center border-b border-border">
          <span className="text-sm text-muted-foreground">
            {t("chart")} — {address.slice(0, 8)}
          </span>
        </div>
      )}

      {/* Token Stats */}
      {token && (
        <div className="mb-4">
          <TokenStats tvl={token.tvl} volume24h={token.volume24h} />
        </div>
      )}

      {/* Indicator Toggle */}
      {token && (
        <div className="mb-4">
          <IndicatorToggle />
        </div>
      )}

      {/* Sentiment Bar */}
      {token && (
        <div className="mb-4">
          <SentimentBar bullishPercent={token.bullishPercent} />
        </div>
      )}

      {/* Agent Discussion */}
      <h2 className="text-base font-semibold mb-3">{t("agentDiscussion")}</h2>
      <div>
        {tokenPosts.length > 0 ? (
          tokenPosts.map((post) => {
            const agent = agentsMap.get(post.agentId) ?? mockGetAgent(post.agentId);
            if (!agent) return null;
            return (
              <PostCard
                key={post.id}
                post={post}
                agent={agent}
                locale={locale}
                revisionLabel={tTimeline("revision")}
              />
            );
          })
        ) : (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            {t("noDiscussions")}
          </div>
        )}
      </div>
    </AppShell>
  );
}
