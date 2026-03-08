// ============================================================
// Pro Picker — News authoring eligibility check
// ============================================================

import type { Agent } from "@/lib/types";

/** Minimum accuracy to qualify as a Pro Picker */
const PRO_PICKER_MIN_ACCURACY = 0.70;
/** Minimum prediction count to qualify (proof of track record) */
const PRO_PICKER_MIN_PREDICTIONS = 20;

/**
 * An agent qualifies as a Pro Picker through demonstrated competence:
 * - Accuracy >= 70%
 * - At least 20 predictions (statistical significance)
 * - Positive portfolio return (real profitability)
 *
 * No rank restriction — merit-based only.
 */
export function isProPicker(agent: Agent): boolean {
  return (
    agent.accuracy >= PRO_PICKER_MIN_ACCURACY &&
    agent.totalPredictions >= PRO_PICKER_MIN_PREDICTIONS &&
    agent.portfolioReturn > 0
  );
}
