// ============================================================
// Agent Stats — Real data with synthetic fallback
// ============================================================

import type {
  Agent,
  PortfolioSnapshot,
  AccuracySnapshot,
  AgentPredictionStats,
  AgentRentalPlan,
} from "./types";

/**
 * Generate synthetic 30-day portfolio history as fallback
 * when no real snapshots exist in the database.
 */
export function generatePortfolioHistory(agent: Agent): PortfolioSnapshot[] {
  const base = 10000;
  const current = agent.portfolioValue;
  const snapshots: PortfolioSnapshot[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const progress = (29 - i) / 29;
    const noise = Math.sin(i * 2.1) * 300 + Math.cos(i * 0.7) * 200;
    const value = base + (current - base) * progress + noise;
    snapshots.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(Math.max(base * 0.8, value)),
    });
  }
  snapshots[snapshots.length - 1].value = current;
  return snapshots;
}

/**
 * Generate synthetic 30-day accuracy history as fallback
 * when no real snapshots exist in the database.
 */
export function generateAccuracyHistory(agent: Agent): AccuracySnapshot[] {
  const snapshots: AccuracySnapshot[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const noise = Math.sin(i * 1.3) * 0.06 + Math.cos(i * 2.4) * 0.04;
    const accuracy = Math.max(0.4, Math.min(0.95, agent.accuracy + noise));
    snapshots.push({
      date: date.toISOString().slice(0, 10),
      accuracy: Number(accuracy.toFixed(2)),
    });
  }
  snapshots[snapshots.length - 1].accuracy = agent.accuracy;
  return snapshots;
}

/**
 * Get portfolio history: use real DB snapshots if available (>=2 points),
 * otherwise fall back to synthetic data.
 */
export function getPortfolioHistory(
  agent: Agent,
  dbSnapshots: PortfolioSnapshot[]
): PortfolioSnapshot[] {
  if (dbSnapshots.length >= 2) {
    return dbSnapshots;
  }
  return generatePortfolioHistory(agent);
}

/**
 * Get accuracy history: use real DB snapshots if available (>=2 points),
 * otherwise fall back to synthetic data.
 */
export function getAccuracyHistory(
  agent: Agent,
  dbSnapshots: AccuracySnapshot[]
): AccuracySnapshot[] {
  if (dbSnapshots.length >= 2) {
    return dbSnapshots;
  }
  return generateAccuracyHistory(agent);
}

/** Compute prediction statistics from agent data. */
export function computePredictionStats(agent: Agent): AgentPredictionStats {
  const total = Math.round(agent.totalVotes / 20);
  const correct = Math.round(total * agent.accuracy);
  return {
    totalPredictions: total,
    correctPredictions: correct,
    calibrationScore: Number((agent.accuracy * 0.95 + 0.02).toFixed(2)),
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
