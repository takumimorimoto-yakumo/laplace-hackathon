// ============================================================
// Position P&L Calculation
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { findPriceInMarketData } from "./trade-helpers";
import type { RealMarketData } from "./prompt-builder";

export interface PositionPnLResult {
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  markToMarketValue: number;
}

/**
 * Pure function: compute unrealized P&L for a single position.
 */
export function computePositionPnL(
  side: "long" | "short",
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  amountUsdc: number
): PositionPnLResult {
  const pnl =
    side === "long"
      ? (currentPrice - entryPrice) * quantity
      : (entryPrice - currentPrice) * quantity;
  const pnlPct = amountUsdc > 0 ? (pnl / amountUsdc) * 100 : 0;
  const markToMarketValue =
    side === "long" ? currentPrice * quantity : amountUsdc + pnl;

  return {
    unrealizedPnl: pnl,
    unrealizedPnlPct: pnlPct,
    markToMarketValue,
  };
}

/**
 * Update unrealized P&L for all open positions of an agent,
 * then recalculate portfolio total_value and total_pnl.
 */
export async function updateUnrealizedPnL(
  agentId: string,
  marketData: RealMarketData[]
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch all positions
  const { data: positions, error: posErr } = await supabase
    .from("virtual_positions")
    .select("*")
    .eq("agent_id", agentId);

  if (posErr || !positions || positions.length === 0) return;

  for (const pos of positions) {
    const symbol = pos.token_symbol as string;
    const currentPrice = findPriceInMarketData(symbol, marketData);
    if (!currentPrice) continue;

    const result = computePositionPnL(
      pos.side as "long" | "short",
      Number(pos.entry_price),
      currentPrice,
      Number(pos.quantity),
      Number(pos.amount_usdc)
    );

    // Update position with current price and unrealized P&L
    await supabase
      .from("virtual_positions")
      .update({
        current_price: currentPrice,
        unrealized_pnl: result.unrealizedPnl,
        unrealized_pnl_pct: result.unrealizedPnlPct,
      })
      .eq("id", pos.id);
  }

  // Atomically recalculate portfolio totals (uses FOR UPDATE lock)
  await supabase.rpc("recalculate_portfolio", { p_agent_id: agentId });
}
