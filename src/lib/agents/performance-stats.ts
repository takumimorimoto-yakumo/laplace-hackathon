// ============================================================
// Performance Stats — Structured trade analysis by dimension
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

// ---------- Types ----------

type StatType = "by_token" | "by_side" | "by_close_reason" | "by_holding_duration";

interface ClosedTrade {
  token_symbol: string;
  side: string;
  realized_pnl: number;
  realized_pnl_pct: number;
  close_reason: string | null;
  executed_at: string;
  opened_at: string | null;
}

interface StatRow {
  agent_id: string;
  stat_type: StatType;
  dimension_value: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_pnl: number;
  avg_pnl_pct: number;
  avg_holding_hours: number | null;
  bullish_trades: number;
  bullish_wins: number;
  bearish_trades: number;
  bearish_wins: number;
  window_days: number;
}

// ---------- Helpers ----------

function holdingHours(opened: string | null, closed: string): number | null {
  if (!opened) return null;
  return (new Date(closed).getTime() - new Date(opened).getTime()) / (1000 * 60 * 60);
}

function holdingDurationBucket(hours: number | null): string {
  if (hours === null) return "unknown";
  if (hours < 4) return "< 4h";
  if (hours < 24) return "4-24h";
  if (hours < 72) return "1-3d";
  if (hours < 168) return "3-7d";
  return "> 7d";
}

function buildStatRow(
  agentId: string,
  statType: StatType,
  dimensionValue: string,
  trades: ClosedTrade[],
  windowDays: number,
): StatRow {
  const wins = trades.filter((t) => Number(t.realized_pnl) >= 0).length;
  const losses = trades.length - wins;
  const totalPnl = trades.reduce((s, t) => s + Number(t.realized_pnl), 0);
  const avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;
  const avgPnlPct =
    trades.length > 0
      ? trades.reduce((s, t) => s + Number(t.realized_pnl_pct), 0) / trades.length
      : 0;

  const hours = trades
    .map((t) => holdingHours(t.opened_at, t.executed_at))
    .filter((h): h is number => h !== null);
  const avgHoldingHours =
    hours.length > 0 ? hours.reduce((s, h) => s + h, 0) / hours.length : null;

  // Directional breakdown
  const bullishTrades = trades.filter((t) => t.side === "long");
  const bearishTrades = trades.filter((t) => t.side === "short");

  return {
    agent_id: agentId,
    stat_type: statType,
    dimension_value: dimensionValue,
    total_trades: trades.length,
    wins,
    losses,
    total_pnl: Math.round(totalPnl * 100) / 100,
    avg_pnl: Math.round(avgPnl * 100) / 100,
    avg_pnl_pct: Math.round(avgPnlPct * 100) / 100,
    avg_holding_hours: avgHoldingHours !== null ? Math.round(avgHoldingHours * 10) / 10 : null,
    bullish_trades: bullishTrades.length,
    bullish_wins: bullishTrades.filter((t) => Number(t.realized_pnl) >= 0).length,
    bearish_trades: bearishTrades.length,
    bearish_wins: bearishTrades.filter((t) => Number(t.realized_pnl) >= 0).length,
    window_days: windowDays,
  };
}

// ---------- Main ----------

/**
 * Compute and upsert structured performance stats for an agent.
 * Pure DB operation — no LLM calls.
 */
export async function computeAgentPerformanceStats(
  agentId: string,
  windowDays: number = 30,
): Promise<number> {
  const supabase = createAdminClient();

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Fetch closed trades with open timestamps from positions
  const { data: rawTrades, error } = await supabase
    .from("virtual_trades")
    .select("token_symbol, side, realized_pnl, realized_pnl_pct, close_reason, executed_at")
    .eq("agent_id", agentId)
    .eq("action", "close")
    .gte("executed_at", cutoff)
    .order("executed_at", { ascending: false });

  if (error) {
    console.error(`[perf-stats] Failed to fetch trades for ${agentId}: ${error.message}`);
    return 0;
  }

  if (!rawTrades || rawTrades.length === 0) return 0;

  // Fetch corresponding open trades to calculate holding duration
  const { data: openTrades } = await supabase
    .from("virtual_trades")
    .select("token_symbol, executed_at")
    .eq("agent_id", agentId)
    .eq("action", "open")
    .gte("executed_at", cutoff)
    .order("executed_at", { ascending: false });

  // Build a map of token → most recent open time for duration estimation
  const openTimeByToken = new Map<string, string[]>();
  for (const ot of openTrades ?? []) {
    const sym = ot.token_symbol as string;
    if (!openTimeByToken.has(sym)) openTimeByToken.set(sym, []);
    openTimeByToken.get(sym)!.push(ot.executed_at as string);
  }

  const trades: ClosedTrade[] = rawTrades.map((t) => {
    const sym = t.token_symbol as string;
    // Best-effort matching: pop the most recent open time for this token
    const openTimes = openTimeByToken.get(sym);
    const openedAt = openTimes && openTimes.length > 0 ? openTimes.pop()! : null;

    return {
      token_symbol: sym,
      side: t.side as string,
      realized_pnl: Number(t.realized_pnl ?? 0),
      realized_pnl_pct: Number(t.realized_pnl_pct ?? 0),
      close_reason: (t.close_reason as string) ?? null,
      executed_at: t.executed_at as string,
      opened_at: openedAt,
    };
  });

  const rows: StatRow[] = [];

  // --- by_token ---
  const byToken = new Map<string, ClosedTrade[]>();
  for (const t of trades) {
    if (!byToken.has(t.token_symbol)) byToken.set(t.token_symbol, []);
    byToken.get(t.token_symbol)!.push(t);
  }
  for (const [token, tokenTrades] of byToken) {
    rows.push(buildStatRow(agentId, "by_token", token, tokenTrades, windowDays));
  }

  // --- by_side ---
  const bySide = new Map<string, ClosedTrade[]>();
  for (const t of trades) {
    const side = t.side || "unknown";
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side)!.push(t);
  }
  for (const [side, sideTrades] of bySide) {
    rows.push(buildStatRow(agentId, "by_side", side, sideTrades, windowDays));
  }

  // --- by_close_reason ---
  const byReason = new Map<string, ClosedTrade[]>();
  for (const t of trades) {
    const reason = t.close_reason || "unknown";
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason)!.push(t);
  }
  for (const [reason, reasonTrades] of byReason) {
    rows.push(buildStatRow(agentId, "by_close_reason", reason, reasonTrades, windowDays));
  }

  // --- by_holding_duration ---
  const byDuration = new Map<string, ClosedTrade[]>();
  for (const t of trades) {
    const hours = holdingHours(t.opened_at, t.executed_at);
    const bucket = holdingDurationBucket(hours);
    if (!byDuration.has(bucket)) byDuration.set(bucket, []);
    byDuration.get(bucket)!.push(t);
  }
  for (const [bucket, durationTrades] of byDuration) {
    rows.push(buildStatRow(agentId, "by_holding_duration", bucket, durationTrades, windowDays));
  }

  // Delete old stats for this agent/window, then insert fresh
  const { error: deleteError } = await supabase
    .from("agent_performance_stats")
    .delete()
    .eq("agent_id", agentId)
    .eq("window_days", windowDays);

  if (deleteError) {
    console.error(`[perf-stats] Failed to clear old stats for ${agentId}: ${deleteError.message}`);
    return 0;
  }

  const { error: insertError } = await supabase
    .from("agent_performance_stats")
    .insert(
      rows.map((r) => ({
        agent_id: r.agent_id,
        stat_type: r.stat_type,
        dimension_value: r.dimension_value,
        total_trades: r.total_trades,
        wins: r.wins,
        losses: r.losses,
        total_pnl: r.total_pnl,
        avg_pnl: r.avg_pnl,
        avg_pnl_pct: r.avg_pnl_pct,
        avg_holding_hours: r.avg_holding_hours,
        bullish_trades: r.bullish_trades,
        bullish_wins: r.bullish_wins,
        bearish_trades: r.bearish_trades,
        bearish_wins: r.bearish_wins,
        window_days: r.window_days,
        computed_at: new Date().toISOString(),
      })),
    );

  if (insertError) {
    console.error(`[perf-stats] Failed to insert stats for ${agentId}: ${insertError.message}`);
    return 0;
  }

  console.log(`[perf-stats] Computed ${rows.length} stat rows for agent ${agentId}`);
  return rows.length;
}
