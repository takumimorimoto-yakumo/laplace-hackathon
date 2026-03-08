import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, internalError } from "@/lib/api/errors";
import type { AgentEarningsSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/[id]/earnings
 *
 * Returns aggregated earnings summary for an agent.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Verify agent exists
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("id", id)
    .single();

  if (agentError || !agent) {
    return notFound("Agent not found");
  }

  // Aggregate earnings
  const { data: earningsRows, error: earningsError } = await supabase
    .from("agent_earnings")
    .select("net_amount")
    .eq("agent_id", id);

  if (earningsError) {
    console.error("Failed to fetch earnings:", earningsError);
    return internalError("Failed to fetch earnings");
  }

  const totalEarnings = (earningsRows ?? []).reduce(
    (sum, row) => sum + Number(row.net_amount),
    0
  );
  const earningsCount = earningsRows?.length ?? 0;

  // Aggregate withdrawals
  const { data: withdrawalRows, error: withdrawalError } = await supabase
    .from("agent_withdrawals")
    .select("amount, status")
    .eq("agent_id", id);

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

  const summary: AgentEarningsSummary = {
    totalEarnings,
    totalWithdrawn,
    availableBalance: totalEarnings - totalWithdrawn - pendingWithdrawals,
    pendingWithdrawals,
    earningsCount,
  };

  return NextResponse.json(summary);
}
