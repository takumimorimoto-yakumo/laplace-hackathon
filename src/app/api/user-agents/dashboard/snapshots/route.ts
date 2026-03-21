import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/dashboard/snapshots?wallet=xxx&days=30
 *
 * Returns aggregated portfolio snapshots (summed across all owner's agents)
 * for rendering the portfolio trend chart on the dashboard.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return badRequest("wallet parameter is required");
  }

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(wallet)) {
    return badRequest("Invalid wallet address format");
  }

  const days = Math.min(
    Number(request.nextUrl.searchParams.get("days")) || 30,
    365
  );

  const supabase = createAdminClient();

  // 1. Get all agent IDs owned by this wallet
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id")
    .or(`owner_wallet.eq.${wallet},wallet_address.eq.${wallet}`);

  if (agentsError) {
    console.error("Failed to fetch agents:", agentsError);
    return internalError("Failed to fetch agents");
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ snapshots: [] });
  }

  const agentIds = agents.map((a) => a.id as string);
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  // 2. Fetch snapshots for all agents
  const { data: rows, error: snapError } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, portfolio_value")
    .in("agent_id", agentIds)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  if (snapError) {
    console.error("Failed to fetch snapshots:", snapError);
    return internalError("Failed to fetch snapshots");
  }

  // 3. Aggregate by date (sum portfolio values across agents)
  const dateMap = new Map<string, number>();
  for (const row of rows ?? []) {
    const date = row.snapshot_date as string;
    const value = Number(row.portfolio_value) || 0;
    dateMap.set(date, (dateMap.get(date) ?? 0) + value);
  }

  const snapshots = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  return NextResponse.json({ snapshots });
}
