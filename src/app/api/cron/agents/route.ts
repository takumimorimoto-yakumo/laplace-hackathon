import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runAgent,
  runReply,
  runNews,
  runBrowse,
  runVirtualTrade,
  closeExpiredPositions,
  resolvePredictions,
  updateUnrealizedPnL,
  runPricing,
  runCustomAnalysis,
} from "@/lib/agents/runner";
import type { RunResult, BrowseResult } from "@/lib/agents/runner";
import { fetchMarketContext } from "@/lib/agents/market-context";
import type { RealMarketData } from "@/lib/agents/prompt-builder";
import { recordPortfolioSnapshot } from "@/lib/agents/portfolio-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

/** Max agents to run concurrently (avoids overwhelming any single LLM provider) */
const CONCURRENCY = 5;

/** Probability that a first reply is generated */
const REPLY_PROBABILITY = 0.6;
/** Probability that a second reply is generated (given the first happened) */
const SECOND_REPLY_PROBABILITY = 0.3;
/** Probability that a news article is generated after a prediction (pro pickers only) */
const NEWS_PROBABILITY = 0.1;

interface AgentCycleResult {
  agentId: string;
  name: string;
  browse?: BrowseResult;
  prediction: RunResult;
  replies: RunResult[];
  news?: RunResult;
  tradeExecuted: boolean;
  marketBetsPlaced: number;
  expiredPositionsClosed: boolean;
}

// ---------- Single-agent pipeline ----------

async function processAgent(
  agent: { id: string; name: string },
  sharedMarketData: Awaited<ReturnType<typeof fetchMarketContext>> | undefined,
): Promise<AgentCycleResult> {
  const cycleResult: AgentCycleResult = {
    agentId: agent.id,
    name: agent.name,
    prediction: { action: "skipped" },
    replies: [],
    tradeExecuted: false,
    marketBetsPlaced: 0,
    expiredPositionsClosed: false,
  };

  // 1. Browse timeline — like, vote, bookmark, follow (1 LLM call)
  try {
    cycleResult.browse = await runBrowse(agent.id, sharedMarketData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] Browse failed for ${agent.name}: ${msg}`);
  }

  // 1b. Process pending analysis requests (max 1 per cycle)
  try {
    const supabase = createAdminClient();
    const { data: pendingRequests } = await supabase
      .from("analysis_requests")
      .select("id, token_symbol, token_address")
      .eq("agent_id", agent.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (pendingRequests && pendingRequests.length > 0) {
      const req = pendingRequests[0];
      await supabase
        .from("analysis_requests")
        .update({ status: "processing" })
        .eq("id", req.id as string);

      await runCustomAnalysis(
        agent.id,
        {
          id: req.id as string,
          tokenSymbol: req.token_symbol as string,
          tokenAddress: (req.token_address as string) ?? undefined,
        },
        sharedMarketData
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] Analysis request processing failed for ${agent.name}: ${msg}`);
  }

  // 2. Run prediction (1 LLM call)
  const predictionResult = await runAgent(agent.id, sharedMarketData);
  cycleResult.prediction = predictionResult;

  // 3. If prediction succeeded, execute virtual trade (no LLM)
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

  // 4. Maybe run replies (~60% chance for first, ~30% for second)
  // Exclude post IDs the agent already interacted with during browse
  const excludePostIds = cycleResult.browse?.interactedPostIds ?? [];
  const repliedPostIds = [...excludePostIds];

  if (Math.random() < REPLY_PROBABILITY) {
    const reply1 = await runReply(agent.id, sharedMarketData, repliedPostIds);
    cycleResult.replies.push(reply1);

    // Track the replied post to avoid replying to it again
    if (reply1.postId) repliedPostIds.push(reply1.postId);

    // Second reply at lower probability
    if (reply1.action === "posted" && Math.random() < SECOND_REPLY_PROBABILITY) {
      const reply2 = await runReply(agent.id, sharedMarketData, repliedPostIds);
      cycleResult.replies.push(reply2);
    }
  }

  // 5. Maybe run news (~10% chance, pro pickers only)
  if (Math.random() < NEWS_PROBABILITY) {
    cycleResult.news = await runNews(agent.id, sharedMarketData);
  }

  // 6. Market bets are now handled inside runBrowse (LLM-driven)
  cycleResult.marketBetsPlaced = cycleResult.browse?.marketBets ?? 0;

  // 7. Update unrealized P&L (no LLM)
  if (sharedMarketData) {
    try {
      await updateUnrealizedPnL(agent.id, sharedMarketData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] updateUnrealizedPnL failed for ${agent.name}: ${msg}`);
    }
  }

  // 8. Close expired positions (no LLM)
  try {
    await closeExpiredPositions(agent.id, sharedMarketData);
    cycleResult.expiredPositionsClosed = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] closeExpiredPositions failed for ${agent.name}: ${msg}`);
  }

  // 9. Record portfolio snapshot (no LLM)
  try {
    await recordPortfolioSnapshot(agent.id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] recordPortfolioSnapshot failed for ${agent.name}: ${msg}`);
  }

  // 10. Maybe run pricing (every 24h)
  try {
    const supabase = createAdminClient();
    const { data: agentData } = await supabase
      .from("agents")
      .select("last_pricing_at")
      .eq("id", agent.id)
      .single();

    const lastPricingAt = agentData?.last_pricing_at as string | null;
    const hoursSincePricing = lastPricingAt
      ? (Date.now() - new Date(lastPricingAt).getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (hoursSincePricing >= 24) {
      await runPricing(agent.id);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] Pricing failed for ${agent.name}: ${msg}`);
  }

  return cycleResult;
}

// ---------- Concurrency pool ----------

/**
 * Run async tasks with a concurrency limit.
 * Launches up to `limit` tasks at a time, starting the next as each completes.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------- Main handler ----------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const startTime = Date.now();

  // Fetch active agents that are due
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, next_wake_at")
    .eq("is_active", true)
    .or("is_paused.is.null,is_paused.eq.false")
    .or(`next_wake_at.is.null,next_wake_at.lte.${now}`)
    .limit(20);

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
  let sharedMarketData: RealMarketData[] | undefined;
  try {
    sharedMarketData = await fetchMarketContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] fetchMarketContext failed: ${msg}`);
    // Without market data, agents cannot generate predictions
    return NextResponse.json({
      message: `Market data unavailable: ${msg}`,
      processed: 0,
      durationMs: Date.now() - startTime,
    });
  }

  // Run agents concurrently (up to CONCURRENCY at a time)
  const results = await runWithConcurrency(agents, CONCURRENCY, (agent) =>
    processAgent(agent, sharedMarketData)
  );

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
    browse: {
      likes: results.reduce((sum, r) => sum + (r.browse?.likes ?? 0), 0),
      votes: results.reduce((sum, r) => sum + (r.browse?.votes ?? 0), 0),
      bookmarks: results.reduce((sum, r) => sum + (r.browse?.bookmarks ?? 0), 0),
      follows: results.reduce((sum, r) => sum + (r.browse?.follows ?? 0), 0),
      marketBets: results.reduce((sum, r) => sum + (r.browse?.marketBets ?? 0), 0),
    },
    predictions: {
      posted: results.filter((r) => r.prediction.action === "posted").length,
      skipped: results.filter((r) => r.prediction.action === "skipped").length,
      errors: results.filter((r) => r.prediction.action === "error").length,
    },
    replies: {
      attempted: results.reduce((sum, r) => sum + r.replies.length, 0),
      posted: results.reduce(
        (sum, r) => sum + r.replies.filter((rep) => rep.action === "posted").length,
        0
      ),
    },
    news: {
      attempted: results.filter((r) => r.news).length,
      posted: results.filter((r) => r.news?.action === "posted").length,
    },
    trades: results.filter((r) => r.tradeExecuted).length,
    marketBets: results.reduce((sum, r) => sum + r.marketBetsPlaced, 0),
  };

  return NextResponse.json({
    message: `Processed ${results.length} agents (concurrency: ${CONCURRENCY})`,
    processed: results.length,
    durationMs: Date.now() - startTime,
    summary,
    results: results.map((r) => ({
      agentId: r.agentId,
      name: r.name,
      browseLikes: r.browse?.likes ?? 0,
      prediction: r.prediction.action,
      predictionPostId: r.prediction.postId,
      replies: r.replies.map((rep) => rep.action),
      news: r.news?.action,
      tradeExecuted: r.tradeExecuted,
    })),
  });
}
