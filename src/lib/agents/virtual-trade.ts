// ============================================================
// 4. Virtual Trade Generation
// 5. Close Expired Positions
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { RealMarketData } from "./prompt-builder";
import type { AgentPostOutput } from "./response-schema";
import { fetchMarketContext } from "./market-context";
import { recordPortfolioSnapshot } from "./portfolio-snapshot";
import { executeLiveOpen, executeLiveClose } from "./live-trade";
import {
  DEFAULT_INITIAL_BALANCE,
  POSITION_EXPIRY_DAYS,
  getOrCreatePortfolio,
  findPriceInMarketData,
} from "./trade-helpers";
import { positionExpiryMs } from "./time-horizon";

// Re-export constants for backwards compatibility
export { DEFAULT_INITIAL_BALANCE, POSITION_EXPIRY_DAYS };

/**
 * Open a virtual position based on a successful prediction post.
 * Maps direction to side (bullish -> long, bearish -> short, neutral -> skip).
 * Calculates position size based on confidence and portfolio value.
 */
export async function runVirtualTrade(
  agentId: string,
  postId: string,
  output: AgentPostOutput,
  existingMarketData?: RealMarketData[]
): Promise<void> {
  // Skip neutral predictions
  if (output.direction === "neutral") {
    console.log(`[runner] Skipping virtual trade for neutral prediction`);
    return;
  }

  if (!output.token_symbol || !output.token_address) {
    console.log(`[runner] Skipping virtual trade: no token info`);
    return;
  }

  const supabase = createAdminClient();
  const side = output.direction === "bullish" ? "long" : "short";

  try {
    // 1. Check if agent already has a position in this token (same side)
    const { data: existingPos } = await supabase
      .from("virtual_positions")
      .select("id")
      .eq("agent_id", agentId)
      .eq("token_address", output.token_address)
      .eq("side", side)
      .eq("position_type", "spot")
      .limit(1);

    if (existingPos && existingPos.length > 0) {
      console.log(
        `[runner] Agent ${agentId} already has a ${side} position in ${output.token_symbol}, skipping`
      );
      return;
    }

    // 2. Fetch or initialize portfolio
    const portfolio = await getOrCreatePortfolio(agentId);

    // 3. Look up current price from market context (reuse if provided)
    const tradeMarketData = existingMarketData ?? await fetchMarketContext();
    const currentPrice = findPriceInMarketData(output.token_symbol ?? "", tradeMarketData);
    const price = currentPrice ?? 0;

    if (price <= 0) {
      console.log(
        `[runner] Cannot determine price for ${output.token_symbol}, skipping trade`
      );
      return;
    }

    // 4. Calculate position size using AI-decided allocation
    const amountUsdc = Math.min(
      portfolio.cash_balance,
      portfolio.total_value * output.allocation_pct
    );

    if (amountUsdc < 1) {
      console.log(
        `[runner] Insufficient cash for trade (${portfolio.cash_balance} USDC)`
      );
      return;
    }

    const quantity = amountUsdc / price;
    const now = new Date().toISOString();

    // 5. Ensure TP/SL are set — fallback to defaults if LLM omitted them
    const DEFAULT_TP_PCT = 0.10; // +10%
    const DEFAULT_SL_PCT = 0.05; // -5%
    const priceTarget =
      output.price_target ??
      (side === "long" ? price * (1 + DEFAULT_TP_PCT) : price * (1 - DEFAULT_TP_PCT));
    const stopLoss =
      output.stop_loss ??
      (side === "long" ? price * (1 - DEFAULT_SL_PCT) : price * (1 + DEFAULT_SL_PCT));

    // 6. Insert into virtual_positions
    const { data: posData, error: posError } = await supabase
      .from("virtual_positions")
      .insert({
        agent_id: agentId,
        token_address: output.token_address,
        token_symbol: output.token_symbol,
        side,
        position_type: "spot",
        leverage: 1,
        entry_price: price,
        quantity,
        amount_usdc: amountUsdc,
        current_price: price,
        unrealized_pnl: 0,
        unrealized_pnl_pct: 0,
        post_id: postId,
        opened_at: now,
        price_target: priceTarget,
        stop_loss: stopLoss,
        reasoning: output.reasoning || null,
      })
      .select("id")
      .single();

    if (posError) {
      throw new Error(`Failed to insert position: ${posError.message}`);
    }

    // 6. Insert into virtual_trades
    const { error: tradeError } = await supabase
      .from("virtual_trades")
      .insert({
        agent_id: agentId,
        token_address: output.token_address,
        token_symbol: output.token_symbol,
        side,
        position_type: "spot",
        leverage: 1,
        action: "open",
        price,
        quantity,
        amount_usdc: amountUsdc,
        realized_pnl: null,
        post_id: postId,
        executed_at: now,
      });

    if (tradeError) {
      throw new Error(`Failed to insert trade: ${tradeError.message}`);
    }

    // 7. Update virtual_portfolios (reduce cash_balance)
    const { error: portfolioError } = await supabase
      .from("virtual_portfolios")
      .update({
        cash_balance: portfolio.cash_balance - amountUsdc,
      })
      .eq("agent_id", agentId);

    if (portfolioError) {
      throw new Error(
        `Failed to update portfolio: ${portfolioError.message}`
      );
    }

    // 8. Record portfolio snapshot after trade
    await recordPortfolioSnapshot(agentId);

    console.log(
      `[runner] Virtual trade: ${side} ${output.token_symbol} $${amountUsdc.toFixed(2)} @ $${price.toFixed(4)} for agent ${agentId}`
    );

    // 9. Live trade (best-effort): only long positions for live-enabled agents
    if (side === "long" && output.token_address && posData?.id) {
      try {
        const { data: agentRow } = await supabase
          .from("agents")
          .select("live_trading_enabled, owner_wallet")
          .eq("id", agentId)
          .single();

        // Live trading requires: enabled flag + owner exists (no unowned agents trading live)
        if (agentRow?.live_trading_enabled && agentRow.owner_wallet) {
          await executeLiveOpen({
            agentId,
            positionId: posData.id as string,
            tokenAddress: output.token_address,
            amountUsdc,
          });
        }
      } catch (liveErr: unknown) {
        const liveMsg = liveErr instanceof Error ? liveErr.message : String(liveErr);
        console.warn(`[runner] Live open failed (best-effort): ${liveMsg}`);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] Virtual trade failed: ${message}`);
  }
}

// ============================================================
// 4b. Close Positions by TP/SL
// ============================================================

/**
 * Check whether a position's TP or SL has been hit based on current price
 * AND historical sparkline data. This catches TP/SL crossings that happened
 * between cron runs (e.g. price spiked past TP and came back down).
 *
 * - Long: TP hit when any price >= priceTarget; SL hit when any price <= stopLoss
 * - Short: TP hit when any price <= priceTarget; SL hit when any price >= stopLoss
 *
 * We also check the sparkline (hourly prices for the last 7 days) to detect
 * crossings that the cron missed. Only sparkline points AFTER the position was
 * opened are considered.
 */
function isTpSlHit(
  side: string,
  currentPrice: number,
  priceTarget: number | null,
  stopLoss: number | null,
  sparkline?: number[],
  openedAt?: string
): "tp" | "sl" | null {
  // First check current price (fast path)
  if (side === "long") {
    if (stopLoss && currentPrice <= stopLoss) return "sl";
    if (priceTarget && currentPrice >= priceTarget) return "tp";
  } else {
    if (stopLoss && currentPrice >= stopLoss) return "sl";
    if (priceTarget && currentPrice <= priceTarget) return "tp";
  }

  // Check sparkline for historical crossings the cron missed
  if (sparkline && sparkline.length > 0) {
    // Sparkline is 7d hourly (~168 points). If we know when the position
    // was opened, only check prices after that point.
    let relevantPrices = sparkline;
    if (openedAt) {
      const openedMs = new Date(openedAt).getTime();
      const nowMs = Date.now();
      const sparklineStartMs = nowMs - sparkline.length * 3600_000; // hourly interval
      const openedIndex = Math.max(
        0,
        Math.floor((openedMs - sparklineStartMs) / 3600_000)
      );
      relevantPrices = sparkline.slice(openedIndex);
    }

    for (const price of relevantPrices) {
      if (side === "long") {
        if (stopLoss && price <= stopLoss) return "sl";
        if (priceTarget && price >= priceTarget) return "tp";
      } else {
        if (stopLoss && price >= stopLoss) return "sl";
        if (priceTarget && price <= priceTarget) return "tp";
      }
    }
  }

  return null;
}

/**
 * Find a token's full market data entry by symbol (case-insensitive).
 */
function findMarketDataEntry(
  symbol: string,
  data: RealMarketData[]
): RealMarketData | null {
  const upper = symbol.toUpperCase();
  return data.find((d) => d.symbol.toUpperCase() === upper) ?? null;
}

/**
 * Close positions that have hit their take-profit or stop-loss levels.
 * Called every agent cron cycle after updating unrealized P&L.
 */
export async function closePositionsByTpSl(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<number> {
  const supabase = createAdminClient();

  try {
    // Fetch positions with TP or SL set
    const { data: positions, error: fetchError } = await supabase
      .from("virtual_positions")
      .select("*")
      .eq("agent_id", agentId)
      .or("price_target.not.is.null,stop_loss.not.is.null");

    if (fetchError || !positions || positions.length === 0) return 0;

    const marketData = existingMarketData ?? await fetchMarketContext();
    const portfolio = await getOrCreatePortfolio(agentId);
    let cashBalanceChange = 0;
    let totalRealizedPnl = 0;
    let closedCount = 0;

    for (const pos of positions) {
      const tokenSymbol = pos.token_symbol as string;
      const marketEntry = findMarketDataEntry(tokenSymbol, marketData);
      const currentPrice = marketEntry?.price ?? null;
      if (!currentPrice) continue;

      const side = pos.side as string;
      const priceTarget = pos.price_target ? Number(pos.price_target) : null;
      const stopLoss = pos.stop_loss ? Number(pos.stop_loss) : null;

      const trigger = isTpSlHit(
        side,
        currentPrice,
        priceTarget,
        stopLoss,
        marketEntry?.sparkline7d,
        pos.opened_at as string | undefined
      );
      if (!trigger) continue;

      const entryPrice = Number(pos.entry_price);
      const quantity = Number(pos.quantity);
      const amountUsdc = Number(pos.amount_usdc);

      // Use the TP/SL target price for execution when the trigger was detected
      // via sparkline (price may have already moved past the target).
      // TP → fill at target price (limit order simulation)
      // SL → fill at SL price (stop order simulation; in reality slippage occurs
      //       but using SL price is fairer than using the current price which may
      //       have bounced back)
      const executionPrice =
        trigger === "tp" && priceTarget
          ? priceTarget
          : trigger === "sl" && stopLoss
            ? stopLoss
            : currentPrice;

      // Calculate realized P&L at execution price
      const realizedPnl =
        side === "long"
          ? (executionPrice - entryPrice) * quantity
          : (entryPrice - executionPrice) * quantity;
      const realizedPnlPct =
        amountUsdc > 0 ? (realizedPnl / amountUsdc) * 100 : 0;
      const now = new Date().toISOString();

      // Insert close trade (use executionPrice, not currentPrice)
      const { data: tradeData, error: tradeError } = await supabase
        .from("virtual_trades")
        .insert({
          agent_id: agentId,
          token_address: pos.token_address,
          token_symbol: pos.token_symbol,
          side,
          position_type: pos.position_type,
          leverage: pos.leverage,
          action: "close",
          price: executionPrice,
          quantity,
          amount_usdc: amountUsdc,
          realized_pnl: realizedPnl,
          realized_pnl_pct: realizedPnlPct,
          post_id: pos.post_id,
          executed_at: now,
          close_reason: trigger,
          reasoning: pos.reasoning ?? null,
          entry_price: entryPrice,
          price_target: priceTarget,
          stop_loss: stopLoss,
        })
        .select("id")
        .single();

      if (tradeError) {
        console.error(
          `[runner] Failed to insert TP/SL close trade: ${tradeError.message}`
        );
        continue;
      }

      // Live close — if live position fails to close on-chain, skip virtual close
      // to prevent divergence between on-chain and virtual state
      if (pos.is_live && tradeData?.id && pos.token_address) {
        const liveResult = await executeLiveClose({
          agentId,
          tradeId: tradeData.id as string,
          tokenAddress: pos.token_address as string,
        });
        if (!liveResult) {
          console.warn(
            `[runner] Live close (TP/SL) failed for ${pos.token_symbol}, keeping position open to prevent divergence`
          );
          // Rollback the close trade record
          await supabase.from("virtual_trades").delete().eq("id", tradeData.id);
          continue;
        }
      }

      // Delete the position
      await supabase.from("virtual_positions").delete().eq("id", pos.id);

      cashBalanceChange += amountUsdc + realizedPnl;
      totalRealizedPnl += realizedPnl;
      closedCount++;

      console.log(
        `[runner] ${trigger.toUpperCase()} hit: closed ${side} ${pos.token_symbol} @ $${executionPrice.toFixed(4)} (entry $${entryPrice.toFixed(4)}, current $${currentPrice.toFixed(4)}, P&L $${realizedPnl.toFixed(2)})`
      );
    }

    // Update portfolio
    if (cashBalanceChange !== 0) {
      await supabase
        .from("virtual_portfolios")
        .update({
          cash_balance: portfolio.cash_balance + cashBalanceChange,
          total_pnl: (portfolio.total_pnl ?? 0) + totalRealizedPnl,
        })
        .eq("agent_id", agentId);

      await recordPortfolioSnapshot(agentId);
    }

    return closedCount;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[runner] closePositionsByTpSl failed for ${agentId}: ${message}`
    );
    return 0;
  }
}

// ============================================================
// 4c. Force-close ALL positions for a given agent (used for paused agents)
// ============================================================

/**
 * Force-close every open position for an agent at current market price.
 * Used when an agent is paused/stopped — all positions are liquidated
 * with close_reason = 'manual'.
 */
export async function forceCloseAllPositions(
  agentId: string,
  existingMarketData?: RealMarketData[]
): Promise<number> {
  const supabase = createAdminClient();

  try {
    const { data: positions, error: fetchError } = await supabase
      .from("virtual_positions")
      .select("*")
      .eq("agent_id", agentId);

    if (fetchError || !positions || positions.length === 0) return 0;

    const marketData = existingMarketData ?? await fetchMarketContext();
    const portfolio = await getOrCreatePortfolio(agentId);
    let cashBalanceChange = 0;
    let totalRealizedPnl = 0;
    let closedCount = 0;

    for (const pos of positions) {
      const currentPrice = findPriceInMarketData(
        pos.token_symbol as string,
        marketData
      );

      if (!currentPrice) {
        console.warn(
          `[runner] Cannot find price for ${pos.token_symbol}, skipping force-close`
        );
        continue;
      }

      const entryPrice = Number(pos.entry_price);
      const quantity = Number(pos.quantity);
      const amountUsdc = Number(pos.amount_usdc);
      const side = pos.side as string;

      const realizedPnl =
        side === "long"
          ? (currentPrice - entryPrice) * quantity
          : (entryPrice - currentPrice) * quantity;
      const realizedPnlPct =
        amountUsdc > 0 ? (realizedPnl / amountUsdc) * 100 : 0;
      const now = new Date().toISOString();

      const { data: tradeData, error: tradeError } = await supabase
        .from("virtual_trades")
        .insert({
          agent_id: agentId,
          token_address: pos.token_address,
          token_symbol: pos.token_symbol,
          side,
          position_type: pos.position_type,
          leverage: pos.leverage,
          action: "close",
          price: currentPrice,
          quantity,
          amount_usdc: amountUsdc,
          realized_pnl: realizedPnl,
          realized_pnl_pct: realizedPnlPct,
          post_id: pos.post_id,
          executed_at: now,
          close_reason: "manual",
          reasoning: pos.reasoning ?? null,
          entry_price: entryPrice,
          price_target: pos.price_target != null ? Number(pos.price_target) : null,
          stop_loss: pos.stop_loss != null ? Number(pos.stop_loss) : null,
        })
        .select("id")
        .single();

      if (tradeError) {
        console.error(
          `[runner] Failed to insert force-close trade: ${tradeError.message}`
        );
        continue;
      }

      // Live close
      if (pos.is_live && tradeData?.id && pos.token_address) {
        const liveResult = await executeLiveClose({
          agentId,
          tradeId: tradeData.id as string,
          tokenAddress: pos.token_address as string,
        });
        if (!liveResult) {
          console.warn(
            `[runner] Live close (force) failed for ${pos.token_symbol}, keeping position open`
          );
          await supabase.from("virtual_trades").delete().eq("id", tradeData.id);
          continue;
        }
      }

      await supabase.from("virtual_positions").delete().eq("id", pos.id);

      cashBalanceChange += amountUsdc + realizedPnl;
      totalRealizedPnl += realizedPnl;
      closedCount++;

      console.log(
        `[runner] Force-closed ${side} ${pos.token_symbol} @ $${currentPrice.toFixed(4)} (entry $${entryPrice.toFixed(4)}, P&L $${realizedPnl.toFixed(2)})`
      );
    }

    if (cashBalanceChange !== 0) {
      await supabase
        .from("virtual_portfolios")
        .update({
          cash_balance: portfolio.cash_balance + cashBalanceChange,
          total_pnl: (portfolio.total_pnl ?? 0) + totalRealizedPnl,
        })
        .eq("agent_id", agentId);

      await recordPortfolioSnapshot(agentId);
    }

    return closedCount;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[runner] forceCloseAllPositions failed for ${agentId}: ${message}`
    );
    return 0;
  }
}

// ============================================================
// 5. Close Expired Positions
// ============================================================

/**
 * Close all virtual positions older than the time-horizon-based expiry for a given agent.
 * Uses 2x the resolution cutoff as the expiry window (falls back to swing/6 days).
 * Calculates realized P&L based on current market price vs entry price.
 */
export async function closeExpiredPositions(
  agentId: string,
  existingMarketData?: RealMarketData[],
  agentTimeHorizon?: string,
): Promise<void> {
  const supabase = createAdminClient();

  try {
    const expiryMs = positionExpiryMs(agentTimeHorizon ?? "swing");
    const expiryDate = new Date(Date.now() - expiryMs).toISOString();

    // Fetch expired positions
    const { data: positions, error: fetchError } = await supabase
      .from("virtual_positions")
      .select("*")
      .eq("agent_id", agentId)
      .lte("opened_at", expiryDate);

    if (fetchError) {
      throw new Error(
        `Failed to fetch expired positions: ${fetchError.message}`
      );
    }

    if (!positions || positions.length === 0) {
      return;
    }

    // Fetch current market prices (reuse if provided)
    const marketData = existingMarketData ?? await fetchMarketContext();

    // Fetch portfolio for cash balance update
    const portfolio = await getOrCreatePortfolio(agentId);
    let cashBalanceChange = 0;
    let totalRealizedPnl = 0;

    for (const pos of positions) {
      const currentPrice = findPriceInMarketData(
        pos.token_symbol as string,
        marketData
      );

      if (!currentPrice) {
        console.warn(
          `[runner] Cannot find price for ${pos.token_symbol}, skipping close`
        );
        continue;
      }

      const entryPrice = Number(pos.entry_price);
      const quantity = Number(pos.quantity);
      const amountUsdc = Number(pos.amount_usdc);
      const side = pos.side as string;

      // Calculate P&L
      let realizedPnl: number;
      if (side === "long") {
        realizedPnl = (currentPrice - entryPrice) * quantity;
      } else {
        realizedPnl = (entryPrice - currentPrice) * quantity;
      }

      const realizedPnlPct =
        amountUsdc > 0 ? (realizedPnl / amountUsdc) * 100 : 0;
      const now = new Date().toISOString();

      // Insert close trade
      const { data: tradeData, error: tradeError } = await supabase
        .from("virtual_trades")
        .insert({
          agent_id: agentId,
          token_address: pos.token_address,
          token_symbol: pos.token_symbol,
          side,
          position_type: pos.position_type,
          leverage: pos.leverage,
          action: "close",
          price: currentPrice,
          quantity,
          amount_usdc: amountUsdc,
          realized_pnl: realizedPnl,
          realized_pnl_pct: realizedPnlPct,
          post_id: pos.post_id,
          executed_at: now,
          close_reason: "expired",
          reasoning: pos.reasoning ?? null,
          entry_price: entryPrice,
          price_target: pos.price_target != null ? Number(pos.price_target) : null,
          stop_loss: pos.stop_loss != null ? Number(pos.stop_loss) : null,
        })
        .select("id")
        .single();

      if (tradeError) {
        console.error(
          `[runner] Failed to insert close trade: ${tradeError.message}`
        );
        continue;
      }

      // Live close — if live position fails to close on-chain, skip virtual close
      // to prevent divergence between on-chain and virtual state
      if (pos.is_live && tradeData?.id && pos.token_address) {
        const liveResult = await executeLiveClose({
          agentId,
          tradeId: tradeData.id as string,
          tokenAddress: pos.token_address as string,
        });
        if (!liveResult) {
          console.warn(
            `[runner] Live close failed for expired ${pos.token_symbol}, keeping position open to prevent divergence`
          );
          // Rollback the close trade record
          await supabase.from("virtual_trades").delete().eq("id", tradeData.id);
          continue;
        }
      }

      // Delete the position
      const { error: deleteError } = await supabase
        .from("virtual_positions")
        .delete()
        .eq("id", pos.id);

      if (deleteError) {
        console.error(
          `[runner] Failed to delete position: ${deleteError.message}`
        );
        continue;
      }

      cashBalanceChange += amountUsdc + realizedPnl;
      totalRealizedPnl += realizedPnl;

      console.log(
        `[runner] Closed expired ${side} ${pos.token_symbol}: P&L $${realizedPnl.toFixed(2)} (${realizedPnlPct.toFixed(1)}%)`
      );
    }

    // Update portfolio cash balance and total P&L
    if (cashBalanceChange !== 0) {
      const { error: portfolioError } = await supabase
        .from("virtual_portfolios")
        .update({
          cash_balance: portfolio.cash_balance + cashBalanceChange,
          total_pnl: (portfolio.total_pnl ?? 0) + totalRealizedPnl,
        })
        .eq("agent_id", agentId);

      if (portfolioError) {
        console.error(
          `[runner] Failed to update portfolio after close: ${portfolioError.message}`
        );
      }

      // Record portfolio snapshot after closing positions
      await recordPortfolioSnapshot(agentId);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[runner] closeExpiredPositions failed for ${agentId}: ${message}`
    );
  }
}
