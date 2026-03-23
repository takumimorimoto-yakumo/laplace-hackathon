// ============================================================
// Performance Analytics Queries
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

// ---------- Types ----------

export interface PerformanceStatRow {
  statType: string;
  dimensionValue: string;
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnl: number;
  avgPnl: number;
  avgPnlPct: number;
  avgHoldingHours: number | null;
  bullishTrades: number;
  bullishWins: number;
  bearishTrades: number;
  bearishWins: number;
}

export interface StrategyAdjustmentRow {
  adjustmentType: string;
  target: string | null;
  ruleValue: number | null;
  ruleDescription: string;
  supportingEvidence: string;
  confidence: number;
  expiresAt: string | null;
}

// ---------- Queries ----------

/**
 * Fetch performance stats for an agent, ordered by total trades (most significant first).
 */
export async function fetchPerformanceStats(
  agentId: string,
  limit: number = 20,
): Promise<PerformanceStatRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("agent_performance_stats")
    .select(
      "stat_type, dimension_value, total_trades, wins, losses, total_pnl, avg_pnl, avg_pnl_pct, avg_holding_hours, bullish_trades, bullish_wins, bearish_trades, bearish_wins"
    )
    .eq("agent_id", agentId)
    .order("total_trades", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`[performance] Failed to fetch stats for ${agentId}: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    statType: row.stat_type as string,
    dimensionValue: row.dimension_value as string,
    totalTrades: Number(row.total_trades),
    wins: Number(row.wins),
    losses: Number(row.losses),
    totalPnl: Number(row.total_pnl),
    avgPnl: Number(row.avg_pnl),
    avgPnlPct: Number(row.avg_pnl_pct),
    avgHoldingHours: row.avg_holding_hours !== null ? Number(row.avg_holding_hours) : null,
    bullishTrades: Number(row.bullish_trades ?? 0),
    bullishWins: Number(row.bullish_wins ?? 0),
    bearishTrades: Number(row.bearish_trades ?? 0),
    bearishWins: Number(row.bearish_wins ?? 0),
  }));
}

/**
 * Fetch active strategy adjustments for an agent.
 */
export async function fetchActiveAdjustments(
  agentId: string,
): Promise<StrategyAdjustmentRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("agent_strategy_adjustments")
    .select(
      "adjustment_type, target, rule_value, rule_description, supporting_evidence, confidence, expires_at"
    )
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .order("confidence", { ascending: false });

  if (error) {
    console.warn(`[performance] Failed to fetch adjustments for ${agentId}: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    adjustmentType: row.adjustment_type as string,
    target: (row.target as string) ?? null,
    ruleValue: row.rule_value !== null ? Number(row.rule_value) : null,
    ruleDescription: row.rule_description as string,
    supportingEvidence: row.supporting_evidence as string,
    confidence: Number(row.confidence),
    expiresAt: (row.expires_at as string) ?? null,
  }));
}
