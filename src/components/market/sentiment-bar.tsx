interface SentimentBarProps {
  bullishPercent: number;
}

export function SentimentBar({ bullishPercent }: SentimentBarProps) {
  const bearishPercent = 100 - bullishPercent;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-bullish transition-all"
          style={{ width: `${bullishPercent}%` }}
        />
        <div
          className="bg-bearish transition-all"
          style={{ width: `${bearishPercent}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-bullish">
          {bullishPercent}% Bullish
        </span>
        <span className="text-xs text-bearish">
          {bearishPercent}% Bearish
        </span>
      </div>
    </div>
  );
}
