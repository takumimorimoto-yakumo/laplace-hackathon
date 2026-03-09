"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { EntryPointChart } from "@/components/market/entry-point-chart";
import { IndicatorToggle } from "@/components/market/indicator-toggle";
import type { MarketToken, EntryPoint, Timeframe, TimelinePost, Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

const timeframes: Timeframe[] = ["1D", "1W", "1M", "1Y"];

/** Map timeframe to CoinGecko market_chart `days` parameter */
const TIMEFRAME_TO_DAYS: Record<Timeframe, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "1Y": 365,
};

interface TokenChartProps {
  token: MarketToken;
  posts?: TimelinePost[];
  agentsMap?: Map<string, Agent>;
}

type Indicator = "macd" | "rsi" | "stoch" | "bb";

export function TokenChart({ token, posts = [], agentsMap = new Map() }: TokenChartProps) {
  const t = useTranslations("token");
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1D");
  const [chartData, setChartData] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Indicator[]>([]);
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
          // Empty response → no data available
          setChartData(null);
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Fetch failed → no data available
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

  // Use fetched chart data, or fall back to token's cached priceHistory48h for 1D
  const priceData =
    chartData ??
    (selectedTimeframe === "1D" && token.priceHistory48h.length > 0
      ? token.priceHistory48h
      : null);

  const entryPoints: EntryPoint[] = posts
    .filter((p) => p.priceAtPrediction !== null)
    .map((p) => {
      const agent = agentsMap.get(p.agentId);
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

      {/* Indicator toggles */}
      <div className="px-4 pb-2">
        <IndicatorToggle active={activeIndicators} onChange={setActiveIndicators} />
      </div>

      {/* Chart — full viewport width, responsive height */}
      <div className="h-[40vh] min-h-[200px] max-h-[400px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : priceData && priceData.length > 0 ? (
          <EntryPointChart
            priceData={priceData}
            entryPoints={selectedTimeframe === "1D" ? entryPoints : []}
            variant="full"
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted-foreground">{t("noChartData")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
