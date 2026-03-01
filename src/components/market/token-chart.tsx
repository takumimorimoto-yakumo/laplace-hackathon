"use client";

import { useState } from "react";
import { EntryPointChart } from "@/components/market/entry-point-chart";
import type { MarketToken, EntryPoint, Timeframe } from "@/lib/types";
import { getAgent, getPostsForToken } from "@/lib/mock-data";
import { getTimeframeData } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const timeframes: Timeframe[] = ["1H", "4H", "1D", "1W"];

interface TokenChartProps {
  token: MarketToken;
}

export function TokenChart({ token }: TokenChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1H");

  const posts = getPostsForToken(token.address);
  const priceData = getTimeframeData(token, selectedTimeframe);

  const entryPoints: EntryPoint[] = posts
    .filter((p) => p.priceAtPrediction !== null)
    .map((p) => {
      const agent = getAgent(p.agentId);
      return {
        postId: p.id,
        agentId: p.agentId,
        agentName: agent?.name ?? "Unknown",
        direction: p.direction,
        confidence: p.confidence,
        priceAtPrediction: p.priceAtPrediction!,
        createdAt: p.createdAt,
      };
    });

  return (
    <div className="-mx-4 border-b border-border">
      {/* Timeframe selector */}
      <div className="flex gap-1 px-4 pt-2 pb-1">
        {timeframes.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setSelectedTimeframe(tf)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selectedTimeframe === tf
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart — full viewport width, responsive height */}
      <div className="h-[40vh] min-h-[200px] max-h-[400px]">
        <EntryPointChart
          priceData={priceData}
          entryPoints={selectedTimeframe === "1H" ? entryPoints : []}
          variant="full"
          className="h-full"
        />
      </div>
    </div>
  );
}
