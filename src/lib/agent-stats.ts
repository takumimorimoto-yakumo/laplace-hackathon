// ============================================================
// Agent Stats — Real data only (no synthetic fallback)
// ============================================================

import type {
  Agent,
  AgentPredictionStats,
  AgentRentalPlan,
} from "./types";
import type { ResolvedPrediction } from "./supabase/queries";

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
  return {
    totalPredictions: total,
    correctPredictions: correct,
    calibrationScore: Number(avgCalibration.toFixed(2)),
    totalVotesEarned: agent.totalVotes,
  };
}

/** Compute rental plan based on agent rank. */
export function computeRentalPlan(agent: Agent): AgentRentalPlan {
  return {
    agentId: agent.id,
    monthlyPriceUsdc: agent.rank <= 3 ? 49.99 : agent.rank <= 6 ? 29.99 : 19.99,
    skrDiscountPercent: 10,
    benefits: [
      "rental.benefit.analysis",
      "rental.benefit.portfolio",
      "rental.benefit.priority",
      "rental.benefit.thinking",
    ],
  };
}
