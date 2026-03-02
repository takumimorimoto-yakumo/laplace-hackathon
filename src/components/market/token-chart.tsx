"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EntryPointChart } from "@/components/market/entry-point-chart";
import type { MarketToken, EntryPoint, Timeframe } from "@/lib/types";
import { getAgent, getPostsForToken } from "@/lib/mock-data";
import { getTimeframeData } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const timeframes: Timeframe[] = ["1H", "4H", "1D", "1W"];

/** Map timeframe to CoinGecko market_chart `days` parameter */
const TIMEFRAME_TO_DAYS: Record<Timeframe, number> = {
  "1H": 1,
  "4H": 7,
  "1D": 30,
  "1W": 365,
};

interface TokenChartProps {
  token: MarketToken;
}

export function TokenChart({ token }: TokenChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1H");
  const [chartData, setChartData] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchChartData = useCallback(
    async (timeframe: Timeframe) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);

      try {
        const days = TIMEFRAME_TO_DAYS[timeframe];
        const res = await fetch(
          `/api/chart-data?address=${token.address}&days=${days}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as {
          prices: [number, number][];
        };

        if (json.prices.length > 0) {
          // Extract price values from [timestamp, price] pairs
          setChartData(json.prices.map(([, price]) => price));
        } else {
          // Empty response → use synthetic fallback
          setChartData(null);
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Fetch failed → use synthetic fallback
        setChartData(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [token.address]
  );

  useEffect(() => {
    fetchChartData(selectedTimeframe);
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedTimeframe, fetchChartData]);

  const posts = getPostsForToken(token.address);
  const priceData = chartData ?? getTimeframeData(token, selectedTimeframe);

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
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <EntryPointChart
            priceData={priceData}
            entryPoints={selectedTimeframe === "1H" ? entryPoints : []}
            variant="full"
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
