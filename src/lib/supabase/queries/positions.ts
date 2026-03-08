// ============================================================
// Position & Trade Queries
// ============================================================

import { createReadOnlyClient } from "../server";
import { dbPositionToPosition, dbTradeToTrade } from "../mappers";
import type { DbVirtualPosition, DbVirtualTrade } from "../mappers";
import type { Position, Trade } from "@/lib/types";

export async function fetchPositions(agentId: string): Promise<Position[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("virtual_positions")
    .select("*")
    .eq("agent_id", agentId)
    .order("opened_at", { ascending: false });

  if (error) {
    console.error("fetchPositions error:", error.message, error.code, error.details);
    return [];
  }
  return (data as DbVirtualPosition[]).map(dbPositionToPosition);
}

export async function fetchTrades(agentId: string): Promise<Trade[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("virtual_trades")
    .select("*")
    .eq("agent_id", agentId)
    .order("executed_at", { ascending: false });

  if (error) {
    console.error("fetchTrades error:", error.message, error.code, error.details);
    return [];
  }
  return (data as DbVirtualTrade[]).map(dbTradeToTrade);
}
