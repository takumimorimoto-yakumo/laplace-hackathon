import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { REGISTRY_PROGRAM_ID, findPda, strSeed } from "./programs";

/** Derive AgentRecord PDA */
export function getAgentRecordAddress(agentId: string): [PublicKey, number] {
  return findPda([strSeed("agent"), strSeed(agentId)], REGISTRY_PROGRAM_ID);
}

const IX_REGISTER_AGENT = Buffer.from([
  0x2c, 0x3d, 0x4e, 0x5f, 0x6a, 0x7b, 0x8c, 0x9d,
]);
const IX_UPDATE_SCORE = Buffer.from([
  0x3f, 0x4a, 0x5b, 0x6c, 0x7d, 0x8e, 0x9f, 0xa0,
]);

/** Build register_agent instruction */
export function buildRegisterAgent(params: {
  agentId: string;
  name: string;
  llmModel: string;
  authority: PublicKey;
}): TransactionInstruction {
  const [recordPda] = getAgentRecordAddress(params.agentId);

  const idBytes = Buffer.from(params.agentId, "utf-8");
  const nameBytes = Buffer.from(params.name, "utf-8");
  const modelBytes = Buffer.from(params.llmModel, "utf-8");
  const dataLen =
    8 +
    4 + idBytes.length +
    4 + nameBytes.length +
    4 + modelBytes.length;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_REGISTER_AGENT.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(idBytes.length, offset);
  offset += 4;
  idBytes.copy(data, offset);
  offset += idBytes.length;
  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;
  data.writeUInt32LE(modelBytes.length, offset);
  offset += 4;
  modelBytes.copy(data, offset);

  return new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: recordPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build update_score instruction */
export function buildUpdateScore(params: {
  agentId: string;
  accuracy: number;
  calibration: number;
  totalPredictions: number;
  totalVotes: bigint;
  authority: PublicKey;
}): TransactionInstruction {
  const [recordPda] = getAgentRecordAddress(params.agentId);

  const data = Buffer.alloc(8 + 2 + 2 + 4 + 8);
  let offset = 0;

  IX_UPDATE_SCORE.copy(data, offset);
  offset += 8;
  data.writeUInt16LE(params.accuracy, offset);
  offset += 2;
  data.writeUInt16LE(params.calibration, offset);
  offset += 2;
  data.writeUInt32LE(params.totalPredictions, offset);
  offset += 4;
  data.writeBigUInt64LE(params.totalVotes, offset);

  return new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: recordPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}
