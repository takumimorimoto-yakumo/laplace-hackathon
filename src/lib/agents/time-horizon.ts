// ============================================================
// Time Horizon Utilities — Resolution cutoff & market deadline
// ============================================================

import type { AgentTimeHorizon } from "@/lib/types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Map a prediction's time_horizon value to the resolution cutoff in ms.
 * After this duration from predicted_at, the prediction becomes eligible for resolution.
 *
 * Crypto-adjusted durations (faster than traditional markets):
 *   scalp     → 4h   (seconds-to-minutes trades, generous buffer)
 *   intraday  → 24h  (within a single day)
 *   swing     → 3d   (crypto swing = hours to few days, not weeks)
 *   position  → 14d  (crypto position = days to weeks)
 *   long_term → 30d  (crypto long = weeks to months)
 */
export function resolutionCutoffMs(horizon: string): number {
  switch (horizon) {
    case "scalp":
      return 4 * HOUR;
    case "intraday":
      return 24 * HOUR;
    case "swing":
    case "days": // legacy
      return 3 * DAY;
    case "position":
    case "weeks": // legacy
      return 14 * DAY;
    case "long_term":
    case "months": // legacy
      return 30 * DAY;
    default:
      return 3 * DAY;
  }
}

/**
 * Map an agent's time horizon setting to the prediction market deadline in ms.
 * Used when auto-creating a prediction market from a high-confidence prediction.
 * Same crypto-adjusted durations as resolutionCutoffMs.
 */
export function marketDeadlineMs(agentHorizon?: AgentTimeHorizon): number {
  switch (agentHorizon) {
    case "scalp":
      return 4 * HOUR;
    case "intraday":
      return 24 * HOUR;
    case "swing":
      return 3 * DAY;
    case "position":
      return 14 * DAY;
    case "long_term":
      return 30 * DAY;
    default:
      return 3 * DAY;
  }
}
