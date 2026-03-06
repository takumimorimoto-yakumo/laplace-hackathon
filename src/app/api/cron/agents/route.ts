import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runAgent,
  runReply,
  runNews,
  runVirtualTrade,
  runMarketBet,
  closeExpiredPositions,
  resolvePredictions,
  updateUnrealizedPnL,
} from "@/lib/agents/runner";
import type { RunResult } from "@/lib/agents/runner";
import { fetchMarketContext } from "@/lib/agents/market-context";
import { recordPortfolioSnapshot } from "@/lib/agents/portfolio-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

/** Probability that a reply is generated after a prediction */
const REPLY_PROBABILITY = 0.3;
/** Probability that a news article is generated after a prediction (pro pickers only) */
const NEWS_PROBABILITY = 0.1;

interface AgentCycleResult {
  agentId: string;
  name: string;
  prediction: RunResult;
  reply?: RunResult;
  news?: RunResult;
  tradeExecuted: boolean;
  marketBetsPlaced: number;
  expiredPositionsClosed: boolean;
}

export async function GET(request: NextRequest) {
  // Verify cron secret (reject if not configured or mismatch)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Fetch agents that are due
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, next_wake_at")
    .or(`next_wake_at.is.null,next_wake_at.lte.${now}`)
    .limit(20); // Process max 20 at a time

  if (error) {
    console.error("Failed to fetch due agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ message: "No agents due", processed: 0 });
  }

  // Fetch market data ONCE for the entire cron cycle
  let sharedMarketData;
  try {
    sharedMarketData = await fetchMarketContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] fetchMarketContext failed: ${msg}`);
  }

  // Run each agent sequentially (to avoid overwhelming LLM APIs)
  const results: AgentCycleResult[] = [];

  for (const agent of agents) {
    const cycleResult: AgentCycleResult = {
      agentId: agent.id,
      name: agent.name,
      prediction: { action: "skipped" },
      tradeExecuted: false,
      marketBetsPlaced: 0,
      expiredPositionsClosed: false,
    };

    // 1. Run prediction (main mode) — reuse shared market data
    const predictionResult = await runAgent(agent.id, sharedMarketData);
    cycleResult.prediction = predictionResult;

    // 2. If prediction succeeded, execute virtual trade (reuse market data)
    if (
      predictionResult.action === "posted" &&
      predictionResult.postId &&
      predictionResult.output
    ) {
      try {
        await runVirtualTrade(
          agent.id,
          predictionResult.postId,
          predictionResult.output,
          sharedMarketData
        );
        cycleResult.tradeExecuted = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron] Virtual trade failed for ${agent.name}: ${msg}`);
      }
    }

    // 3. Maybe run reply (~30% chance) — reuse shared market data
    if (Math.random() < REPLY_PROBABILITY) {
      cycleResult.reply = await runReply(agent.id, sharedMarketData);
    }

    // 4. Maybe run news (~10% chance, pro pickers only) — reuse shared market data
    if (Math.random() < NEWS_PROBABILITY) {
      cycleResult.news = await runNews(agent.id, sharedMarketData);
    }

    // 5. Place market bets on open prediction markets
    try {
      cycleResult.marketBetsPlaced = await runMarketBet(agent.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] Market bet failed for ${agent.name}: ${msg}`);
    }

    // 6. Update unrealized P&L (mark-to-market) — reuse shared market data
    if (sharedMarketData) {
      try {
        await updateUnrealizedPnL(agent.id, sharedMarketData);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron] updateUnrealizedPnL failed for ${agent.name}: ${msg}`);
      }
    }

    // 7. Close expired positions (reuse shared market data)
    try {
      await closeExpiredPositions(agent.id, sharedMarketData);
      cycleResult.expiredPositionsClosed = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron] closeExpiredPositions failed for ${agent.name}: ${msg}`
      );
    }

    // 8. Record portfolio snapshot (after P&L is updated)
    try {
      await recordPortfolioSnapshot(agent.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] recordPortfolioSnapshot failed for ${agent.name}: ${msg}`);
    }

    results.push(cycleResult);
  }

  // Resolve predictions older than 24h (once per cron cycle)
  let predictionsResolved = 0;
  try {
    predictionsResolved = await resolvePredictions();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] resolvePredictions failed: ${msg}`);
  }

  const summary = {
    predictionsResolved,
    predictions: {
      posted: results.filter((r) => r.prediction.action === "posted").length,
      skipped: results.filter((r) => r.prediction.action === "skipped").length,
      errors: results.filter((r) => r.prediction.action === "error").length,
    },
    replies: {
      attempted: results.filter((r) => r.reply).length,
      posted: results.filter((r) => r.reply?.action === "posted").length,
    },
    news: {
      attempted: results.filter((r) => r.news).length,
      posted: results.filter((r) => r.news?.action === "posted").length,
    },
    trades: results.filter((r) => r.tradeExecuted).length,
    marketBets: results.reduce((sum, r) => sum + r.marketBetsPlaced, 0),
  };

  return NextResponse.json({
    message: `Processed ${results.length} agents`,
    processed: results.length,
    summary,
    results: results.map((r) => ({
      agentId: r.agentId,
      name: r.name,
      prediction: r.prediction.action,
      predictionPostId: r.prediction.postId,
      reply: r.reply?.action,
      news: r.news?.action,
      tradeExecuted: r.tradeExecuted,
    })),
  });
}
