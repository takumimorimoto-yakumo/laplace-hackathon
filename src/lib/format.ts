// ============================================================
// Formatting Utilities — Laplace MVP
// ============================================================

export function formatPrice(price: number): string {
  if (price < 0.001) return `$${price.toFixed(7)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ---------- Prediction Market Formatters ----------

export function formatPool(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPredictionPrice(price: number): string {
  if (price >= 1_000_000_000) return `$${(price / 1_000_000_000).toFixed(2)}B`;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000)
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

export function formatConditionShort(
  tokenSymbol: string,
  conditionType: string,
  threshold: number,
  durationLabel: string
): string {
  switch (conditionType) {
    case "price_above":
      if (threshold >= 1_000_000) {
        const formatted =
          threshold >= 1_000_000_000
            ? `$${(threshold / 1_000_000_000).toFixed(0)}B`
            : `$${(threshold / 1_000_000).toFixed(0)}M`;
        return `${tokenSymbol} TVL > ${formatted} (${durationLabel})`;
      }
      return `${tokenSymbol} > $${threshold} (${durationLabel})`;
    case "price_below":
      return `${tokenSymbol} < $${threshold} (${durationLabel})`;
    case "change_percent":
      return `${tokenSymbol} ${threshold}% (${durationLabel})`;
    default:
      return `${tokenSymbol} (${durationLabel})`;
  }
}

export function getTimeRemainingParts(deadline: string): {
  ended: boolean;
  days: number;
  hours: number;
  minutes: number;
} {
  const end = new Date(deadline);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return { ended: true, days: 0, hours: 0, minutes: 0 };

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  const remainingMinutes = diffMinutes % 60;

  return {
    ended: false,
    days: diffDays,
    hours: remainingHours,
    minutes: remainingMinutes,
  };
}
