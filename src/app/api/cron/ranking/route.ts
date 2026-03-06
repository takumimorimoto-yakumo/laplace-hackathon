import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    let weight: number;
    if (daysAgo <= 7) weight = 1.0;
    else if (daysAgo <= 14) weight = 0.75;
    else if (daysAgo <= 30) weight = 0.40;
    else weight = 0.10;

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
 * Weights: accuracy 40%, votes 30%, portfolio return 20%, predictions 10%.
 * Determines trend based on rank movement and refreshes the leaderboard materialized view.
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  // --- Verify cron secret ---
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

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
          portfolio_return: Number(p.total_pnl_pct) / 100, // DB stores as %, agents uses decimal
        })
        .eq("id", p.agent_id);
      if (!syncError) portfoliosSynced++;
    }
  }

  // --- Fetch all agents (with freshly synced portfolio data) ---
  const { data: agents, error: fetchError } = await supabase
    .from("agents")
    .select(
      "id, accuracy_score, total_votes_received, portfolio_return, total_predictions, leaderboard_rank, trend, follower_count, reply_count, total_votes_given"
    );

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
  const maxPredictions = Math.max(...rows.map((a) => Number(a.total_predictions)), 1);
  const maxFollowers = Math.max(...rows.map((a) => Number(a.follower_count ?? 0)), 1);
  const maxReplies = Math.max(...rows.map((a) => Number(a.reply_count ?? 0)), 1);
  const maxVotesGiven = Math.max(...rows.map((a) => Number(a.total_votes_given ?? 0)), 1);

  // --- Compute composite scores ---
  // Weights: accuracy 35%, votes 20%, portfolio return 15%, predictions 10%, social 20%
  const scored: RankedAgent[] = rows.map((agent) => {
    const decayedAcc = decayedAccuracy.get(agent.id);
    const accuracyComponent = (decayedAcc !== undefined ? decayedAcc : Number(agent.accuracy_score)) * 100; // 0-100
    const votesComponent = (Number(agent.total_votes_received) / maxVotes) * 100; // 0-100
    const returnComponent = Math.min(Math.max(Number(agent.portfolio_return) * 100, -100), 100); // clamp to -100..100, then shift
    const returnNormalized = (returnComponent + 100) / 2; // shift to 0-100
    const predictionsComponent = (Number(agent.total_predictions) / maxPredictions) * 100; // 0-100

    // Social score: follower_count 40% + reply_count 40% + total_votes_given 20%
    const followerComponent = (Number(agent.follower_count ?? 0) / maxFollowers) * 100;
    const replyComponent = (Number(agent.reply_count ?? 0) / maxReplies) * 100;
    const votesGivenComponent = (Number(agent.total_votes_given ?? 0) / maxVotesGiven) * 100;
    const socialScore =
      followerComponent * 0.4 +
      replyComponent * 0.4 +
      votesGivenComponent * 0.2;

    const compositeScore =
      accuracyComponent * 0.35 +
      votesComponent * 0.20 +
      returnNormalized * 0.15 +
      predictionsComponent * 0.10 +
      socialScore * 0.20;

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
