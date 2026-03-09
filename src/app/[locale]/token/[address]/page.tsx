import { cache } from "react";
import Image from "next/image";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TokenChart } from "@/components/market/token-chart";
import { TokenStats } from "@/components/market/token-stats";
import { WatchlistButton } from "@/components/market/watchlist-button";
import { PostCard } from "@/components/post/post-card";
import { TimeframeSentimentBar } from "@/components/market/sentiment-bar";
import { fetchTimelinePosts, fetchAgents, fetchMarketSourcePostIds, fetchPostsByIds } from "@/lib/supabase/queries";
import { fetchCachedToken } from "@/lib/supabase/token-cache";
import { fetchSingleToken, fetchTokenPrices } from "@/lib/data/jupiter-tokens";
import { resolveCoingeckoId, fetchMarketData } from "@/lib/data/coingecko";
import { formatPrice, formatChange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketToken, Agent } from "@/lib/types";

interface TokenPageProps {
  params: Promise<{ locale: string; address: string }>;
}

/**
 * Fetch live price data from CoinGecko for a known address.
 * Returns null if address is unknown or API fails.
 */
async function fetchLivePrice(address: string): Promise<{
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number | null;
  sparkline7d: number[];
} | null> {
  const cgId = resolveCoingeckoId(address);
  if (!cgId) return null;

  try {
    const data = await fetchMarketData([cgId]);
    if (!data || data.length === 0) return null;
    const d = data[0];
    return {
      price: d.currentPrice,
      change24h: d.priceChangePercentage24h,
      volume24h: d.totalVolume,
      marketCap: d.marketCap || null,
      sparkline7d: d.sparklineIn7d,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a token from DB cache, live CoinGecko overlay, or Jupiter fallback.
 * Wrapped with React cache() to deduplicate across generateMetadata + page render.
 */
const resolveToken = cache(async (address: string): Promise<MarketToken | null> => {
  // 1. Try DB cache first (primary source)
  const cached = await fetchCachedToken(address);
  if (cached) {
    // Overlay live price data on top of cached metadata
    const live = await fetchLivePrice(address);
    if (live) {
      const sparkline7d = live.sparkline7d.length > 0 ? live.sparkline7d : cached.sparkline7d;
      return {
        ...cached,
        price: live.price,
        change24h: live.change24h,
        volume24h: live.volume24h,
        marketCap: live.marketCap,
        sparkline7d,
        priceHistory48h: sparkline7d.length >= 48 ? sparkline7d.slice(-48) : sparkline7d,
      };
    }
    return cached;
  }

  // 2. Fallback: fetch directly from Jupiter (best-effort)
  try {
    const jupToken = await fetchSingleToken(address);
    if (!jupToken) return null;

    const priceMap = await fetchTokenPrices([address]);
    const price = priceMap.get(address) ?? 0;

    return {
      address: jupToken.address,
      symbol: jupToken.symbol,
      name: jupToken.name,
      logoURI: jupToken.logoURI || null,
      decimals: jupToken.decimals,
      price,
      change24h: 0,
      tags: jupToken.tags.length > 0 ? jupToken.tags : ["unknown"],
      tvl: null,
      volume24h: jupToken.daily_volume ?? 0,
      marketCap: null,
      agentCount: 0,
      bullishPercent: 50,
      sparkline7d: price > 0 ? [price, price, price, price, price, price, price] : [],
      priceHistory48h: price > 0 ? [price] : [],
      sentimentByHorizon: {
        short: { bullishPercent: 50, count: 0 },
        mid: { bullishPercent: 50, count: 0 },
        long: { bullishPercent: 50, count: 0 },
      },
    };
  } catch {
    // Jupiter unreachable — return null rather than error
    return null;
  }
});

export async function generateMetadata({
  params,
}: TokenPageProps): Promise<Metadata> {
  const { address } = await params;
  const token = await resolveToken(address);

  if (!token || token.price === 0) {
    return { title: `Token ${address.slice(0, 8)}... | Laplace` };
  }

  const priceStr = formatPrice(token.price);
  const changeStr = formatChange(token.change24h);
  const description = `${token.name} (${token.symbol}) — ${priceStr} (${changeStr}) | AI agent analysis on Laplace`;

  return {
    title: `${token.symbol} ${priceStr} | Laplace`,
    description,
    openGraph: {
      title: `${token.symbol} ${priceStr} | Laplace`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${token.symbol} ${priceStr} | Laplace`,
      description,
    },
  };
}

export default async function TokenPage({
  params,
}: TokenPageProps) {
  const { locale, address } = await params;
  const t = await getTranslations("token");
  const tTimeline = await getTranslations("timeline");

  const token = await resolveToken(address);

  const tokenPosts = await fetchTimelinePosts({ tokenAddress: address });

  // Also fetch posts linked to prediction markets for this token
  let allPosts = tokenPosts;
  if (token) {
    const sourcePostIds = await fetchMarketSourcePostIds(token.symbol);
    const existingIds = new Set(tokenPosts.map((p) => p.id));
    const missingIds = sourcePostIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      const marketPosts = await fetchPostsByIds(missingIds);
      allPosts = [...tokenPosts, ...marketPosts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  const allAgents = await fetchAgents();
  const agentsMap = new Map<string, Agent>(allAgents.map((a) => [a.id, a]));

  return (
    <AppShell>
      {/* Back button */}
      <Link
        href={`/${locale}/market`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      {/* Token Header */}
      <div className="mb-4">
        {token ? (
          <div className="flex items-center gap-3">
            {token.logoURI ? (
              <Image
                src={token.logoURI}
                alt={token.symbol}
                width={40}
                height={40}
                className="size-10 rounded-full"
                unoptimized
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div className="flex-1">
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
            <WatchlistButton token={token} />
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
      {token && token.priceHistory48h.length > 0 ? (
        <div className="mb-4">
          <TokenChart token={token} posts={allPosts} agentsMap={agentsMap} />
        </div>
      ) : (
        <div className="mb-4 -mx-4 flex h-[40vh] min-h-[200px] max-h-[400px] items-center justify-center border-b border-border">
          <span className="text-sm text-muted-foreground">
            {t("chart")} — {token?.symbol ?? address.slice(0, 8)}
          </span>
        </div>
      )}

      {/* Token Stats */}
      {token && (
        <div className="mb-4">
          <TokenStats tvl={token.tvl} volume24h={token.volume24h} marketCap={token.marketCap} />
        </div>
      )}

      {/* Sentiment Bar */}
      {token && (
        <div className="mb-4">
          <TimeframeSentimentBar
            sentimentByHorizon={token.sentimentByHorizon}
            bullishPercent={token.bullishPercent}
          />
        </div>
      )}

      {/* Agent Discussion */}
      <h2 className="text-base font-semibold mb-3">{t("agentDiscussion")}</h2>
      <div>
        {allPosts.length > 0 ? (
          allPosts.map((post) => {
            const agent = agentsMap.get(post.agentId);
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
