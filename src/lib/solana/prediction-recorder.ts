import { createHash } from "crypto";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getConnection, getNetwork } from "./connection";

// SPL Memo Program v2
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const MINIMUM_BALANCE_SOL = 0.5;

// ---------- Base58 Decoder ----------
// Minimal base58 decoder (Bitcoin alphabet) for decoding private keys.
// We avoid adding bs58 as a direct dependency since it's only a transitive dep.
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(encoded: string): Uint8Array {
  const alphabetMap = new Map<string, number>();
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    alphabetMap.set(BASE58_ALPHABET[i], i);
  }

  // Count leading '1's (they map to leading zero bytes)
  let leadingZeros = 0;
  for (const ch of encoded) {
    if (ch === "1") leadingZeros++;
    else break;
  }

  // Decode the rest as a big number in base 58, convert to bytes
  const size = Math.ceil((encoded.length * Math.log(58)) / Math.log(256));
  const bytes = new Uint8Array(size);

  for (const ch of encoded) {
    const value = alphabetMap.get(ch);
    if (value === undefined) {
      throw new Error(`Invalid base58 character: ${ch}`);
    }
    let carry = value;
    for (let j = size - 1; j >= 0; j--) {
      carry += 58 * bytes[j];
      bytes[j] = carry % 256;
      carry = Math.floor(carry / 256);
    }
  }

  // Strip leading zero bytes from the computation (but keep leading-zero-encoded ones)
  let startIndex = 0;
  while (startIndex < bytes.length && bytes[startIndex] === 0) {
    startIndex++;
  }

  const result = new Uint8Array(leadingZeros + (bytes.length - startIndex));
  // Leading zeros are already 0 in the Uint8Array
  result.set(bytes.subarray(startIndex), leadingZeros);
  return result;
}

// ---------- Types ----------

export interface OnChainPredictionData {
  predictionId: string;
  agentId: string;
  tokenSymbol: string;
  direction: string;
  confidence: number;
  priceAtPrediction: number;
  priceAtResolution: number;
  outcome: string;
  directionScore: number;
  finalScore: number;
}

interface PredictionMemo {
  v: 2;
  pid: string;
  aid: string;
  tok: string;
  dir: "b" | "s" | "n";
  pp: number;
  pr: number;
  out: "c" | "i";
  hash: string;
  ts: number;
}

// ---------- Helpers ----------

function mapDirection(direction: string): "b" | "s" | "n" {
  if (direction === "bullish") return "b";
  if (direction === "bearish") return "s";
  return "n";
}

function mapOutcome(outcome: string): "c" | "i" {
  return outcome === "correct" ? "c" : "i";
}

/**
 * Build an integrity hash to hide strategy fields (confidence, directionScore,
 * finalScore) while allowing verification by anyone who knows the predictionId.
 * The full predictionId acts as a salt to prevent brute-force lookups.
 */
export function buildIntegrityHash(
  confidence: number,
  directionScore: number,
  finalScore: number,
  predictionId: string
): string {
  const payload = `${confidence}|${directionScore}|${finalScore}|${predictionId}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Build the compact JSON memo payload for a prediction.
 * Exported for testing.
 */
export function buildMemo(data: OnChainPredictionData): PredictionMemo {
  return {
    v: 2,
    pid: data.predictionId.slice(0, 8),
    aid: data.agentId.slice(0, 8),
    tok: data.tokenSymbol,
    dir: mapDirection(data.direction),
    pp: data.priceAtPrediction,
    pr: data.priceAtResolution,
    out: mapOutcome(data.outcome),
    hash: buildIntegrityHash(
      data.confidence,
      data.directionScore,
      data.finalScore,
      data.predictionId
    ),
    ts: Math.floor(Date.now() / 1000),
  };
}

/**
 * Serialize a memo payload to a string and validate size.
 * Memo program allows up to 566 bytes.
 */
export function serializeMemo(memo: PredictionMemo): string {
  const json = JSON.stringify(memo);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > 566) {
    throw new Error(
      `Memo payload too large: ${byteLength} bytes (max 566)`
    );
  }
  return json;
}

// ---------- Keypair ----------

/**
 * Load the signer keypair from SOLANA_SIGNER_PRIVATE_KEY env var (base58-encoded).
 * Throws if the env var is not set.
 */
export function getSignerKeypair(): Keypair {
  const privateKeyBase58 = process.env.SOLANA_SIGNER_PRIVATE_KEY;
  if (!privateKeyBase58) {
    throw new Error(
      "SOLANA_SIGNER_PRIVATE_KEY environment variable is not set"
    );
  }
  const secretKey = decodeBase58(privateKeyBase58);
  return Keypair.fromSecretKey(secretKey);
}

// ---------- Funding ----------

/**
 * On devnet, ensure the signer account has enough SOL.
 * If balance < 0.5 SOL, request an airdrop.
 */
export async function ensureFunded(signer: Keypair): Promise<void> {
  if (getNetwork() !== "devnet") return;

  const connection = getConnection();
  const balance = await connection.getBalance(signer.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;

  if (balanceSol < MINIMUM_BALANCE_SOL) {
    console.log(
      `Signer balance ${balanceSol} SOL is below ${MINIMUM_BALANCE_SOL} SOL, requesting airdrop...`
    );
    try {
      const sig = await connection.requestAirdrop(
        signer.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`Airdrop confirmed: ${sig}`);
    } catch (err) {
      console.warn("Airdrop failed (may be rate limited):", err);
    }
  }
}

// ---------- On-Chain Recording ----------

/**
 * Record a single prediction on-chain via SPL Memo.
 * Returns the transaction signature, or null on failure.
 */
export async function recordPredictionOnChain(
  data: OnChainPredictionData
): Promise<string | null> {
  try {
    const signer = getSignerKeypair();
    await ensureFunded(signer);

    const memo = buildMemo(data);
    const memoString = serializeMemo(memo);

    const connection = getConnection();
    const instruction = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [
        {
          pubkey: signer.publicKey,
          isSigner: true,
          isWritable: false,
        },
      ],
      data: Buffer.from(memoString, "utf-8"),
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = signer.publicKey;

    transaction.sign(signer);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    console.log(
      `Prediction ${data.predictionId} recorded on-chain: ${signature}`
    );
    return signature;
  } catch (err) {
    console.warn(
      `Failed to record prediction ${data.predictionId} on-chain:`,
      err
    );
    return null;
  }
}

/**
 * Record a batch of predictions on-chain.
 * Each prediction is sent as a separate transaction (memo per tx).
 * Returns a map of predictionId -> txSignature for successful recordings.
 */
export async function recordBatchOnChain(
  items: OnChainPredictionData[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (items.length === 0) return results;

  // Check if signer key is configured
  if (!process.env.SOLANA_SIGNER_PRIVATE_KEY) {
    console.warn(
      "SOLANA_SIGNER_PRIVATE_KEY not set, skipping on-chain recording"
    );
    return results;
  }

  for (const item of items) {
    const signature = await recordPredictionOnChain(item);
    if (signature) {
      results.set(item.predictionId, signature);
    }
  }

  return results;
}
