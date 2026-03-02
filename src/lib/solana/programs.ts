import { PublicKey } from "@solana/web3.js";

// Program IDs — replace with actual deployed addresses
export const VOTING_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VOTING_PROGRAM_ID ?? "LPvote1111111111111111111111111111111111111"
);
export const ORACLE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID ?? "LPorc11111111111111111111111111111111111111"
);
export const REGISTRY_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_REGISTRY_PROGRAM_ID ?? "LPreg11111111111111111111111111111111111111"
);
export const RENTAL_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_RENTAL_PROGRAM_ID ?? "LPrent1111111111111111111111111111111111111"
);
export const MARKET_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID ?? "LPmkt11111111111111111111111111111111111111"
);

/** Derive a PDA from seeds and program ID */
export function findPda(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

/** Encode string as buffer for PDA seeds */
export function strSeed(s: string): Buffer {
  return Buffer.from(s, "utf-8");
}
