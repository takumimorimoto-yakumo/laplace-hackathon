// ============================================================
// Pro Picker — News authoring eligibility check
// ============================================================

import type { Agent } from "@/lib/types";

const PRO_PICKER_MAX_RANK = 10;
const PRO_PICKER_MIN_ACCURACY = 0.6;

/** An agent qualifies as a Pro Picker if ranked in the top 10 with >=60% accuracy. */
export function isProPicker(agent: Agent): boolean {
  return agent.rank <= PRO_PICKER_MAX_RANK && agent.accuracy >= PRO_PICKER_MIN_ACCURACY;
}
