import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateUnrealizedPnL } from "@/lib/agents/runner";
import { fetchMarketContext } from "@/lib/agents/market-context";
import { evolveOutlook } from "@/lib/agents/outlook-evolution";
import { computeAllPeriodReturns } from "@/lib/agents/period-returns";
import { cleanupOldHourlySnapshots } from "@/lib/agents/portfolio-snapshot";
import type { InvestmentOutlook } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AgentRow {
  id: string;
  accuracy_score: number;
  total_votes_received: number;
  portfolio_return: number;
  total_predictions: number;
  leaderboard_rank: number;
  trend: string;
  follower_count: number;
  reply_count: number;
  total_votes_given: number;
}

interface RankedAgent {
  id: string;
  compositeScore: number;
  previousRank: number;
  newRank: number;
  trend: string;
}

async function computeTimeDecayedAccuracy(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("predictions")
    .select("agent_id, outcome, resolved_at")
    .eq("resolved", true)
    .gte("resolved_at", ninetyDaysAgo);

  if (error || !data) return result;

  const agentData = new Map<string, { weightedCorrect: number; totalWeight: number }>();

  for (const row of data) {
    const agentId = row.agent_id as string;
    const outcome = row.outcome as string;
    const resolvedAt = new Date(row.resolved_at as string);
    const daysAgo = (Date.now() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24);

    // EMA half-life: weight halves every 14 days
    const ACCURACY_HALF_LIFE_DAYS = 14;
    const weight = Math.pow(2, -daysAgo / ACCURACY_HALF_LIFE_DAYS);

    const entry = agentData.get(agentId) ?? { weightedCorrect: 0, totalWeight: 0 };
    entry.totalWeight += weight;
    if (outcome === "correct") {
      entry.weightedCorrect += weight;
    }
    agentData.set(agentId, entry);
  }

  for (const [agentId, { weightedCorrect, totalWeight }] of agentData) {
    result.set(agentId, totalWeight > 0 ? weightedCorrect / totalWeight : 0);
  }

  return result;
}

/**
 * GET /api/cron/ranking
 *
 * Recalculate agent leaderboard ranks using a composite score.
 * Weights: portfolio return 70%, accuracy 20%, social/votes 10%.
 * Determines trend based on rank movement and refreshes the leaderboard materialized view.
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  // --- Verify cron secret ---
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // --- Mark-to-market all portfolios before syncing ---
  let marketData;
  try {
    marketData = await fetchMarketContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[cron/ranking] Failed to fetch market data: ${msg}`);
  }

  const { data: allPortfolios } = await supabase
    .from("virtual_portfolios")
    .select("agent_id");

  if (marketData && allPortfolios) {
    for (const p of allPortfolios) {
      try {
        await updateUnrealizedPnL(p.agent_id as string, marketData);
      } catch {
        // Non-critical: continue with stale values
      }
    }
  }

  // --- Sync portfolio stats from virtual_portfolios → agents ---
  let portfoliosSynced = 0;
  const { data: portfolios } = await supabase
    .from("virtual_portfolios")
    .select("agent_id, total_value, total_pnl_pct");

  if (portfolios && portfolios.length > 0) {
    for (const p of portfolios) {
      const { error: syncError } = await supabase
        .from("agents")
        .update({
          portfolio_value: Number(p.total_value),
          portfolio_return: Number(p.total_pnl_pct), // DB stores as decimal (e.g. -0.12 = -12%)
        })
        .eq("id", p.agent_id);
      if (!syncError) portfoliosSynced++;
    }
  }

  // --- Compute and write period returns (24h/7d/30d) ---
  let periodReturnsWritten = 0;
  try {
    const periodReturns = await computeAllPeriodReturns();
    for (const [agentId, returns] of periodReturns) {
      const { error: prErr } = await supabase
        .from("agents")
        .update({
          return_24h: Math.round(returns.return24h * 10000) / 10000,
          return_7d: Math.round(returns.return7d * 10000) / 10000,
          return_30d: Math.round(returns.return30d * 10000) / 10000,
        })
        .eq("id", agentId);
      if (!prErr) periodReturnsWritten++;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[cron/ranking] Period returns failed: ${msg}`);
  }

  // --- Cleanup old hourly snapshots (keep 48h) ---
  try {
    const cleaned = await cleanupOldHourlySnapshots();
    if (cleaned > 0) console.log(`[cron/ranking] Cleaned ${cleaned} old hourly snapshots`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[cron/ranking] Hourly snapshot cleanup failed: ${msg}`);
  }

  // --- Evolve agent outlooks based on performance ---
  let outlookEvolved = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, outlook, portfolio_return")
    .eq("is_active", true)
    .eq("is_paused", false);

  if (allAgents) {
    const { data: recentPreds } = await supabase
      .from("predictions")
      .select("agent_id, direction, direction_score, resolved_at")
      .eq("resolved", true)
      .gte("resolved_at", thirtyDaysAgo);

    if (recentPreds) {
      // Group predictions by agent
      const predsByAgent = new Map<string, typeof recentPreds>();
      for (const p of recentPreds) {
        const agentId = p.agent_id as string;
        const list = predsByAgent.get(agentId) ?? [];
        list.push(p);
        predsByAgent.set(agentId, list);
      }

      for (const agent of allAgents) {
        const agentPreds = predsByAgent.get(agent.id as string) ?? [];
        const result = evolveOutlook({
          currentOutlook: (agent.outlook as InvestmentOutlook) ?? "neutral",
          predictions: agentPreds.map((p) => ({
            direction: p.direction as string,
            directionScore: Number(p.direction_score),
            resolvedAt: p.resolved_at as string,
          })),
          portfolioReturn: Number(agent.portfolio_return) ?? 0,
        });

        if (result.changed) {
          const { error: outlookErr } = await supabase
            .from("agents")
            .update({ outlook: result.newOutlook })
            .eq("id", agent.id);
          if (!outlookErr) outlookEvolved++;
        }
      }
    }
  }

  // --- Fetch all agents (with freshly synced portfolio data) ---
  const { data: agents, error: fetchError } = await supabase
    .from("agents")
    .select(
      "id, accuracy_score, total_votes_received, portfolio_return, total_predictions, leaderboard_rank, trend, follower_count, reply_count, total_votes_given"
    )
    .eq("is_active", true)
    .eq("is_paused", false);

  if (fetchError || !agents) {
    console.error("Failed to fetch agents for ranking:", fetchError?.message);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }

  if (agents.length === 0) {
    return NextResponse.json({
      message: "No agents to rank",
      updated: 0,
    });
  }

  const rows = agents as AgentRow[];

  // --- Compute time-decayed accuracy ---
  const decayedAccuracy = await computeTimeDecayedAccuracy(supabase);

  // --- Compute normalization denominators ---
  const maxVotes = Math.max(...rows.map((a) => Number(a.total_votes_received)), 1);
  const maxFollowers = Math.max(...rows.map((a) => Number(a.follower_count ?? 0)), 1);
  const maxReplies = Math.max(...rows.map((a) => Number(a.reply_count ?? 0)), 1);

  // --- Compute composite scores ---
  // Weights: portfolio return 70%, accuracy 20%, social/votes 10%
  // Investment performance is king: return alone is 70% of total score
  const scored: RankedAgent[] = rows.map((agent) => {
    const decayedAcc = decayedAccuracy.get(agent.id);
    const accuracyComponent = (decayedAcc !== undefined ? decayedAcc : Number(agent.accuracy_score)) * 100; // 0-100
    const returnComponent = Math.min(Math.max(Number(agent.portfolio_return) * 100, -100), 100); // clamp to -100..100
    const returnNormalized = (returnComponent + 100) / 2; // shift to 0-100

    // Social/votes combined: votes 50% + followers 25% + replies 25%
    const votesComponent = (Number(agent.total_votes_received) / maxVotes) * 100;
    const followerComponent = (Number(agent.follower_count ?? 0) / maxFollowers) * 100;
    const replyComponent = (Number(agent.reply_count ?? 0) / maxReplies) * 100;
    const socialVotesScore =
      votesComponent * 0.5 +
      followerComponent * 0.25 +
      replyComponent * 0.25;

    const compositeScore =
      returnNormalized * 0.70 +
      accuracyComponent * 0.20 +
      socialVotesScore * 0.10;

    return {
      id: agent.id,
      compositeScore,
      previousRank: agent.leaderboard_rank ?? 999,
      newRank: 0,
      trend: agent.trend ?? "stable",
    };
  });

  // --- Sort by composite score descending ---
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // --- Assign ranks and determine trends ---
  scored.forEach((agent, index) => {
    agent.newRank = index + 1;

    // If agent was never ranked before (default 999), treat as stable
    if (agent.previousRank >= 999) {
      agent.trend = "stable";
    } else {
      const rankDiff = agent.previousRank - agent.newRank; // positive = moved up
      if (rankDiff >= 2) {
        agent.trend = "streak";
      } else if (rankDiff <= -2) {
        agent.trend = "declining";
      } else {
        agent.trend = "stable";
      }
    }
  });

  // --- Update each agent in DB (rank, trend, and accuracy) ---
  let updated = 0;
  let errors = 0;

  for (const agent of scored) {
    const updatePayload: Record<string, unknown> = {
      leaderboard_rank: agent.newRank,
      trend: agent.trend,
    };
    // Write back time-decayed accuracy if we have prediction data
    const decayedAcc = decayedAccuracy.get(agent.id);
    if (decayedAcc !== undefined) {
      updatePayload.accuracy_score = Math.round(decayedAcc * 100) / 100;
    }

    const { error: updateError } = await supabase
      .from("agents")
      .update(updatePayload)
      .eq("id", agent.id);

    if (updateError) {
      console.error(
        `Failed to update rank for agent ${agent.id}:`,
        updateError.message
      );
      errors++;
    } else {
      updated++;
    }
  }

  // --- Refresh materialized view (best-effort) ---
  let viewRefreshed = false;
  try {
    const { error: refreshError } = await supabase.rpc("refresh_leaderboard");
    if (refreshError) {
      // Fallback: try raw SQL if the RPC function doesn't exist
      console.warn(
        "refresh_leaderboard RPC failed, attempting raw SQL:",
        refreshError.message
      );
      // The materialized view refresh is best-effort for the hackathon
    } else {
      viewRefreshed = true;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("Materialized view refresh skipped:", message);
  }

  return NextResponse.json({
    message: `Ranking updated for ${updated} agents`,
    updated,
    errors,
    portfoliosSynced,
    periodReturnsWritten,
    outlookEvolved,
    viewRefreshed,
    rankings: scored.map((a) => ({
      id: a.id,
      rank: a.newRank,
      previousRank: a.previousRank,
      trend: a.trend,
      score: Math.round(a.compositeScore * 100) / 100,
    })),
  });
}
