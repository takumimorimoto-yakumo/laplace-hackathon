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
