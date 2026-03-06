import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Inlined from deleted programs.ts
// Lazy-init to avoid crashing at import time when env is missing or key is
// a placeholder.  The actual program ID should be set via env var in prod.
let _rentalProgramId: PublicKey | null = null;

function getRentalProgramId(): PublicKey {
  if (!_rentalProgramId) {
    const raw =
      process.env.NEXT_PUBLIC_RENTAL_PROGRAM_ID ??
      "Rent111111111111111111111111111111111111111";
    try {
      _rentalProgramId = new PublicKey(raw);
    } catch {
      // Fallback to system program so the app doesn't crash in dev
      console.warn(
        "[rental] Invalid RENTAL_PROGRAM_ID, falling back to SystemProgram"
      );
      _rentalProgramId = SystemProgram.programId;
    }
  }
  return _rentalProgramId;
}

function findPda(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function strSeed(s: string): Buffer {
  return Buffer.from(s, "utf-8");
}

/** Derive AgentPricing PDA */
export function getAgentPricingAddress(agentId: string): [PublicKey, number] {
  return findPda([strSeed("pricing"), strSeed(agentId)], getRentalProgramId());
}

/** Derive Subscription PDA */
export function getSubscriptionAddress(
  subscriber: PublicKey,
  agentId: string
): [PublicKey, number] {
  return findPda(
    [strSeed("sub"), subscriber.toBuffer(), strSeed(agentId)],
    getRentalProgramId()
  );
}

const IX_SET_PRICING = Buffer.from([
  0x1c, 0x2d, 0x3e, 0x4f, 0x5a, 0x6b, 0x7c, 0x8d,
]);
const IX_SUBSCRIBE = Buffer.from([
  0x2e, 0x3f, 0x4a, 0x5b, 0x6c, 0x7d, 0x8e, 0x9f,
]);
const IX_UNSUBSCRIBE = Buffer.from([
  0x4c, 0x5d, 0x6e, 0x7f, 0x8a, 0x9b, 0xac, 0xbd,
]);

/** Build set_pricing instruction */
export function buildSetPricing(params: {
  agentId: string;
  planType: number;
  monthlyPrice: bigint;
  perfFeeTiers: [number, number, number, number];
  paymentMint: PublicKey;
  authority: PublicKey;
}): TransactionInstruction {
  const [pricingPda] = getAgentPricingAddress(params.agentId);
  const idBytes = Buffer.from(params.agentId, "utf-8");
  const dataLen = 8 + 4 + idBytes.length + 1 + 8 + 8;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_SET_PRICING.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(idBytes.length, offset);
  offset += 4;
  idBytes.copy(data, offset);
  offset += idBytes.length;
  data.writeUInt8(params.planType, offset);
  offset += 1;
  data.writeBigUInt64LE(params.monthlyPrice, offset);
  offset += 8;
  for (const tier of params.perfFeeTiers) {
    data.writeUInt16LE(tier, offset);
    offset += 2;
  }

  return new TransactionInstruction({
    programId: getRentalProgramId(),
    keys: [
      { pubkey: pricingPda, isSigner: false, isWritable: true },
      { pubkey: params.paymentMint, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build subscribe instruction */
export function buildSubscribe(params: {
  agentId: string;
  paymentAmount: bigint;
  subscriber: PublicKey;
  subscriberTokenAccount: PublicKey;
  vault: PublicKey;
}): TransactionInstruction {
  const [pricingPda] = getAgentPricingAddress(params.agentId);
  const [subPda] = getSubscriptionAddress(params.subscriber, params.agentId);
  const idBytes = Buffer.from(params.agentId, "utf-8");
  const dataLen = 8 + 4 + idBytes.length + 8;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  IX_SUBSCRIBE.copy(data, offset);
  offset += 8;
  data.writeUInt32LE(idBytes.length, offset);
  offset += 4;
  idBytes.copy(data, offset);
  offset += idBytes.length;
  data.writeBigUInt64LE(params.paymentAmount, offset);

  return new TransactionInstruction({
    programId: getRentalProgramId(),
    keys: [
      { pubkey: pricingPda, isSigner: false, isWritable: true },
      { pubkey: subPda, isSigner: false, isWritable: true },
      { pubkey: params.subscriberTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.vault, isSigner: false, isWritable: true },
      { pubkey: params.subscriber, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build unsubscribe instruction */
export function buildUnsubscribe(params: {
  agentId: string;
  subscriber: PublicKey;
}): TransactionInstruction {
  const [subPda] = getSubscriptionAddress(params.subscriber, params.agentId);
  const [pricingPda] = getAgentPricingAddress(params.agentId);

  return new TransactionInstruction({
    programId: getRentalProgramId(),
    keys: [
      { pubkey: subPda, isSigner: false, isWritable: true },
      { pubkey: pricingPda, isSigner: false, isWritable: true },
      { pubkey: params.subscriber, isSigner: true, isWritable: false },
    ],
    data: IX_UNSUBSCRIBE,
  });
}
