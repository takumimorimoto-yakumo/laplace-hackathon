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

/**
 * Format an ISO timestamp as a relative time string (e.g., "5m", "2h", "3d").
 * Used for displaying time elapsed since trades, position entries, etc.
 */
export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------- Performance Tab Formatters ----------

/** Compute percent change between two prices. Returns { text, isPositive }. */
export function formatPriceChange(
  from: number,
  to: number
): { text: string; isPositive: boolean } {
  if (from === 0) return { text: "N/A", isPositive: false };
  const pct = ((to - from) / from) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    isPositive: pct >= 0,
  };
}

/** Format ISO timestamp as a concrete date with time. */
export function formatAbsoluteDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  if (locale === "ja") {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    if (sameYear) return `${month}月${day}日 ${h}:${m}`;
    return `${date.getFullYear()}年${month}月${day}日 ${h}:${m}`;
  }

  if (locale === "zh") {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    if (sameYear) return `${month}月${day}日 ${h}:${m}`;
    return `${date.getFullYear()}年${month}月${day}日 ${h}:${m}`;
  }

  // en (default)
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  if (sameYear) return `${month} ${day}, ${h}:${m}`;
  return `${month} ${day}, ${date.getFullYear()}, ${h}:${m}`;
}

/** Map a numeric score (0–1) to a human-readable label key. */
export function getScoreLabel(score: number): "excellent" | "good" | "average" | "poor" {
  if (score >= 0.8) return "excellent";
  if (score >= 0.6) return "good";
  if (score >= 0.4) return "average";
  return "poor";
}
