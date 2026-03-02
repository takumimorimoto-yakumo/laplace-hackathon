import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { VOTING_PROGRAM_ID, findPda, strSeed } from "./programs";

/** Derive VotePool PDA */
export function getVotePoolAddress(discussionId: string): [PublicKey, number] {
  return findPda([strSeed("vote_pool"), strSeed(discussionId)], VOTING_PROGRAM_ID);
}

/** Derive VoteRecord PDA */
export function getVoteRecordAddress(
  voter: PublicKey,
  postId: string
): [PublicKey, number] {
  return findPda(
    [strSeed("vote"), voter.toBuffer(), strSeed(postId)],
    VOTING_PROGRAM_ID
  );
}

// Anchor discriminators (first 8 bytes of sha256("global:<instruction_name>"))
// These are computed offline; in production use the IDL
const IX_INITIALIZE_VOTE_POOL = Buffer.from([
  0x2a, 0x5d, 0x6e, 0x8f, 0x1c, 0x3b, 0x4a, 0x7d,
]);
const IX_CAST_VOTE = Buffer.from([
  0x3e, 0x7c, 0x1a, 0x5f, 0x2d, 0x8b, 0x4c, 0x6e,
]);

/** Build initialize_vote_pool instruction */
export function buildInitializeVotePool(params: {
  discussionId: string;
  tokenMint: PublicKey;
  authority: PublicKey;
}): TransactionInstruction {
  const [votePoolPda] = getVotePoolAddress(params.discussionId);

  // Serialize: discriminator + discussionId (borsh string: u32 len + bytes)
  const idBytes = Buffer.from(params.discussionId, "utf-8");
  const data = Buffer.alloc(8 + 4 + idBytes.length);
  IX_INITIALIZE_VOTE_POOL.copy(data, 0);
  data.writeUInt32LE(idBytes.length, 8);
  idBytes.copy(data, 12);

  return new TransactionInstruction({
    programId: VOTING_PROGRAM_ID,
    keys: [
      { pubkey: votePoolPda, isSigner: false, isWritable: true },
      { pubkey: params.tokenMint, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build cast_vote instruction */
export function buildCastVote(params: {
  discussionId: string;
  agentId: string;
  postId: string;
  amount: bigint;
  direction: number; // 0=downvote, 1=upvote
  voter: PublicKey;
  voterTokenAccount: PublicKey;
  vault: PublicKey;
}): TransactionInstruction {
  const [votePoolPda] = getVotePoolAddress(params.discussionId);
  const [voteRecordPda] = getVoteRecordAddress(params.voter, params.postId);

  // Serialize: discriminator + agentId + postId + amount(u64) + direction(u8)
  const agentIdBytes = Buffer.from(params.agentId, "utf-8");
  const postIdBytes = Buffer.from(params.postId, "utf-8");
  const dataLen =
    8 + 4 + agentIdBytes.length + 4 + postIdBytes.length + 8 + 1;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_CAST_VOTE.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(agentIdBytes.length, offset);
  offset += 4;
  agentIdBytes.copy(data, offset);
  offset += agentIdBytes.length;
  data.writeUInt32LE(postIdBytes.length, offset);
  offset += 4;
  postIdBytes.copy(data, offset);
  offset += postIdBytes.length;
  data.writeBigUInt64LE(params.amount, offset);
  offset += 8;
  data.writeUInt8(params.direction, offset);

  return new TransactionInstruction({
    programId: VOTING_PROGRAM_ID,
    keys: [
      { pubkey: votePoolPda, isSigner: false, isWritable: true },
      { pubkey: voteRecordPda, isSigner: false, isWritable: true },
      { pubkey: params.voterTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.vault, isSigner: false, isWritable: true },
      { pubkey: params.voter, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
