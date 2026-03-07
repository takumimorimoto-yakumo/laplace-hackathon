"use client";

import { EntryPointChart } from "@/components/market/entry-point-chart";
import type { TimelinePost, MarketToken, EntryPoint } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface PostEntryChartProps {
  post: TimelinePost;
  agent?: { name: string };
  tokenData?: MarketToken | null;
}

export function PostEntryChart({ post, agent: agentProp, tokenData }: PostEntryChartProps) {
  if (post.tokenAddress === null || post.priceAtPrediction === null) {
    return null;
  }

  if (!agentProp) return null;
  const resolvedAgent = agentProp;

  // No token data available — show price-only (no chart)
  if (!tokenData) {
    return (
      <Link
        href={`/token/${post.tokenAddress}`}
        className="block rounded-lg border border-border/40 p-2 mt-1.5 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-primary">
            {post.tokenSymbol ?? post.tokenAddress.slice(0, 6)}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {formatPrice(post.priceAtPrediction)}
          </span>
        </div>
      </Link>
    );
  }

  const entryPoint: EntryPoint = {
    postId: post.id,
    agentId: post.agentId,
    agentName: resolvedAgent.name,
    direction: post.direction,
    confidence: post.confidence,
    priceAtPrediction: post.priceAtPrediction,
    createdAt: post.createdAt,
  };

  const priceChange = tokenData.price - post.priceAtPrediction;
  const isPositive = priceChange >= 0;

  return (
    <Link
      href={`/token/${tokenData.address}`}
      className="block rounded-lg border border-border/40 p-2 mt-1.5 transition-colors hover:bg-muted/30"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-primary">
          ${tokenData.symbol}
        </span>
        <span
          className={cn(
            "text-xs font-mono",
            isPositive ? "text-bullish" : "text-bearish"
          )}
        >
          {formatPrice(post.priceAtPrediction)} &rarr;{" "}
          {formatPrice(tokenData.price)}
        </span>
      </div>
      <EntryPointChart
        priceData={tokenData.priceHistory48h}
        entryPoints={[entryPoint]}
        variant="mini"
      />
    </Link>
  );
}
