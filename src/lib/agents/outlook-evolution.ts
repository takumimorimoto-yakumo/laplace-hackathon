// ============================================================
// Outlook Evolution — Agents learn from their own performance
// ============================================================
//
// Each agent's outlook (ultra_bullish → bullish → bearish → ultra_bearish)
// evolves based on:
//   1. Directional accuracy — which calls (bullish vs bearish) are more accurate
//   2. Portfolio momentum  — recent PnL trend as a secondary signal
//
// Constraints:
//   - Minimum 5 resolved predictions before any evolution
//   - Only shifts one step at a time (no jumping ultra_bullish → ultra_bearish)
//   - Uses 30-day window with recency weighting

import type { InvestmentOutlook } from "@/lib/types";

// Ordered scale for one-step shifting
const OUTLOOK_SCALE: InvestmentOutlook[] = [
  "ultra_bearish",
  "bearish",
  "bullish",
  "ultra_bullish",
];

const MIN_PREDICTIONS = 5;
const RECENCY_HALF_LIFE_DAYS = 14;

export interface PredictionRecord {
  direction: string;
  directionScore: number; // 1 = correct, 0 = wrong
  resolvedAt: string;
}

export interface OutlookInput {
  currentOutlook: InvestmentOutlook;
  predictions: PredictionRecord[];
  portfolioReturn: number; // decimal, e.g. 0.05 = +5%
}

export interface OutlookResult {
  newOutlook: InvestmentOutlook;
  changed: boolean;
  reason: string;
  score: number;
  bullishAccuracy: number | null;
  bearishAccuracy: number | null;
}

function recencyWeight(resolvedAt: string): number {
  const daysAgo =
    (Date.now() - new Date(resolvedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(2, -daysAgo / RECENCY_HALF_LIFE_DAYS);
}

function weightedAccuracy(
  preds: PredictionRecord[]
): number | null {
  if (preds.length === 0) return null;
  let weightedCorrect = 0;
  let totalWeight = 0;
  for (const p of preds) {
    const w = recencyWeight(p.resolvedAt);
    totalWeight += w;
    weightedCorrect += p.directionScore * w;
  }
  return totalWeight > 0 ? weightedCorrect / totalWeight : null;
}

function shiftOneStep(
  current: InvestmentOutlook,
  target: InvestmentOutlook
): InvestmentOutlook {
  const currentIdx = OUTLOOK_SCALE.indexOf(current);
  const targetIdx = OUTLOOK_SCALE.indexOf(target);
  if (currentIdx === targetIdx) return current;
  if (targetIdx > currentIdx) return OUTLOOK_SCALE[currentIdx + 1];
  return OUTLOOK_SCALE[currentIdx - 1];
}

function scoreToOutlook(score: number): InvestmentOutlook {
  if (score > 0.3) return "ultra_bullish";
  if (score > 0.05) return "bullish";
  if (score < -0.3) return "ultra_bearish";
  if (score < -0.05) return "bearish";
  // Dead zone: no clear signal
  return "bullish"; // default neutral-ish
}

export function evolveOutlook(input: OutlookInput): OutlookResult {
  const { currentOutlook, predictions, portfolioReturn } = input;

  // Not enough data — keep current
  if (predictions.length < MIN_PREDICTIONS) {
    return {
      newOutlook: currentOutlook,
      changed: false,
      reason: `insufficient_data (${predictions.length}/${MIN_PREDICTIONS})`,
      score: 0,
      bullishAccuracy: null,
      bearishAccuracy: null,
    };
  }

  const bullishPreds = predictions.filter((p) => p.direction === "bullish");
  const bearishPreds = predictions.filter((p) => p.direction === "bearish");

  const bullishAcc = weightedAccuracy(bullishPreds);
  const bearishAcc = weightedAccuracy(bearishPreds);

  // Directional bias: positive = bullish calls are better
  let directionBias = 0;
  if (bullishAcc !== null && bearishAcc !== null) {
    directionBias = bullishAcc - bearishAcc;
  } else if (bullishAcc !== null) {
    // Only bullish predictions — if accurate, lean bullish; if not, shift bearish
    directionBias = (bullishAcc - 0.5) * 2; // map 0-1 to -1..+1
  } else if (bearishAcc !== null) {
    // Only bearish predictions — if accurate, lean bearish; if not, shift bullish
    directionBias = -((bearishAcc - 0.5) * 2);
  }

  // Portfolio momentum (secondary signal, clamped)
  const portfolioSignal = Math.max(-0.5, Math.min(0.5, portfolioReturn));

  // Combined score: direction accuracy 70%, portfolio 30%
  const score = directionBias * 0.7 + portfolioSignal * 0.3;

  const targetOutlook = scoreToOutlook(score);

  // Check dead zone — if score is near zero, don't change
  if (Math.abs(score) <= 0.05) {
    return {
      newOutlook: currentOutlook,
      changed: false,
      reason: "dead_zone",
      score,
      bullishAccuracy: bullishAcc,
      bearishAccuracy: bearishAcc,
    };
  }

  const newOutlook = shiftOneStep(currentOutlook, targetOutlook);
  const changed = newOutlook !== currentOutlook;

  return {
    newOutlook,
    changed,
    reason: changed
      ? `shifted ${currentOutlook} → ${newOutlook} (score: ${score.toFixed(3)})`
      : "target_matches_current",
    score,
    bullishAccuracy: bullishAcc,
    bearishAccuracy: bearishAcc,
  };
}
