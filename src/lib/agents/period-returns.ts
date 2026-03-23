// ============================================================
// Period Returns — Compute 24h / 7d / 30d returns from snapshots
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

export interface PeriodReturns {
  return24h: number;
  return7d: number;
  return30d: number;
}

/**
 * Compute period-based returns for all agents.
 * Uses portfolio_snapshots (daily) for 24h / 7d / 30d returns.
 * Return = (currentValue - pastValue) / pastValue
 * If no snapshot exists for a period, return is 0.
 */
export async function computeAllPeriodReturns(): Promise<
  Map<string, PeriodReturns>
> {
  const result = new Map<string, PeriodReturns>();
  const supabase = createAdminClient();

  // Fetch current portfolio values
  const { data: portfolios, error: pErr } = await supabase
    .from("virtual_portfolios")
    .select("agent_id, total_value");

  if (pErr || !portfolios) {
    console.warn("[period-returns] Failed to fetch portfolios:", pErr?.message);
    return result;
  }

  const currentValues = new Map<string, number>();
  for (const p of portfolios) {
    currentValues.set(p.agent_id as string, Number(p.total_value));
  }

  const now = new Date();

  // --- Daily returns: 24h / 7d / 30d from portfolio_snapshots ---
  const targetDates = {
    d1: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    d7: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    d30: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  };

  // Fetch snapshots from the last 30 days (covers all daily periods)
  const { data: snapshots, error: sErr } = await supabase
    .from("portfolio_snapshots")
    .select("agent_id, snapshot_date, portfolio_value")
    .gte("snapshot_date", targetDates.d30)
    .order("snapshot_date", { ascending: false });

  if (sErr || !snapshots) {
    console.warn("[period-returns] Failed to fetch snapshots:", sErr?.message);
    return result;
  }

  // Group daily snapshots by agent, sorted descending by date (already from query)
  const snapshotsByAgent = new Map<
    string,
    { date: string; value: number }[]
  >();
  for (const s of snapshots) {
    const agentId = s.agent_id as string;
    const list = snapshotsByAgent.get(agentId) ?? [];
    list.push({
      date: s.snapshot_date as string,
      value: Number(s.portfolio_value),
    });
    snapshotsByAgent.set(agentId, list);
  }

  // For each agent, compute all period returns
  for (const [agentId, currentValue] of currentValues) {
    const agentSnapshots = snapshotsByAgent.get(agentId) ?? [];

    const return24h = computePeriodReturn(
      currentValue,
      agentSnapshots,
      targetDates.d1
    );
    const return7d = computePeriodReturn(
      currentValue,
      agentSnapshots,
      targetDates.d7
    );
    const return30d = computePeriodReturn(
      currentValue,
      agentSnapshots,
      targetDates.d30
    );

    result.set(agentId, { return24h, return7d, return30d });
  }

  return result;
}

/**
 * Compute return for a single daily period.
 * Finds the closest snapshot on or before targetDate.
 * Snapshots must be sorted descending by date.
 */
function computePeriodReturn(
  currentValue: number,
  snapshots: { date: string; value: number }[],
  targetDate: string
): number {
  let pastValue: number | null = null;

  for (const s of snapshots) {
    if (s.date <= targetDate) {
      pastValue = s.value;
      break;
    }
  }

  if (pastValue === null || pastValue === 0) return 0;

  return (currentValue - pastValue) / pastValue;
}
