// ============================================================
// 6. Resolve Predictions (24h comparison)
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMarketContext } from "./market-context";
import { findPriceInMarketData } from "./trade-helpers";
import { resolutionCutoffMs } from "./time-horizon";

/** Dead zone: price changes smaller than 0.1% are considered neutral. */
const DEAD_ZONE_PCT = 0.001;

/**
 * Resolve unresolved predictions older than 24h.
 * Fetches current prices, computes direction_score, calibration_score,
 * and final_score, then updates the predictions table.
 */
export async function resolvePredictions(): Promise<number> {
  const supabase = createAdminClient();

  // Fetch all unresolved predictions (filter by time_horizon individually)
  const { data: allPredictions, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("resolved", false)
    .limit(100);

  if (error) {
    console.error(`[runner] resolvePredictions fetch error: ${error.message}`);
    return 0;
  }

  if (!allPredictions || allPredictions.length === 0) return 0;

  // Filter predictions that have passed their time_horizon cutoff
  const now = Date.now();
  const predictions = allPredictions.filter((pred) => {
    const predictedAt = new Date(pred.predicted_at as string).getTime();
    const cutoff = resolutionCutoffMs((pred.time_horizon as string) ?? "swing");
    return now - predictedAt >= cutoff;
  });

  if (predictions.length === 0) return 0;

  const marketData = await fetchMarketContext();
  let resolvedCount = 0;
  const nowIso = new Date().toISOString();

  for (const pred of predictions) {
    const symbol = pred.token_symbol as string;
    const currentPrice = findPriceInMarketData(symbol, marketData);

    if (!currentPrice) {
      console.warn(`[runner] Cannot resolve prediction for ${symbol}: no price data`);
      continue;
    }

    const entryPrice = Number(pred.price_at_prediction);
    const priceDelta = (currentPrice - entryPrice) / entryPrice;
    const direction = pred.direction as string;
    const confidence = Number(pred.confidence);

    // Determine actual market direction
    let actualDirection: string;
    if (Math.abs(priceDelta) < DEAD_ZONE_PCT) {
      actualDirection = "neutral";
    } else if (priceDelta > 0) {
      actualDirection = "bullish";
    } else {
      actualDirection = "bearish";
    }

    // Direction score: 1 if correct, 0 if wrong
    const directionCorrect = direction === actualDirection;
    const directionScore = directionCorrect ? 1 : 0;

    // Outcome stored as "correct"/"incorrect" to match consumers
    const outcome = directionCorrect ? "correct" : "incorrect";

    // Calibration score: 1 - |confidence - outcome_binary|
    const outcomeBinary = directionCorrect ? 1 : 0;
    const calibrationScore = 1 - Math.abs(confidence - outcomeBinary);

    // Final score: 70% direction + 30% calibration
    const finalScore = directionScore * 0.7 + calibrationScore * 0.3;

    const { error: updateError } = await supabase
      .from("predictions")
      .update({
        resolved: true,
        outcome,
        price_at_resolution: currentPrice,
        resolved_at: nowIso,
        direction_score: directionScore,
        calibration_score: calibrationScore,
        final_score: finalScore,
      })
      .eq("id", pred.id);

    if (updateError) {
      console.error(`[runner] Failed to resolve prediction ${pred.id}: ${updateError.message}`);
      continue;
    }

    resolvedCount++;
    console.log(
      `[runner] Resolved: ${symbol} ${direction} → ${outcome} (score: ${finalScore.toFixed(2)}, horizon: ${pred.time_horizon})`
    );
  }

  return resolvedCount;
}
