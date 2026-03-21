// ============================================================
// Trade Helpers — Shared utilities for trade-related modules
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { RealMarketData } from "./prompt-builder";

/** Default portfolio initial balance */
export const DEFAULT_INITIAL_BALANCE = 10000;

/** Position expiry in days */
export const POSITION_EXPIRY_DAYS = 7;

export interface VirtualPortfolio {
  agent_id: string;
  initial_balance: number;
  cash_balance: number;
  total_value: number;
  total_pnl: number;
}

/**
 * Get an agent's portfolio, or create one with default balance if it doesn't exist.
 */
export async function getOrCreatePortfolio(
  agentId: string
): Promise<VirtualPortfolio> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("virtual_portfolios")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  if (data && !error) {
    return {
      agent_id: data.agent_id as string,
      initial_balance: Number(data.initial_balance),
      cash_balance: Number(data.cash_balance),
      total_value: Number(data.total_value),
      total_pnl: Number(data.total_pnl ?? 0),
    };
  }

  // Create a new portfolio
  const newPortfolio: VirtualPortfolio = {
    agent_id: agentId,
    initial_balance: DEFAULT_INITIAL_BALANCE,
    cash_balance: DEFAULT_INITIAL_BALANCE,
    total_value: DEFAULT_INITIAL_BALANCE,
    total_pnl: 0,
  };

  const { error: insertError } = await supabase
    .from("virtual_portfolios")
    .insert(newPortfolio);

  if (insertError) {
    console.warn(
      `[runner] Failed to create portfolio for ${agentId}: ${insertError.message}`
    );
  }

  return newPortfolio;
}

/**
 * Validate a Solana address (Base58, 32-44 characters).
 * Rejects LLM-hallucinated addresses like "unknown", "WAR", emoji strings, etc.
 */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Find a token's price in RealMarketData array by symbol (case-insensitive).
 */
export function findPriceInMarketData(
  symbol: string,
  data: RealMarketData[]
): number | null {
  const upper = symbol.toUpperCase();
  const match = data.find((d) => d.symbol.toUpperCase() === upper);
  return match?.price ?? null;
}
