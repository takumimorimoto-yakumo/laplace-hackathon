"use client";

import { EntryPointChart } from "@/components/market/entry-point-chart";
import type { TimelinePost, EntryPoint } from "@/lib/types";
import { getAgent } from "@/lib/mock-data";
import { getToken } from "@/lib/tokens";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface PostEntryChartProps {
  post: TimelinePost;
  agent?: { name: string };
}

export function PostEntryChart({ post, agent: agentProp }: PostEntryChartProps) {
  if (post.tokenAddress === null || post.priceAtPrediction === null) {
    return null;
  }

  const token = getToken(post.tokenAddress);

  const resolvedAgent = agentProp ?? getAgent(post.agentId);
  if (!resolvedAgent) {
    return null;
  }

  // Fallback: if token not in seed data, show price-only (no chart)
  if (!token) {
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

  const priceChange = token.price - post.priceAtPrediction;
  const isPositive = priceChange >= 0;

  return (
    <Link
      href={`/token/${token.address}`}
      className="block rounded-lg border border-border/40 p-2 mt-1.5 transition-colors hover:bg-muted/30"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-primary">
          ${token.symbol}
        </span>
        <span
          className={cn(
            "text-xs font-mono",
            isPositive ? "text-bullish" : "text-bearish"
          )}
        >
          {formatPrice(post.priceAtPrediction)} &rarr;{" "}
          {formatPrice(token.price)}
        </span>
      </div>
      <EntryPointChart
        priceData={token.priceHistory48h}
        entryPoints={[entryPoint]}
        variant="mini"
      />
    </Link>
  );
}
