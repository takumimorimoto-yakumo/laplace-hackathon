import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MARKET_PROGRAM_ID, findPda, strSeed } from "./programs";

/** Derive Contest PDA */
export function getContestAddress(contestId: string): [PublicKey, number] {
  return findPda([strSeed("contest"), strSeed(contestId)], MARKET_PROGRAM_ID);
}

/** Derive Position PDA */
export function getPositionAddress(
  predictor: PublicKey,
  contestId: string
): [PublicKey, number] {
  return findPda(
    [strSeed("position"), predictor.toBuffer(), strSeed(contestId)],
    MARKET_PROGRAM_ID
  );
}

const IX_CREATE_CONTEST = Buffer.from([
  0x1e, 0x2f, 0x3a, 0x4b, 0x5c, 0x6d, 0x7e, 0x8f,
]);
const IX_PLACE_POSITION = Buffer.from([
  0x2a, 0x3b, 0x4c, 0x5d, 0x6e, 0x7f, 0x8a, 0x9b,
]);
const IX_RESOLVE_CONTEST = Buffer.from([
  0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b, 0x9c, 0xad,
]);
const IX_CLAIM_WINNINGS = Buffer.from([
  0x4e, 0x5f, 0x6a, 0x7b, 0x8c, 0x9d, 0xae, 0xbf,
]);

/** Build create_contest instruction */
export function buildCreateContest(params: {
  contestId: string;
  periodType: number;
  startsAt: bigint;
  endsAt: bigint;
  paymentMint: PublicKey;
  authority: PublicKey;
}): TransactionInstruction {
  const [contestPda] = getContestAddress(params.contestId);
  const idBytes = Buffer.from(params.contestId, "utf-8");
  const dataLen = 8 + 4 + idBytes.length + 1 + 8 + 8;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_CREATE_CONTEST.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(idBytes.length, offset);
  offset += 4;
  idBytes.copy(data, offset);
  offset += idBytes.length;
  data.writeUInt8(params.periodType, offset);
  offset += 1;
  data.writeBigInt64LE(params.startsAt, offset);
  offset += 8;
  data.writeBigInt64LE(params.endsAt, offset);

  return new TransactionInstruction({
    programId: MARKET_PROGRAM_ID,
    keys: [
      { pubkey: contestPda, isSigner: false, isWritable: true },
      { pubkey: params.paymentMint, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build place_position instruction */
export function buildPlacePosition(params: {
  contestId: string;
  positionType: number;
  agentSelections: [PublicKey, PublicKey, PublicKey];
  amount: bigint;
  predictor: PublicKey;
  predictorTokenAccount: PublicKey;
  vault: PublicKey;
}): TransactionInstruction {
  const [contestPda] = getContestAddress(params.contestId);
  const [positionPda] = getPositionAddress(params.predictor, params.contestId);
  const idBytes = Buffer.from(params.contestId, "utf-8");
  const dataLen = 8 + 4 + idBytes.length + 1 + 32 * 3 + 8;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_PLACE_POSITION.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(idBytes.length, offset);
  offset += 4;
  idBytes.copy(data, offset);
  offset += idBytes.length;
  data.writeUInt8(params.positionType, offset);
  offset += 1;
  for (const sel of params.agentSelections) {
    sel.toBuffer().copy(data, offset);
    offset += 32;
  }
  data.writeBigUInt64LE(params.amount, offset);

  return new TransactionInstruction({
    programId: MARKET_PROGRAM_ID,
    keys: [
      { pubkey: contestPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: params.predictorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.vault, isSigner: false, isWritable: true },
      { pubkey: params.predictor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build resolve_contest instruction */
export function buildResolveContest(params: {
  contestId: string;
  winners: [PublicKey, PublicKey, PublicKey];
  authority: PublicKey;
}): TransactionInstruction {
  const [contestPda] = getContestAddress(params.contestId);
  const data = Buffer.alloc(8 + 32 * 3);
  let offset = 0;
  IX_RESOLVE_CONTEST.copy(data, offset);
  offset += 8;
  for (const w of params.winners) {
    w.toBuffer().copy(data, offset);
    offset += 32;
  }

  return new TransactionInstruction({
    programId: MARKET_PROGRAM_ID,
    keys: [
      { pubkey: contestPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Build claim_winnings instruction */
export function buildClaimWinnings(params: {
  contestId: string;
  predictor: PublicKey;
}): TransactionInstruction {
  const [positionPda] = getPositionAddress(params.predictor, params.contestId);
  const [contestPda] = getContestAddress(params.contestId);

  return new TransactionInstruction({
    programId: MARKET_PROGRAM_ID,
    keys: [
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: contestPda, isSigner: false, isWritable: false },
      { pubkey: params.predictor, isSigner: true, isWritable: false },
    ],
    data: IX_CLAIM_WINNINGS,
  });
}
