// ============================================================
// Live Trade Bridge — Execute real on-chain swaps for agent trades
// ============================================================
//
// Only user/external tier agents with live_trading_enabled = true
// can execute live trades. System agents NEVER trade live.
//
// Constraints:
// - Long positions only (Jupiter spot cannot short)
// - Short positions remain virtual-only
// - Live trade failure does NOT roll back the virtual trade (best-effort)

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAgentKeypair } from "@/lib/solana/agent-wallet";
import { getConnection } from "@/lib/solana/connection";
import { executeAgentSwap, getUsdcMint, usdcToBaseUnits } from "@/lib/jupiter/executor";
import { createAdminClient } from "@/lib/supabase/admin";

/** Minimum SOL balance required for transaction fees */
const MIN_SOL_BALANCE = 0.01 * LAMPORTS_PER_SOL;

/**
 * Execute a live open trade (USDC → token) for an agent's virtual position.
 * Only called for long positions on agents with live_trading_enabled = true.
 *
 * Updates virtual_positions with is_live = true and open_tx_signature on success.
 */
export async function executeLiveOpen(params: {
  agentId: string;
  positionId: string;
  tokenAddress: string;
  amountUsdc: number;
}): Promise<{ txSignature: string } | null> {
  const { agentId, positionId, tokenAddress, amountUsdc } = params;

  try {
    // 1. Get agent keypair
    const keypair = await getAgentKeypair(agentId);
    if (!keypair) {
      console.warn(`[live-trade] No keypair for agent ${agentId}, skipping live open`);
      return null;
    }

    // 2. Check SOL balance for fees
    const connection = getConnection();
    const balance = await connection.getBalance(keypair.publicKey);
    if (balance < MIN_SOL_BALANCE) {
      console.warn(
        `[live-trade] Agent ${agentId} has insufficient SOL (${balance / LAMPORTS_PER_SOL} SOL), skipping live open`
      );
      return null;
    }

    // 3. Execute swap: USDC → token
    const result = await executeAgentSwap({
      keypair,
      inputMint: getUsdcMint(),
      outputMint: tokenAddress,
      amountBaseUnits: usdcToBaseUnits(amountUsdc),
    });

    // 4. Update virtual_positions with live trade info
    const supabase = createAdminClient();
    await supabase
      .from("virtual_positions")
      .update({
        is_live: true,
        open_tx_signature: result.txSignature,
      })
      .eq("id", positionId);

    console.log(
      `[live-trade] Opened live position for agent ${agentId}: ${result.txSignature}`
    );

    return { txSignature: result.txSignature };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[live-trade] Live open failed for agent ${agentId}: ${message}`);
    return null;
  }
}

/**
 * Execute a live close trade (token → USDC) for an agent's live position.
 * Sells the full token balance back to USDC.
 *
 * Updates virtual_trades with tx_signature on success.
 */
export async function executeLiveClose(params: {
  agentId: string;
  tradeId: string;
  tokenAddress: string;
}): Promise<{ txSignature: string } | null> {
  const { agentId, tradeId, tokenAddress } = params;

  try {
    // 1. Get agent keypair
    const keypair = await getAgentKeypair(agentId);
    if (!keypair) {
      console.warn(`[live-trade] No keypair for agent ${agentId}, skipping live close`);
      return null;
    }

    // 2. Check SOL balance for fees
    const connection = getConnection();
    const solBalance = await connection.getBalance(keypair.publicKey);
    if (solBalance < MIN_SOL_BALANCE) {
      console.warn(
        `[live-trade] Agent ${agentId} has insufficient SOL for close, skipping`
      );
      return null;
    }

    // 3. Get token balance to sell everything
    const { PublicKey } = await import("@solana/web3.js");
    const tokenMint = new PublicKey(tokenAddress);
    const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      keypair.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const tokenAccount = tokenAccounts.value.find(
      (acc) => acc.account.data.parsed.info.mint === tokenMint.toBase58()
    );

    if (!tokenAccount) {
      console.warn(`[live-trade] No token account found for ${tokenAddress}, skipping live close`);
      return null;
    }

    const tokenAmount = Number(
      tokenAccount.account.data.parsed.info.tokenAmount.amount
    );

    if (tokenAmount <= 0) {
      console.warn(`[live-trade] Zero token balance for ${tokenAddress}, skipping live close`);
      return null;
    }

    // 4. Execute swap: token → USDC
    const result = await executeAgentSwap({
      keypair,
      inputMint: tokenAddress,
      outputMint: getUsdcMint(),
      amountBaseUnits: tokenAmount,
    });

    // 5. Update virtual_trades with tx_signature
    const supabase = createAdminClient();
    await supabase
      .from("virtual_trades")
      .update({ tx_signature: result.txSignature })
      .eq("id", tradeId);

    console.log(
      `[live-trade] Closed live position for agent ${agentId}: ${result.txSignature}`
    );

    return { txSignature: result.txSignature };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[live-trade] Live close failed for agent ${agentId}: ${message}`);
    return null;
  }
}
