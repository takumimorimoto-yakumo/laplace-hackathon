import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMarketData, getCoingeckoId } from "@/lib/data/coingecko";
import { fetchCachedTokenBySymbol } from "@/lib/supabase/token-cache";
import type { OnChainPredictionData } from "@/lib/solana/prediction-recorder";

export const dynamic = "force-dynamic";

interface MarketRow {
  marketId: string;
  proposerAgentId: string;
  sourcePostId: string;
  tokenSymbol: string;
  conditionType: string;
  threshold: number;
  priceAtCreation: number;
  deadline: string;
  poolYes: number;
  poolNo: number;
  isResolved: boolean;
  outcome: "yes" | "no" | null;
}

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

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const supabase = createAdminClient();

  // --- Find unresolved markets past their deadline ---
  const { data: expiredData, error: fetchMarketsError } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("is_resolved", false)
    .lte("deadline", now.toISOString());

  if (fetchMarketsError) {
    console.error("Failed to fetch expired markets:", fetchMarketsError.message);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }

  const expiredMarkets: MarketRow[] = (expiredData ?? []).map((row) => ({
    marketId: row.id as string,
    proposerAgentId: row.proposer_agent_id as string,
    sourcePostId: (row.source_post_id as string) ?? "",
    tokenSymbol: row.token_symbol as string,
    conditionType: row.condition_type as string,
    threshold: Number(row.threshold),
    priceAtCreation: Number(row.price_at_creation),
    deadline: row.deadline as string,
    poolYes: Number(row.pool_yes),
    poolNo: Number(row.pool_no),
    isResolved: false,
    outcome: null as "yes" | "no" | null,
  }));

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
  const allResolvedPredictions: OnChainPredictionData[] = [];

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

    // Persist resolution to DB
    const { error: resolveError } = await supabase
      .from("prediction_markets")
      .update({ is_resolved: true, outcome })
      .eq("id", market.marketId);

    if (resolveError) {
      console.warn(`Failed to persist market resolution ${market.marketId}: ${resolveError.message}`);
    }

    console.log(
      `Market ${market.marketId} (${market.tokenSymbol} ${market.conditionType} ${market.threshold}): ` +
        `price=${currentPrice}, outcome=${outcome}`
    );

    // --- Resolve associated predictions in the DB ---
    const { count: predictionsResolved, resolved } =
      await resolveAssociatedPredictions(
        supabase,
        market,
        currentPrice,
        agentIdsToRecalculate
      );

    allResolvedPredictions.push(...resolved);

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

  // --- On-chain recording (best-effort) ---
  try {
    const { recordBatchOnChain } = await import(
      "@/lib/solana/prediction-recorder"
    );
    const txMap = await recordBatchOnChain(allResolvedPredictions);
    for (const [predictionId, txSig] of txMap) {
      await supabase
        .from("predictions")
        .update({ tx_signature: txSig })
        .eq("id", predictionId);
    }
  } catch (err) {
    console.warn("On-chain recording failed (best-effort):", err);
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
  markets: MarketRow[]
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

  // Fallback to DB cache for any symbols not found via CoinGecko
  for (const symbol of symbols) {
    if (!priceMap.has(symbol)) {
      const cached = await fetchCachedTokenBySymbol(symbol);
      if (cached) {
        priceMap.set(symbol, cached.price);
      }
    }
  }

  return priceMap;
}

/**
 * Evaluate a prediction market condition against the current price.
 */
function evaluateCondition(
  market: MarketRow,
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
 * Returns both the count and the resolved prediction data for on-chain recording.
 */
async function resolveAssociatedPredictions(
  supabase: ReturnType<typeof createAdminClient>,
  market: MarketRow,
  currentPrice: number,
  agentIdsToRecalculate: Set<string>
): Promise<{ count: number; resolved: OnChainPredictionData[] }> {
  // Find unresolved predictions for this token
  const { data: predictions, error: fetchError } = await supabase
    .from("predictions")
    .select("id, agent_id, direction, confidence, price_at_prediction, token_symbol")
    .eq("token_symbol", market.tokenSymbol)
    .eq("resolved", false);

  if (fetchError || !predictions || predictions.length === 0) {
    return { count: 0, resolved: [] };
  }

  const rows = predictions as PredictionRow[];
  let resolvedCount = 0;
  const resolvedData: OnChainPredictionData[] = [];

  for (const prediction of rows) {
    const priceAtPrediction = Number(prediction.price_at_prediction);
    if (!priceAtPrediction || priceAtPrediction <= 0) continue;

    const priceWentUp = currentPrice > priceAtPrediction;

    // Direction score: 1.0 if prediction direction matches actual movement, 0.0 otherwise
    const directionCorrect =
      (prediction.direction === "bullish" && priceWentUp) ||
      (prediction.direction === "bearish" && !priceWentUp);
    const directionScore = directionCorrect ? 1.0 : 0.0;

    // Calibration score: 1 - |confidence - outcome_binary|
    // Matches resolve.ts formula for consistency across both resolution paths
    const confidence = Number(prediction.confidence);
    const outcomeBinary = directionCorrect ? 1 : 0;
    const calibrationScore = 1 - Math.abs(confidence - outcomeBinary);

    // Final score: 70% direction + 30% calibration (0-1 scale)
    const finalScore = directionScore * 0.7 + calibrationScore * 0.3;

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

      resolvedData.push({
        predictionId: prediction.id,
        agentId: prediction.agent_id,
        tokenSymbol: prediction.token_symbol,
        direction: prediction.direction,
        confidence,
        priceAtPrediction,
        priceAtResolution: currentPrice,
        outcome,
        directionScore: Math.round(directionScore * 100) / 100,
        finalScore: Math.round(finalScore * 100) / 100,
      });
    }
  }

  return { count: resolvedCount, resolved: resolvedData };
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
