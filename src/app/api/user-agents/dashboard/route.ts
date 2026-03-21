import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";
import type { OwnerDashboardSummary, AgentBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/dashboard?wallet=xxx
 *
 * Returns aggregated dashboard summary for an owner's agents,
 * with separate virtual (simulation) and live trading stats.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return badRequest("wallet parameter is required");
  }

  // Validate wallet format (base58, 32-44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(wallet)) {
    return badRequest("Invalid wallet address format");
  }

  const supabase = createAdminClient();

  // 1. Get all agents owned by this wallet
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, portfolio_value, portfolio_return, return_24h, return_7d, return_30d, live_trading_enabled")
    .or(`owner_wallet.eq.${wallet},wallet_address.eq.${wallet}`);

  if (agentsError) {
    console.error("Failed to fetch agents:", agentsError);
    return internalError("Failed to fetch agents");
  }

  if (!agents || agents.length === 0) {
    const empty: OwnerDashboardSummary = {
      totalPortfolioValue: 0,
      averageReturn: 0,
      averageReturn24h: 0,
      averageReturn7d: 0,
      averageReturn30d: 0,
      totalPnl: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalEarnings: 0,
      totalWithdrawn: 0,
      availableBalance: 0,
      pendingWithdrawals: 0,
      activeRentersCount: 0,
      agentBreakdown: [],
      livePortfolioValue: 0,
      liveReturn: 0,
      livePnl: 0,
    };
    return NextResponse.json(empty);
  }

  const agentIds = agents.map((a) => a.id as string);

  // 2. Aggregate portfolio data (virtual — from agents table)
  const initialBalance = 10000; // Zero-start policy: each agent starts with $10,000
  let totalPortfolioValue = 0;
  let totalReturn = 0;
  let totalReturn24h = 0;
  let totalReturn7d = 0;
  let totalReturn30d = 0;
  for (const a of agents) {
    totalPortfolioValue += Number(a.portfolio_value) || 0;
    totalReturn += Number(a.portfolio_return) || 0;
    totalReturn24h += Number(a.return_24h) || 0;
    totalReturn7d += Number(a.return_7d) || 0;
    totalReturn30d += Number(a.return_30d) || 0;
  }
  const n = agents.length || 1;
  const averageReturn = totalReturn / n;
  const averageReturn24h = totalReturn24h / n;
  const averageReturn7d = totalReturn7d / n;
  const averageReturn30d = totalReturn30d / n;

  // 2b. Fetch unrealized PnL from all open positions
  const { data: allOpenPositions, error: openPosError } = await supabase
    .from("virtual_positions")
    .select("unrealized_pnl")
    .in("agent_id", agentIds);

  if (openPosError) {
    console.error("Failed to fetch open positions:", openPosError);
    return internalError("Failed to fetch open positions");
  }

  let unrealizedPnl = 0;
  for (const pos of allOpenPositions ?? []) {
    unrealizedPnl += Number(pos.unrealized_pnl) || 0;
  }

  // totalPnl derived from portfolio value (source of truth)
  // realizedPnl = totalPnl - unrealizedPnl (ensures breakdown always sums to total)
  const totalPnl = totalPortfolioValue - initialBalance * agents.length;
  const realizedPnl = totalPnl - unrealizedPnl;

  // 3. Compute live-only portfolio stats from virtual_positions
  const { data: livePositions, error: livePosError } = await supabase
    .from("virtual_positions")
    .select("amount_usdc, unrealized_pnl")
    .in("agent_id", agentIds)
    .eq("is_live", true);

  if (livePosError) {
    console.error("Failed to fetch live positions:", livePosError);
    return internalError("Failed to fetch live positions");
  }

  let livePortfolioValue = 0;
  let livePnl = 0;
  for (const pos of livePositions ?? []) {
    const size = Number(pos.amount_usdc) || 0;
    const pnl = Number(pos.unrealized_pnl) || 0;
    livePortfolioValue += size + pnl;
    livePnl += pnl;
  }
  const liveReturn = livePortfolioValue > 0 ? livePnl / (livePortfolioValue - livePnl) : 0;

  // 4. Aggregate earnings per agent
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

  // 5. Aggregate withdrawals
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

  // 6. Count active renters per agent
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

  // 7. Build agent breakdown
  const agentBreakdown: AgentBreakdown[] = agents.map((a) => ({
    agentId: a.id as string,
    agentName: a.name as string,
    portfolioValue: Number(a.portfolio_value) || 0,
    portfolioReturn: Number(a.portfolio_return) || 0,
    earnings: earningsMap.get(a.id as string) ?? 0,
    rentersCount: rentersMap.get(a.id as string) ?? 0,
    isLive: (a.live_trading_enabled as boolean) ?? false,
  }));

  const summary: OwnerDashboardSummary = {
    totalPortfolioValue,
    averageReturn,
    averageReturn24h,
    averageReturn7d,
    averageReturn30d,
    totalPnl,
    realizedPnl,
    unrealizedPnl,
    totalEarnings,
    totalWithdrawn,
    availableBalance: totalEarnings - totalWithdrawn - pendingWithdrawals,
    pendingWithdrawals,
    activeRentersCount,
    agentBreakdown,
    livePortfolioValue,
    liveReturn,
    livePnl,
  };

  return NextResponse.json(summary);
}
