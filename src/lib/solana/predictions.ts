import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { ORACLE_PROGRAM_ID, findPda, strSeed } from "./programs";

/** Derive AgentCounter PDA */
export function getAgentCounterAddress(agentId: string): [PublicKey, number] {
  return findPda([strSeed("counter"), strSeed(agentId)], ORACLE_PROGRAM_ID);
}

/** Derive Prediction PDA */
export function getPredictionAddress(
  agentId: string,
  count: number
): [PublicKey, number] {
  const countBuf = Buffer.alloc(8);
  countBuf.writeBigUInt64LE(BigInt(count));
  return findPda(
    [strSeed("prediction"), strSeed(agentId), countBuf],
    ORACLE_PROGRAM_ID
  );
}

const IX_INITIALIZE_COUNTER = Buffer.from([
  0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b,
]);
const IX_RECORD_PREDICTION = Buffer.from([
  0x4a, 0x5b, 0x6c, 0x7d, 0x8e, 0x9f, 0xa1, 0xb2,
]);
const IX_RESOLVE_PREDICTION = Buffer.from([
  0x5c, 0x6d, 0x7e, 0x8f, 0x9a, 0xab, 0xbc, 0xcd,
]);

/** Build initialize_counter instruction */
export function buildInitializeCounter(params: {
  agentId: string;
  authority: PublicKey;
}): TransactionInstruction {
  const [counterPda] = getAgentCounterAddress(params.agentId);
  const idBytes = Buffer.from(params.agentId, "utf-8");
  const data = Buffer.alloc(8 + 4 + idBytes.length);
  IX_INITIALIZE_COUNTER.copy(data, 0);
  data.writeUInt32LE(idBytes.length, 8);
  idBytes.copy(data, 12);

  return new TransactionInstruction({
    programId: ORACLE_PROGRAM_ID,
    keys: [
      { pubkey: counterPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build record_prediction instruction */
export function buildRecordPrediction(params: {
  agentId: string;
  token: string;
  direction: number;
  confidence: number; // 0-1000
  entryPrice: bigint;
  timeHorizon: bigint;
  authority: PublicKey;
  currentCount: number;
}): TransactionInstruction {
  const [counterPda] = getAgentCounterAddress(params.agentId);
  const [predictionPda] = getPredictionAddress(
    params.agentId,
    params.currentCount
  );

  const agentIdBytes = Buffer.from(params.agentId, "utf-8");
  const tokenBytes = Buffer.from(params.token, "utf-8");
  const dataLen =
    8 + 4 + agentIdBytes.length + 4 + tokenBytes.length + 1 + 2 + 8 + 8;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_RECORD_PREDICTION.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(agentIdBytes.length, offset);
  offset += 4;
  agentIdBytes.copy(data, offset);
  offset += agentIdBytes.length;
  data.writeUInt32LE(tokenBytes.length, offset);
  offset += 4;
  tokenBytes.copy(data, offset);
  offset += tokenBytes.length;
  data.writeUInt8(params.direction, offset);
  offset += 1;
  data.writeUInt16LE(params.confidence, offset);
  offset += 2;
  data.writeBigUInt64LE(params.entryPrice, offset);
  offset += 8;
  data.writeBigInt64LE(params.timeHorizon, offset);

  return new TransactionInstruction({
    programId: ORACLE_PROGRAM_ID,
    keys: [
      { pubkey: predictionPda, isSigner: false, isWritable: true },
      { pubkey: counterPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build resolve_prediction instruction */
export function buildResolvePrediction(params: {
  predictionPda: PublicKey;
  outcomePrice: bigint;
  authority: PublicKey;
}): TransactionInstruction {
  const data = Buffer.alloc(8 + 8);
  IX_RESOLVE_PREDICTION.copy(data, 0);
  data.writeBigUInt64LE(params.outcomePrice, 8);

  return new TransactionInstruction({
    programId: ORACLE_PROGRAM_ID,
    keys: [
      { pubkey: params.predictionPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}
