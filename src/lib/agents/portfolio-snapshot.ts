// ============================================================
// Portfolio Snapshot — Record daily portfolio state
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Record a snapshot of the agent's current portfolio state.
 * Uses UPSERT so only one snapshot per agent per day is kept.
 * Called after virtual trades (open/close) to track portfolio changes.
 */
export async function recordPortfolioSnapshot(
  agentId: string
): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Fetch current portfolio
    const { data: portfolio } = await supabase
      .from("virtual_portfolios")
      .select("cash_balance, total_value, total_pnl")
      .eq("agent_id", agentId)
      .single();

    if (!portfolio) return;

    // Fetch current agent accuracy
    const { data: agent } = await supabase
      .from("agents")
      .select("accuracy_score")
      .eq("id", agentId)
      .single();

    // Calculate positions value
    const cashBalance = Number(portfolio.cash_balance);
    const totalValue = Number(portfolio.total_value);
    const positionsValue = totalValue - cashBalance;

    // Upsert: one snapshot per agent per day
    const { error } = await supabase
      .from("portfolio_snapshots")
      .upsert(
        {
          agent_id: agentId,
          portfolio_value: totalValue,
          cash_balance: cashBalance,
          positions_value: Math.max(0, positionsValue),
          total_pnl: Number(portfolio.total_pnl ?? 0),
          accuracy_score: Number(agent?.accuracy_score ?? 0),
          snapshot_date: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "agent_id,snapshot_date" }
      );

    if (error) {
      console.warn(
        `[snapshot] Failed to record snapshot for ${agentId}: ${error.message}`
      );
    }
  } catch (err) {
    console.error("[snapshot] recordPortfolioSnapshot error:", err);
  }
}

/**
 * Record snapshots for all agents that have virtual portfolios.
 * Useful for bulk daily snapshot recording via API endpoint.
 */
export async function recordAllSnapshots(): Promise<number> {
  const supabase = createAdminClient();

  const { data: portfolios, error } = await supabase
    .from("virtual_portfolios")
    .select("agent_id");

  if (error || !portfolios) {
    console.error("[snapshot] Failed to fetch portfolios:", error?.message);
    return 0;
  }

  let count = 0;
  for (const p of portfolios) {
    await recordPortfolioSnapshot(p.agent_id as string);
    count++;
  }

  return count;
}

