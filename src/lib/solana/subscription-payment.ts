// ============================================================
// Subscription Payment — Build payment transaction for agent subscriptions
// Devnet: SOL transfer (easy to airdrop for testing)
// Mainnet: USDC SPL token transfer
// ============================================================

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

/** USDC mint addresses by network */
const USDC_MINTS: Record<string, string> = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

/** SKR mint addresses by network */
const SKR_MINTS: Record<string, string> = {
  "mainnet-beta": "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3",
  devnet: "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3", // same as mainnet (no devnet SKR)
};

/** Both USDC and SKR use 6 decimals */
const SPL_DECIMALS = 6;

/** SOL amount per $1 on devnet (symbolic, for testing) */
const DEVNET_SOL_PER_USD = 0.001;

/** Fallback treasury for devnet testing */
const DEVNET_TREASURY = "GDDMwNyyx8uB6zrqwBFHjLLG3TBYk2F8Az4yrQC5RzMp";

function getNetwork(): "devnet" | "mainnet-beta" {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network === "mainnet-beta") return "mainnet-beta";
  return "devnet";
}

function getUsdcMint(): PublicKey {
  const mint = USDC_MINTS[getNetwork()] ?? USDC_MINTS["devnet"];
  return new PublicKey(mint);
}

function getSkrMint(): PublicKey {
  const mint = SKR_MINTS[getNetwork()] ?? SKR_MINTS["mainnet-beta"];
  return new PublicKey(mint);
}

function getTreasuryWallet(): PublicKey {
  const raw = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? DEVNET_TREASURY;
  return new PublicKey(raw);
}

export interface BuildPaymentTxParams {
  connection: Connection;
  payer: PublicKey;
  /** Payment amount in USD (e.g. 10.0 for $10) */
  amountUsd: number;
  /** Payment token: SOL uses native transfer, USDC/SKR use SPL transfer */
  paymentToken: "USDC" | "SKR" | "SOL";
}

export interface BuildPaymentTxResult {
  transaction: Transaction;
  treasury: PublicKey;
  /** Display string: e.g. "10 USDC" or "0.01 SOL" */
  amountLabel: string;
}

/**
 * Build a payment transaction for subscription.
 * - **SOL**: Native SOL transfer on any network
 * - **USDC/SKR**: SPL token transfer
 */
export async function buildSubscriptionPaymentTx({
  connection,
  payer,
  amountUsd,
  paymentToken,
}: BuildPaymentTxParams): Promise<BuildPaymentTxResult> {
  const treasury = getTreasuryWallet();

  if (paymentToken === "SOL") {
    return buildSolPayment({ connection, payer, treasury, amountUsd });
  }
  return buildSplPayment({ connection, payer, treasury, amountUsd, paymentToken });
}

// ---- SOL Transfer ----

async function buildSolPayment({
  connection,
  payer,
  treasury,
  amountUsd,
}: {
  connection: Connection;
  payer: PublicKey;
  treasury: PublicKey;
  amountUsd: number;
}): Promise<BuildPaymentTxResult> {
  const solAmount = amountUsd * DEVNET_SOL_PER_USD;
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

  // Check SOL balance
  const balance = await connection.getBalance(payer);
  // Need lamports + ~5000 for tx fee
  if (balance < lamports + 5000) {
    throw new Error(
      `Insufficient SOL balance. Need ${solAmount} SOL, have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL. Use the admin faucet to get devnet SOL.`
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: treasury,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  return {
    transaction: tx,
    treasury,
    amountLabel: `${solAmount} SOL`,
  };
}

// ---- SPL Token Transfer (USDC / SKR) ----

async function buildSplPayment({
  connection,
  payer,
  treasury,
  amountUsd,
  paymentToken,
}: {
  connection: Connection;
  payer: PublicKey;
  treasury: PublicKey;
  amountUsd: number;
  paymentToken: "USDC" | "SKR";
}): Promise<BuildPaymentTxResult> {
  const tokenMint = paymentToken === "SKR" ? getSkrMint() : getUsdcMint();
  const tokenName = paymentToken;
  const amountBaseUnits = BigInt(Math.round(amountUsd * 10 ** SPL_DECIMALS));

  // Get payer's token ATA
  const payerAta = await getAssociatedTokenAddress(tokenMint, payer);

  // Verify payer has sufficient balance
  try {
    const payerAccount = await getAccount(connection, payerAta);
    if (payerAccount.amount < amountBaseUnits) {
      throw new Error(
        `Insufficient ${tokenName} balance. Need ${amountUsd} ${tokenName}, have ${Number(payerAccount.amount) / 10 ** SPL_DECIMALS} ${tokenName}`
      );
    }
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      throw new Error(
        `No ${tokenName} token account found. Please add ${tokenName} to your wallet first.`
      );
    }
    throw err;
  }

  // Get treasury's token ATA
  const treasuryAta = await getAssociatedTokenAddress(tokenMint, treasury);

  const tx = new Transaction();

  // Create treasury ATA if it doesn't exist
  try {
    await getAccount(connection, treasuryAta);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          payer,
          treasuryAta,
          treasury,
          tokenMint
        )
      );
    } else {
      throw err;
    }
  }

  // Add token transfer instruction
  tx.add(
    createTransferInstruction(payerAta, treasuryAta, payer, amountBaseUnits)
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  return {
    transaction: tx,
    treasury,
    amountLabel: `${amountUsd} ${tokenName}`,
  };
}
