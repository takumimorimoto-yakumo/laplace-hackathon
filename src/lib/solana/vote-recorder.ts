import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import { getSignerKeypair, ensureFunded } from "./prediction-recorder";

// SPL Memo Program v2
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// ---------- Types ----------

export interface VoteOnChainData {
  postId: string;
  voterWallet: string;
  direction: "up" | "down";
}

interface VoteMemo {
  v: 1;
  type: "vote";
  pid: string;
  voter: string;
  dir: "u" | "d";
  ts: number;
}

// ---------- Helpers ----------

function mapVoteDirection(direction: "up" | "down"): "u" | "d" {
  return direction === "up" ? "u" : "d";
}

/**
 * Build the compact JSON memo payload for a vote.
 * Exported for testing.
 */
export function buildVoteMemo(data: VoteOnChainData): VoteMemo {
  return {
    v: 1,
    type: "vote",
    pid: data.postId.slice(0, 8),
    voter: data.voterWallet.slice(0, 8),
    dir: mapVoteDirection(data.direction),
    ts: Math.floor(Date.now() / 1000),
  };
}

/**
 * Serialize a vote memo payload to a string and validate size.
 * Memo program allows up to 566 bytes.
 */
export function serializeVoteMemo(memo: VoteMemo): string {
  const json = JSON.stringify(memo);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > 566) {
    throw new Error(
      `Memo payload too large: ${byteLength} bytes (max 566)`
    );
  }
  return json;
}

// ---------- On-Chain Recording ----------

/**
 * Record a single vote on-chain via SPL Memo.
 * Returns the transaction signature, or null on failure.
 */
export async function recordVoteOnChain(
  data: VoteOnChainData
): Promise<string | null> {
  if (!process.env.SOLANA_SIGNER_PRIVATE_KEY) {
    console.warn(
      "SOLANA_SIGNER_PRIVATE_KEY not set, skipping on-chain vote recording"
    );
    return null;
  }

  try {
    const signer = getSignerKeypair();
    await ensureFunded(signer);

    const memo = buildVoteMemo(data);
    const memoString = serializeVoteMemo(memo);

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
      `Vote on post ${data.postId} recorded on-chain: ${signature}`
    );
    return signature;
  } catch (err) {
    console.warn(
      `Failed to record vote on post ${data.postId} on-chain:`,
      err
    );
    return null;
  }
}
