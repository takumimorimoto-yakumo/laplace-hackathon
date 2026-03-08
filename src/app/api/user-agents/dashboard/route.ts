import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";
import type { OwnerDashboardSummary, AgentBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/dashboard?wallet=xxx
 *
 * Returns aggregated dashboard summary for an owner's agents.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return badRequest("wallet parameter is required");
  }

  const supabase = createAdminClient();

  // 1. Get all agents owned by this wallet
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, portfolio_value, portfolio_return")
    .or(`owner_wallet.eq.${wallet},wallet_address.eq.${wallet}`);

  if (agentsError) {
    console.error("Failed to fetch agents:", agentsError);
    return internalError("Failed to fetch agents");
  }

  if (!agents || agents.length === 0) {
    const empty: OwnerDashboardSummary = {
      totalPortfolioValue: 0,
      averageReturn: 0,
      totalPnl: 0,
      totalEarnings: 0,
      totalWithdrawn: 0,
      availableBalance: 0,
      pendingWithdrawals: 0,
      activeRentersCount: 0,
      agentBreakdown: [],
    };
    return NextResponse.json(empty);
  }

  const agentIds = agents.map((a) => a.id as string);

  // 2. Aggregate portfolio data
  const initialBalance = 10000; // Zero-start policy: each agent starts with $10,000
  let totalPortfolioValue = 0;
  let totalReturn = 0;
  let totalPnl = 0;
  for (const a of agents) {
    const pv = Number(a.portfolio_value) || 0;
    totalPortfolioValue += pv;
    totalReturn += Number(a.portfolio_return) || 0;
    totalPnl += pv - initialBalance;
  }
  const averageReturn = agents.length > 0 ? totalReturn / agents.length : 0;

  // 3. Aggregate earnings per agent
  const { data: earningsRows, error: earningsError } = await supabase
    .from("agent_earnings")
    .select("agent_id, net_amount")
    .in("agent_id", agentIds);

  if (earningsError) {
    console.error("Failed to fetch earnings:", earningsError);
    return internalError("Failed to fetch earnings");
  }

  const earningsMap = new Map<string, number>();
  for (const row of earningsRows ?? []) {
    const agentId = row.agent_id as string;
    earningsMap.set(agentId, (earningsMap.get(agentId) ?? 0) + Number(row.net_amount));
  }

  // 4. Aggregate withdrawals
  const { data: withdrawalRows, error: withdrawalError } = await supabase
    .from("agent_withdrawals")
    .select("agent_id, amount, status")
    .in("agent_id", agentIds);

  if (withdrawalError) {
    console.error("Failed to fetch withdrawals:", withdrawalError);
    return internalError("Failed to fetch withdrawals");
  }

  let totalWithdrawn = 0;
  let pendingWithdrawals = 0;
  for (const row of withdrawalRows ?? []) {
    const amt = Number(row.amount);
    if (row.status === "completed") {
      totalWithdrawn += amt;
    } else if (row.status === "pending" || row.status === "processing") {
      pendingWithdrawals += amt;
    }
  }

  const totalEarnings = Array.from(earningsMap.values()).reduce((sum, v) => sum + v, 0);

  // 5. Count active renters per agent
  const { data: rentalRows, error: rentalError } = await supabase
    .from("agent_rentals")
    .select("agent_id")
    .in("agent_id", agentIds)
    .eq("is_active", true)
    .gte("expires_at", new Date().toISOString());

  if (rentalError) {
    console.error("Failed to fetch rentals:", rentalError);
    return internalError("Failed to fetch rentals");
  }

  const rentersMap = new Map<string, number>();
  for (const row of rentalRows ?? []) {
    const agentId = row.agent_id as string;
    rentersMap.set(agentId, (rentersMap.get(agentId) ?? 0) + 1);
  }

  const activeRentersCount = (rentalRows ?? []).length;

  // 6. Build agent breakdown
  const agentBreakdown: AgentBreakdown[] = agents.map((a) => ({
    agentId: a.id as string,
    agentName: a.name as string,
    portfolioValue: Number(a.portfolio_value) || 0,
    portfolioReturn: Number(a.portfolio_return) || 0,
    earnings: earningsMap.get(a.id as string) ?? 0,
    rentersCount: rentersMap.get(a.id as string) ?? 0,
  }));

  const summary: OwnerDashboardSummary = {
    totalPortfolioValue,
    averageReturn,
    totalPnl,
    totalEarnings,
    totalWithdrawn,
    availableBalance: totalEarnings - totalWithdrawn - pendingWithdrawals,
    pendingWithdrawals,
    activeRentersCount,
    agentBreakdown,
  };

  return NextResponse.json(summary);
}
