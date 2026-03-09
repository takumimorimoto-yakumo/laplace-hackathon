// ============================================================
// Agent Stats — Real data only (no synthetic fallback)
// ============================================================

import type {
  Agent,
  AgentPredictionStats,
  AgentRentalPlan,
  StreakInfo,
} from "./types";
import type { ResolvedPrediction } from "./supabase/queries";

/** Compute current win/loss streak from predictions sorted by resolvedAt descending. */
function computeStreak(predictions: ResolvedPrediction[]): StreakInfo {
  if (predictions.length === 0) return { type: "none", count: 0 };

  // Sort by resolvedAt descending (most recent first)
  const sorted = [...predictions].sort(
    (a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime()
  );

  const firstOutcome = sorted[0].outcome === "correct" ? "win" : "loss";
  let count = 0;
  for (const p of sorted) {
    const isWin = p.outcome === "correct";
    if ((firstOutcome === "win" && isWin) || (firstOutcome === "loss" && !isWin)) {
      count++;
    } else {
      break;
    }
  }
  return { type: firstOutcome, count };
}

/** Compute prediction statistics from real resolved predictions. */
export function computePredictionStats(
  resolvedPredictions: ResolvedPrediction[],
  agent: Agent
): AgentPredictionStats {
  const total = resolvedPredictions.length;
  const correct = resolvedPredictions.filter((p) => p.outcome === "correct").length;
  const avgCalibration =
    total > 0
      ? resolvedPredictions.reduce((sum, p) => sum + p.calibrationScore, 0) / total
      : 0;
  const avgScore =
    total > 0
      ? resolvedPredictions.reduce((sum, p) => sum + p.finalScore, 0) / total
      : 0;

  return {
    totalPredictions: total,
    correctPredictions: correct,
    calibrationScore: Number(avgCalibration.toFixed(2)),
    totalVotesEarned: agent.totalVotes,
    winRate: total > 0 ? correct / total : 0,
    avgScore: Number(avgScore.toFixed(2)),
    streakInfo: computeStreak(resolvedPredictions),
  };
}

/** Compute rental plan based on agent's AI-determined price. */
export function computeRentalPlan(agent: Agent): AgentRentalPlan {
  return {
    agentId: agent.id,
    monthlyPriceUsdc: agent.rentalPriceUsdc,
    skrDiscountPercent: 10,
    benefits: [
      "rental.benefit.chat",
      "rental.benefit.earlySignals",
      "rental.benefit.customAnalysis",
      "rental.benefit.analysis",
      "rental.benefit.portfolio",
      "rental.benefit.priority",
      "rental.benefit.thinking",
    ],
  };
}
