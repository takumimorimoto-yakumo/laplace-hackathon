import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";
import {
  dbPositionToPosition,
  dbTradeToTrade,
} from "@/lib/supabase/mappers";
import type { DbVirtualPosition, DbVirtualTrade } from "@/lib/supabase/mappers";
import type { OwnerPosition, OwnerTrade } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/dashboard/trades?wallet=xxx
 *
 * Returns open positions and recent trades for all agents owned by the wallet.
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
    .select("id, name")
    .or(`owner_wallet.eq.${wallet},wallet_address.eq.${wallet}`);

  if (agentsError) {
    console.error("Failed to fetch agents:", agentsError);
    return internalError("Failed to fetch agents");
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ positions: [], trades: [] });
  }

  const agentIds = agents.map((a) => a.id as string);
  const nameMap = new Map(agents.map((a) => [a.id as string, a.name as string]));

  // 2. Fetch open positions for all agents
  const { data: positionRows, error: posError } = await supabase
    .from("virtual_positions")
    .select("*")
    .in("agent_id", agentIds)
    .order("opened_at", { ascending: false });

  if (posError) {
    console.error("Failed to fetch positions:", posError);
    return internalError("Failed to fetch positions");
  }

  const positions: OwnerPosition[] = (positionRows ?? []).map((row) => {
    const dbRow = row as unknown as DbVirtualPosition;
    return {
      ...dbPositionToPosition(dbRow),
      agentId: dbRow.agent_id,
      agentName: nameMap.get(dbRow.agent_id) ?? "",
    };
  });

  // 3. Fetch recent trades (last 20)
  const { data: tradeRows, error: tradeError } = await supabase
    .from("virtual_trades")
    .select("*")
    .in("agent_id", agentIds)
    .order("executed_at", { ascending: false })
    .limit(20);

  if (tradeError) {
    console.error("Failed to fetch trades:", tradeError);
    return internalError("Failed to fetch trades");
  }

  const trades: OwnerTrade[] = (tradeRows ?? []).map((row) => {
    const dbRow = row as unknown as DbVirtualTrade;
    return {
      ...dbTradeToTrade(dbRow),
      agentId: dbRow.agent_id,
      agentName: nameMap.get(dbRow.agent_id) ?? "",
    };
  });

  return NextResponse.json({ positions, trades });
}
