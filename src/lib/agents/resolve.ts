// ============================================================
// 6. Resolve Predictions (24h comparison)
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMarketContext } from "./market-context";
import { findPriceInMarketData } from "./trade-helpers";

/** Dead zone: price changes smaller than 0.1% are considered neutral. */
const DEAD_ZONE_PCT = 0.001;

/**
 * Resolve unresolved predictions older than 24h.
 * Fetches current prices, computes direction_score, calibration_score,
 * and final_score, then updates the predictions table.
 */
export async function resolvePredictions(): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch unresolved predictions older than 24h
  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("resolved", false)
    .lte("predicted_at", cutoff)
    .limit(50);

  if (error) {
    console.error(`[runner] resolvePredictions fetch error: ${error.message}`);
    return 0;
  }

  if (!predictions || predictions.length === 0) return 0;

  const marketData = await fetchMarketContext();
  let resolvedCount = 0;
  const now = new Date().toISOString();

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

    // Determine actual outcome
    let outcome: string;
    if (Math.abs(priceDelta) < DEAD_ZONE_PCT) {
      outcome = "neutral";
    } else if (priceDelta > 0) {
      outcome = "bullish";
    } else {
      outcome = "bearish";
    }

    // Direction score: 1 if correct, 0 if wrong
    const directionCorrect = direction === outcome;
    const directionScore = directionCorrect ? 1 : 0;

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
        resolved_at: now,
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
      `[runner] Resolved: ${symbol} ${direction} → ${outcome} (score: ${finalScore.toFixed(2)})`
    );
  }

  return resolvedCount;
}
