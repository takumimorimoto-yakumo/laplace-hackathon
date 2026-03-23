// ============================================================
// Strategy Adjustments — Rule-based self-reinforcement from performance stats
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

// ---------- Types ----------

type AdjustmentType =
  | "token_avoid"
  | "token_preference"
  | "side_bias"
  | "confidence_calibration"
  | "sl_adjustment"
  | "tp_adjustment"
  | "holding_duration_limit";

interface PerformanceStat {
  stat_type: string;
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
}

interface AdjustmentRow {
  agent_id: string;
  adjustment_type: AdjustmentType;
  target: string | null;
  rule_value: number | null;
  rule_description: string;
  supporting_evidence: string;
  source_stat_type: string;
  confidence: number;
  is_active: boolean;
  expires_at: string;
}

// ---------- Constants ----------

/** Minimum trades required to derive a rule */
const MIN_TRADES = 5;

/** Win rate below this triggers token_avoid */
const AVOID_WIN_RATE = 0.30;

/** Win rate above this triggers token_preference */
const PREFER_WIN_RATE = 0.70;

/** SL hit rate above this triggers sl_adjustment */
const SL_HIT_RATE_THRESHOLD = 0.60;

/** TP hit rate above this triggers tp_adjustment (TP too conservative) */
const TP_HIT_RATE_THRESHOLD = 0.80;

/** Rules expire after this many days */
const RULE_EXPIRY_DAYS = 14;

// ---------- Rule Derivation ----------

function deriveTokenRules(agentId: string, stats: PerformanceStat[], expiresAt: string): AdjustmentRow[] {
  const rules: AdjustmentRow[] = [];
  const tokenStats = stats.filter((s) => s.stat_type === "by_token");

  for (const stat of tokenStats) {
    if (stat.total_trades < MIN_TRADES) continue;
    const winRate = stat.wins / stat.total_trades;
    const token = stat.dimension_value;

    if (winRate <= AVOID_WIN_RATE) {
      // Direction-specific avoidance: only avoid the side that's losing
      const bullishWinRate = stat.bullish_trades > 0 ? stat.bullish_wins / stat.bullish_trades : null;
      const bearishWinRate = stat.bearish_trades > 0 ? stat.bearish_wins / stat.bearish_trades : null;

      // If one side is clearly bad but the other is decent, only avoid the bad side
      const bullishBad = bullishWinRate !== null && stat.bullish_trades >= 3 && bullishWinRate <= AVOID_WIN_RATE;
      const bearishBad = bearishWinRate !== null && stat.bearish_trades >= 3 && bearishWinRate <= AVOID_WIN_RATE;
      const bullishOk = bullishWinRate !== null && bullishWinRate > AVOID_WIN_RATE;
      const bearishOk = bearishWinRate !== null && bearishWinRate > AVOID_WIN_RATE;

      if (bullishBad && bearishOk) {
        // Only avoid long side
        rules.push({
          agent_id: agentId,
          adjustment_type: "token_avoid",
          target: `${token}:long`,
          rule_value: bullishWinRate,
          rule_description: `Avoid long ${token}: ${stat.bullish_wins}/${stat.bullish_trades} bullish wins (${(bullishWinRate * 100).toFixed(0)}%) — bearish calls are fine`,
          supporting_evidence: `Bullish: ${stat.bullish_wins}/${stat.bullish_trades}, Bearish: ${stat.bearish_wins}/${stat.bearish_trades}, total PnL $${stat.total_pnl.toFixed(0)}`,
          source_stat_type: "by_token",
          confidence: Math.min(0.9, 0.5 + stat.total_trades * 0.05),
          is_active: true,
          expires_at: expiresAt,
        });
      } else if (bearishBad && bullishOk) {
        // Only avoid short side
        rules.push({
          agent_id: agentId,
          adjustment_type: "token_avoid",
          target: `${token}:short`,
          rule_value: bearishWinRate,
          rule_description: `Avoid short ${token}: ${stat.bearish_wins}/${stat.bearish_trades} bearish wins (${(bearishWinRate * 100).toFixed(0)}%) — bullish calls are fine`,
          supporting_evidence: `Bullish: ${stat.bullish_wins}/${stat.bullish_trades}, Bearish: ${stat.bearish_wins}/${stat.bearish_trades}, total PnL $${stat.total_pnl.toFixed(0)}`,
          source_stat_type: "by_token",
          confidence: Math.min(0.9, 0.5 + stat.total_trades * 0.05),
          is_active: true,
          expires_at: expiresAt,
        });
      } else {
        // Both sides bad or insufficient data to split — avoid entirely
        rules.push({
          agent_id: agentId,
          adjustment_type: "token_avoid",
          target: token,
          rule_value: winRate,
          rule_description: `Avoid ${token}: ${stat.wins}/${stat.total_trades} wins (${(winRate * 100).toFixed(0)}%), avg PnL $${stat.avg_pnl.toFixed(0)}`,
          supporting_evidence: `${stat.total_trades} trades over 30d, ${stat.losses} losses, total PnL $${stat.total_pnl.toFixed(0)}`,
          source_stat_type: "by_token",
          confidence: Math.min(0.9, 0.5 + stat.total_trades * 0.05),
          is_active: true,
          expires_at: expiresAt,
        });
      }
    } else if (winRate >= PREFER_WIN_RATE) {
      // Also note directional strength
      const bullishWinRate = stat.bullish_trades > 0 ? stat.bullish_wins / stat.bullish_trades : 0;
      const bearishWinRate = stat.bearish_trades > 0 ? stat.bearish_wins / stat.bearish_trades : 0;
      let dirNote = "";
      if (stat.bullish_trades >= 3 && bullishWinRate > bearishWinRate + 0.2) {
        dirNote = ` (strongest on bullish: ${stat.bullish_wins}/${stat.bullish_trades})`;
      } else if (stat.bearish_trades >= 3 && bearishWinRate > bullishWinRate + 0.2) {
        dirNote = ` (strongest on bearish: ${stat.bearish_wins}/${stat.bearish_trades})`;
      }

      rules.push({
        agent_id: agentId,
        adjustment_type: "token_preference",
        target: token,
        rule_value: winRate,
        rule_description: `Preference for ${token}: ${stat.wins}/${stat.total_trades} wins (${(winRate * 100).toFixed(0)}%), avg PnL $${stat.avg_pnl.toFixed(0)}${dirNote}`,
        supporting_evidence: `${stat.total_trades} trades over 30d, total PnL $${stat.total_pnl.toFixed(0)}`,
        source_stat_type: "by_token",
        confidence: Math.min(0.9, 0.5 + stat.total_trades * 0.05),
        is_active: true,
        expires_at: expiresAt,
      });
    }
  }

  return rules;
}

function deriveSideRules(agentId: string, stats: PerformanceStat[], expiresAt: string): AdjustmentRow[] {
  const rules: AdjustmentRow[] = [];
  const sideStats = stats.filter((s) => s.stat_type === "by_side");

  const longStat = sideStats.find((s) => s.dimension_value === "long");
  const shortStat = sideStats.find((s) => s.dimension_value === "short");

  if (longStat && shortStat && longStat.total_trades >= MIN_TRADES && shortStat.total_trades >= MIN_TRADES) {
    const longWinRate = longStat.wins / longStat.total_trades;
    const shortWinRate = shortStat.wins / shortStat.total_trades;
    const diff = longWinRate - shortWinRate;

    // Significant directional imbalance (>20% difference)
    if (Math.abs(diff) > 0.20) {
      const weakSide = diff > 0 ? "short" : "long";
      const weakStat = diff > 0 ? shortStat : longStat;
      const weakWinRate = diff > 0 ? shortWinRate : longWinRate;

      rules.push({
        agent_id: agentId,
        adjustment_type: "side_bias",
        target: weakSide,
        rule_value: weakWinRate,
        rule_description: `Weak on ${weakSide}: ${weakStat.wins}/${weakStat.total_trades} wins (${(weakWinRate * 100).toFixed(0)}%) — consider reducing ${weakSide} exposure`,
        supporting_evidence: `Long: ${longStat.wins}/${longStat.total_trades} (${(longWinRate * 100).toFixed(0)}%) vs Short: ${shortStat.wins}/${shortStat.total_trades} (${(shortWinRate * 100).toFixed(0)}%)`,
        source_stat_type: "by_side",
        confidence: Math.min(0.9, 0.5 + (longStat.total_trades + shortStat.total_trades) * 0.03),
        is_active: true,
        expires_at: expiresAt,
      });
    }
  }

  return rules;
}

function deriveCloseReasonRules(agentId: string, stats: PerformanceStat[], expiresAt: string): AdjustmentRow[] {
  const rules: AdjustmentRow[] = [];
  const reasonStats = stats.filter((s) => s.stat_type === "by_close_reason");

  const totalAllReasons = reasonStats.reduce((s, r) => s + r.total_trades, 0);
  if (totalAllReasons < MIN_TRADES) return rules;

  const slStat = reasonStats.find((s) => s.dimension_value === "sl");
  const tpStat = reasonStats.find((s) => s.dimension_value === "tp");

  // SL hit too often → suggest wider SL
  if (slStat && slStat.total_trades / totalAllReasons > SL_HIT_RATE_THRESHOLD) {
    const slRate = slStat.total_trades / totalAllReasons;
    rules.push({
      agent_id: agentId,
      adjustment_type: "sl_adjustment",
      target: "widen",
      rule_value: slRate,
      rule_description: `Stop-loss hit on ${(slRate * 100).toFixed(0)}% of closes (${slStat.total_trades}/${totalAllReasons}) — consider widening SL to avoid premature exits`,
      supporting_evidence: `SL avg PnL: $${slStat.avg_pnl.toFixed(0)}, avg PnL%: ${slStat.avg_pnl_pct.toFixed(1)}%`,
      source_stat_type: "by_close_reason",
      confidence: Math.min(0.85, 0.5 + totalAllReasons * 0.03),
      is_active: true,
      expires_at: expiresAt,
    });
  }

  // TP hit on almost every trade → TP may be too conservative
  if (tpStat && tpStat.total_trades / totalAllReasons > TP_HIT_RATE_THRESHOLD && totalAllReasons >= MIN_TRADES * 2) {
    const tpRate = tpStat.total_trades / totalAllReasons;
    rules.push({
      agent_id: agentId,
      adjustment_type: "tp_adjustment",
      target: "widen",
      rule_value: tpRate,
      rule_description: `Take-profit hit on ${(tpRate * 100).toFixed(0)}% of closes (${tpStat.total_trades}/${totalAllReasons}) — TP may be too conservative, consider wider targets`,
      supporting_evidence: `TP avg PnL: $${tpStat.avg_pnl.toFixed(0)}, avg PnL%: ${tpStat.avg_pnl_pct.toFixed(1)}%`,
      source_stat_type: "by_close_reason",
      confidence: Math.min(0.8, 0.4 + totalAllReasons * 0.03),
      is_active: true,
      expires_at: expiresAt,
    });
  }

  return rules;
}

function deriveDurationRules(agentId: string, stats: PerformanceStat[], expiresAt: string): AdjustmentRow[] {
  const rules: AdjustmentRow[] = [];
  const durationStats = stats.filter((s) => s.stat_type === "by_holding_duration");

  // Find the worst-performing duration bucket
  const significantBuckets = durationStats.filter((s) => s.total_trades >= 3);
  if (significantBuckets.length < 2) return rules;

  const worstBucket = significantBuckets.reduce((worst, current) => {
    const worstWinRate = worst.wins / worst.total_trades;
    const currentWinRate = current.wins / current.total_trades;
    return currentWinRate < worstWinRate ? current : worst;
  });

  const worstWinRate = worstBucket.wins / worstBucket.total_trades;
  if (worstWinRate < 0.35 && worstBucket.total_trades >= MIN_TRADES) {
    rules.push({
      agent_id: agentId,
      adjustment_type: "holding_duration_limit",
      target: worstBucket.dimension_value,
      rule_value: worstWinRate,
      rule_description: `Poor performance on ${worstBucket.dimension_value} holds: ${worstBucket.wins}/${worstBucket.total_trades} wins (${(worstWinRate * 100).toFixed(0)}%) — avoid this holding period`,
      supporting_evidence: `Avg PnL: $${worstBucket.avg_pnl.toFixed(0)}, total PnL: $${worstBucket.total_pnl.toFixed(0)}`,
      source_stat_type: "by_holding_duration",
      confidence: Math.min(0.8, 0.4 + worstBucket.total_trades * 0.05),
      is_active: true,
      expires_at: expiresAt,
    });
  }

  return rules;
}

// ---------- Main ----------

/**
 * Derive strategy adjustments from pre-computed performance stats.
 * Pure rule-based — no LLM calls.
 */
export async function deriveStrategyAdjustments(agentId: string): Promise<number> {
  const supabase = createAdminClient();

  // Fetch current stats
  const { data: stats, error } = await supabase
    .from("agent_performance_stats")
    .select(
      "stat_type, dimension_value, total_trades, wins, losses, total_pnl, avg_pnl, avg_pnl_pct, avg_holding_hours, bullish_trades, bullish_wins, bearish_trades, bearish_wins"
    )
    .eq("agent_id", agentId);

  if (error) {
    console.error(`[strategy-adj] Failed to fetch stats for ${agentId}: ${error.message}`);
    return 0;
  }

  if (!stats || stats.length === 0) return 0;

  const typedStats: PerformanceStat[] = stats.map((s) => ({
    stat_type: s.stat_type as string,
    dimension_value: s.dimension_value as string,
    total_trades: Number(s.total_trades),
    wins: Number(s.wins),
    losses: Number(s.losses),
    total_pnl: Number(s.total_pnl),
    avg_pnl: Number(s.avg_pnl),
    avg_pnl_pct: Number(s.avg_pnl_pct),
    avg_holding_hours: s.avg_holding_hours !== null ? Number(s.avg_holding_hours) : null,
    bullish_trades: Number(s.bullish_trades ?? 0),
    bullish_wins: Number(s.bullish_wins ?? 0),
    bearish_trades: Number(s.bearish_trades ?? 0),
    bearish_wins: Number(s.bearish_wins ?? 0),
  }));

  const expiresAt = new Date(Date.now() + RULE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Derive rules from each dimension
  const allRules: AdjustmentRow[] = [
    ...deriveTokenRules(agentId, typedStats, expiresAt),
    ...deriveSideRules(agentId, typedStats, expiresAt),
    ...deriveCloseReasonRules(agentId, typedStats, expiresAt),
    ...deriveDurationRules(agentId, typedStats, expiresAt),
  ];

  if (allRules.length === 0) {
    // No rules derived — expire all existing
    await supabase
      .from("agent_strategy_adjustments")
      .update({ is_active: false })
      .eq("agent_id", agentId)
      .eq("is_active", true);
    return 0;
  }

  // Deactivate old rules, then upsert new ones
  await supabase
    .from("agent_strategy_adjustments")
    .update({ is_active: false })
    .eq("agent_id", agentId)
    .eq("is_active", true);

  const { error: insertError } = await supabase
    .from("agent_strategy_adjustments")
    .upsert(
      allRules.map((r) => ({
        agent_id: r.agent_id,
        adjustment_type: r.adjustment_type,
        target: r.target,
        rule_value: r.rule_value,
        rule_description: r.rule_description,
        supporting_evidence: r.supporting_evidence,
        source_stat_type: r.source_stat_type,
        confidence: r.confidence,
        is_active: true,
        expires_at: r.expires_at,
      })),
      { onConflict: "agent_id,adjustment_type,target" },
    );

  if (insertError) {
    console.error(`[strategy-adj] Failed to upsert adjustments for ${agentId}: ${insertError.message}`);
    return 0;
  }

  // Expire stale rules past their expiry date
  await supabase
    .from("agent_strategy_adjustments")
    .update({ is_active: false })
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .lt("expires_at", new Date().toISOString());

  console.log(`[strategy-adj] Derived ${allRules.length} rules for agent ${agentId}`);
  return allRules.length;
}
