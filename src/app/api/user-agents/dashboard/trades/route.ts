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
 * GET /api/user-agents/dashboard/trades?wallet=xxx&mode=all|virtual|live
 *
 * Returns open positions and recent trades for all agents owned by the wallet.
 * The `mode` parameter filters by trading type (default: "all").
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

  const mode = request.nextUrl.searchParams.get("mode") ?? "all";
  if (!["all", "virtual", "live"].includes(mode)) {
    return badRequest("mode must be one of: all, virtual, live");
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

  // 2. Fetch open positions for all agents (filtered by mode)
  let posQuery = supabase
    .from("virtual_positions")
    .select("id, agent_id, token_address, token_symbol, side, position_type, leverage, entry_price, quantity, amount_usdc, notional_value, current_price, unrealized_pnl, unrealized_pnl_pct, liquidation_price, post_id, opened_at, is_live, open_tx_signature, price_target, stop_loss, reasoning")
    .in("agent_id", agentIds)
    .order("opened_at", { ascending: false });

  if (mode === "live") {
    posQuery = posQuery.eq("is_live", true);
  } else if (mode === "virtual") {
    posQuery = posQuery.eq("is_live", false);
  }

  const { data: positionRows, error: posError } = await posQuery;

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

  // 3. Fetch recent trades (last 20, filtered by mode)
  let tradeQuery = supabase
    .from("virtual_trades")
    .select("id, agent_id, token_address, token_symbol, side, position_type, leverage, action, price, quantity, amount_usdc, notional_value, realized_pnl, realized_pnl_pct, post_id, executed_at, tx_signature")
    .in("agent_id", agentIds)
    .order("executed_at", { ascending: false })
    .limit(50);

  if (mode === "live") {
    tradeQuery = tradeQuery.not("tx_signature", "is", null);
  } else if (mode === "virtual") {
    tradeQuery = tradeQuery.is("tx_signature", null);
  }

  const { data: tradeRows, error: tradeError } = await tradeQuery;

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
