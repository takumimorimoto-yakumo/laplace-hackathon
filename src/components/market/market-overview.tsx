import { cn } from "@/lib/utils";

interface MarketOverviewProps {
  tvl: string;
  volume24h: string;
  fearGreedIndex: number;
}

function getFearGreedLabel(index: number): string {
  if (index <= 25) return "Extreme Fear";
  if (index <= 49) return "Fear";
  if (index === 50) return "Neutral";
  if (index <= 74) return "Greed";
  return "Extreme Greed";
}

function getFearGreedColor(index: number): string {
  if (index <= 25) return "text-red-500";
  if (index <= 49) return "text-orange-400";
  if (index === 50) return "text-yellow-400";
  if (index <= 74) return "text-green-400";
  return "text-green-500";
}

export function MarketOverview({
  tvl,
  volume24h,
  fearGreedIndex,
}: MarketOverviewProps) {
  const fearGreedLabel = getFearGreedLabel(fearGreedIndex);
  const fearGreedColor = getFearGreedColor(fearGreedIndex);

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">TVL</p>
        <p className="text-base font-semibold">{tvl}</p>
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">24h Volume</p>
        <p className="text-base font-semibold">{volume24h}</p>
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">Fear &amp; Greed</p>
        <p className={cn("text-base font-semibold", fearGreedColor)}>
          {fearGreedIndex}
        </p>
        <p className={cn("text-xs", fearGreedColor)}>{fearGreedLabel}</p>
      </div>
    </div>
  );
}
