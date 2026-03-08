// ============================================================
// Jupiter Swap Executor — Sign and send swaps for agent wallets
// ============================================================

import {
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import { getConnection, getNetwork } from "@/lib/solana/connection";
import { getQuote, getSwapTransaction } from "./client";

/** USDC mint addresses by network */
const USDC_MINTS: Record<string, string> = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

const USDC_DECIMALS = 6;
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export function getUsdcMint(): string {
  return USDC_MINTS[getNetwork()] ?? USDC_MINTS["devnet"];
}

export interface ExecuteSwapParams {
  keypair: Keypair;
  inputMint: string;
  outputMint: string;
  /** Amount in token base units (e.g. USDC uses 6 decimals) */
  amountBaseUnits: number;
  slippageBps?: number;
}

export interface ExecuteSwapResult {
  txSignature: string;
  inAmount: string;
  outAmount: string;
}

/**
 * Execute a swap on Jupiter for an agent wallet:
 * 1. Get quote
 * 2. Get serialized swap transaction
 * 3. Deserialize as VersionedTransaction
 * 4. Sign with the agent's keypair
 * 5. Send and confirm
 */
export async function executeAgentSwap(
  params: ExecuteSwapParams
): Promise<ExecuteSwapResult> {
  const { keypair, inputMint, outputMint, amountBaseUnits, slippageBps } = params;

  // 1. Get quote
  const quote = await getQuote({
    inputMint,
    outputMint,
    amount: amountBaseUnits,
    slippageBps: slippageBps ?? DEFAULT_SLIPPAGE_BPS,
  });

  if (!quote) {
    throw new Error("Failed to get Jupiter quote");
  }

  // 2. Get swap transaction
  const swapResult = await getSwapTransaction({
    quoteResponse: quote,
    userPublicKey: keypair.publicKey.toBase58(),
    wrapAndUnwrapSol: true,
  });

  if (!swapResult) {
    throw new Error("Failed to get Jupiter swap transaction");
  }

  // 3. Deserialize the transaction
  const txBuffer = Buffer.from(swapResult.swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  // 4. Sign with the agent keypair
  transaction.sign([keypair]);

  // 5. Send and confirm
  const connection = getConnection();
  const txSignature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false, maxRetries: 3 }
  );

  // Wait for confirmation
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  await connection.confirmTransaction(
    {
      signature: txSignature,
      blockhash,
      lastValidBlockHeight: swapResult.lastValidBlockHeight ?? lastValidBlockHeight,
    },
    "confirmed"
  );

  return {
    txSignature,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
  };
}

/**
 * Convert a USDC dollar amount to base units (6 decimals).
 */
export function usdcToBaseUnits(usdcAmount: number): number {
  return Math.floor(usdcAmount * 10 ** USDC_DECIMALS);
}
