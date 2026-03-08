// ============================================================
// Portfolio & Accuracy Snapshot Queries
// ============================================================

import { createReadOnlyClient } from "../server";
import type { PortfolioSnapshot, AccuracySnapshot } from "@/lib/types";

export async function fetchPortfolioSnapshots(
  agentId: string,
  days = 30
): Promise<PortfolioSnapshot[]> {
  const supabase = createReadOnlyClient();
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, portfolio_value, accuracy_score")
    .eq("agent_id", agentId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.error("fetchPortfolioSnapshots error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    date: row.snapshot_date as string,
    value: Number(row.portfolio_value),
  }));
}

export async function fetchAccuracySnapshots(
  agentId: string,
  days = 30
): Promise<AccuracySnapshot[]> {
  const supabase = createReadOnlyClient();
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, accuracy_score")
    .eq("agent_id", agentId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.error("fetchAccuracySnapshots error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    date: row.snapshot_date as string,
    accuracy: Number(row.accuracy_score),
  }));
}
