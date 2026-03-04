import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { predictionMarkets } from "@/lib/mock-data";
import { fetchMarketData, getCoingeckoId } from "@/lib/data/coingecko";
import { seedTokens } from "@/lib/tokens";
import type { PredictionMarket } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PredictionRow {
  id: string;
  agent_id: string;
  direction: string;
  confidence: number;
  price_at_prediction: number;
  token_symbol: string;
}

interface ResolutionResult {
  marketId: string;
  tokenSymbol: string;
  outcome: "yes" | "no";
  currentPrice: number;
  threshold: number;
  conditionType: string;
  predictionsResolved: number;
}

/**
 * GET /api/cron/resolve-markets
 *
 * Resolve expired prediction markets and associated DB predictions.
 * Updates agent accuracy scores after resolution.
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  // --- Verify cron secret ---
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const supabase = createAdminClient();

  // --- Find unresolved markets past their deadline ---
  const expiredMarkets = predictionMarkets.filter(
    (m) => !m.isResolved && new Date(m.deadline) < now
  );

  if (expiredMarkets.length === 0) {
    return NextResponse.json({
      message: "No markets to resolve",
      resolved: 0,
    });
  }

  // --- Fetch current prices ---
  const priceMap = await buildPriceMap(expiredMarkets);

  const results: ResolutionResult[] = [];
  const agentIdsToRecalculate = new Set<string>();

  for (const market of expiredMarkets) {
    const currentPrice = priceMap.get(market.tokenSymbol);
    if (currentPrice === undefined) {
      console.warn(
        `No price found for ${market.tokenSymbol}, skipping market ${market.marketId}`
      );
      continue;
    }

    // --- Evaluate market condition ---
    const outcome = evaluateCondition(market, currentPrice);

    // Mark in-memory market as resolved (ephemeral for this request)
    market.isResolved = true;
    market.outcome = outcome;

    console.log(
      `Market ${market.marketId} (${market.tokenSymbol} ${market.conditionType} ${market.threshold}): ` +
        `price=${currentPrice}, outcome=${outcome}`
    );

    // --- Resolve associated predictions in the DB ---
    const predictionsResolved = await resolveAssociatedPredictions(
      supabase,
      market,
      currentPrice,
      agentIdsToRecalculate
    );

    results.push({
      marketId: market.marketId,
      tokenSymbol: market.tokenSymbol,
      outcome,
      currentPrice,
      threshold: market.threshold,
      conditionType: market.conditionType,
      predictionsResolved,
    });
  }

  // --- Recalculate accuracy scores for affected agents ---
  let accuracyUpdated = 0;
  for (const agentId of agentIdsToRecalculate) {
    const updated = await recalculateAgentAccuracy(supabase, agentId);
    if (updated) accuracyUpdated++;
  }

  return NextResponse.json({
    message: `Resolved ${results.length} markets`,
    resolved: results.length,
    accuracyUpdated,
    results,
  });
}

/**
 * Build a token symbol to current price map using CoinGecko data with seedTokens fallback.
 */
async function buildPriceMap(
  markets: PredictionMarket[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  const symbols = [...new Set(markets.map((m) => m.tokenSymbol))];

  // Try CoinGecko first
  const coingeckoIds = symbols
    .map((s) => ({ symbol: s, id: getCoingeckoId(s) }))
    .filter(
      (entry): entry is { symbol: string; id: string } =>
        entry.id !== undefined
    );

  if (coingeckoIds.length > 0) {
    const marketData = await fetchMarketData(
      coingeckoIds.map((e) => e.id)
    );

    if (marketData) {
      for (const entry of coingeckoIds) {
        const data = marketData.find((d) => d.id === entry.id);
        if (data) {
          priceMap.set(entry.symbol, data.currentPrice);
        }
      }
    }
  }

  // Fallback to seedTokens for any symbols not found
  for (const symbol of symbols) {
    if (!priceMap.has(symbol)) {
      const seed = seedTokens.find((t) => t.symbol === symbol);
      if (seed) {
        priceMap.set(symbol, seed.price);
      }
    }
  }

  return priceMap;
}

/**
 * Evaluate a prediction market condition against the current price.
 */
function evaluateCondition(
  market: PredictionMarket,
  currentPrice: number
): "yes" | "no" {
  switch (market.conditionType) {
    case "price_above":
      return currentPrice > market.threshold ? "yes" : "no";

    case "price_below":
      return currentPrice < market.threshold ? "yes" : "no";

    case "change_percent": {
      const changePercent =
        ((currentPrice - market.priceAtCreation) / market.priceAtCreation) *
        100;
      return changePercent > market.threshold ? "yes" : "no";
    }

    default:
      return "no";
  }
}

/**
 * Resolve DB predictions for the same token that are unresolved.
 * Computes direction_score, calibration_score, and final_score.
 */
async function resolveAssociatedPredictions(
  supabase: ReturnType<typeof createAdminClient>,
  market: PredictionMarket,
  currentPrice: number,
  agentIdsToRecalculate: Set<string>
): Promise<number> {
  // Find unresolved predictions for this token
  const { data: predictions, error: fetchError } = await supabase
    .from("predictions")
    .select("id, agent_id, direction, confidence, price_at_prediction, token_symbol")
    .eq("token_symbol", market.tokenSymbol)
    .eq("resolved", false);

  if (fetchError || !predictions || predictions.length === 0) {
    return 0;
  }

  const rows = predictions as PredictionRow[];
  let resolvedCount = 0;

  for (const prediction of rows) {
    const priceAtPrediction = Number(prediction.price_at_prediction);
    if (!priceAtPrediction || priceAtPrediction <= 0) continue;

    const actualChangePercent =
      ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;
    const priceWentUp = currentPrice > priceAtPrediction;

    // Direction score: 1.0 if prediction direction matches actual movement, 0.0 otherwise
    const directionCorrect =
      (prediction.direction === "bullish" && priceWentUp) ||
      (prediction.direction === "bearish" && !priceWentUp);
    const directionScore = directionCorrect ? 1.0 : 0.0;

    // Calibration score: how well the confidence matches the actual outcome magnitude
    // Lower is better: |confidence - normalized_actual_change|
    const confidence = Number(prediction.confidence);
    const normalizedActual = Math.min(Math.abs(actualChangePercent) / 100, 1);
    const calibrationScore = Math.abs(confidence - normalizedActual);

    // Final score: weighted combination (direction matters most)
    const finalScore = directionScore * 70 + (1 - calibrationScore) * 30;

    const outcome = directionCorrect ? "correct" : "incorrect";

    const { error: updateError } = await supabase
      .from("predictions")
      .update({
        resolved: true,
        outcome,
        price_at_resolution: currentPrice,
        resolved_at: new Date().toISOString(),
        direction_score: Math.round(directionScore * 100) / 100,
        calibration_score: Math.round(calibrationScore * 10000) / 10000,
        final_score: Math.round(finalScore * 100) / 100,
      })
      .eq("id", prediction.id);

    if (updateError) {
      console.error(
        `Failed to resolve prediction ${prediction.id}:`,
        updateError.message
      );
    } else {
      resolvedCount++;
      agentIdsToRecalculate.add(prediction.agent_id);
    }
  }

  return resolvedCount;
}

/**
 * Recalculate an agent's accuracy_score based on all resolved predictions.
 * accuracy_score = correct_predictions / total_resolved_predictions
 */
async function recalculateAgentAccuracy(
  supabase: ReturnType<typeof createAdminClient>,
  agentId: string
): Promise<boolean> {
  const { data: resolved, error: fetchError } = await supabase
    .from("predictions")
    .select("outcome")
    .eq("agent_id", agentId)
    .eq("resolved", true);

  if (fetchError || !resolved || resolved.length === 0) {
    return false;
  }

  const total = resolved.length;
  const correct = resolved.filter(
    (p) => (p as { outcome: string }).outcome === "correct"
  ).length;
  const accuracyScore = correct / total;

  const { error: updateError } = await supabase
    .from("agents")
    .update({
      accuracy_score: Math.round(accuracyScore * 100) / 100,
    })
    .eq("id", agentId);

  if (updateError) {
    console.error(
      `Failed to update accuracy for agent ${agentId}:`,
      updateError.message
    );
    return false;
  }

  return true;
}
