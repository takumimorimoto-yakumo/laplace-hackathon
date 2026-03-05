import { Keypair } from "@solana/web3.js";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const secret = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("AGENT_KEY_ENCRYPTION_SECRET environment variable is not set");
  }
  return Buffer.from(secret, "hex");
}

export function encryptPrivateKey(secretKey: Uint8Array): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(secretKey)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPrivateKey(encrypted: string): Uint8Array {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return new Uint8Array(decrypted);
}

export function generateAgentWallet(): { publicKey: string; encryptedPrivateKey: string } {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const encryptedPrivateKey = encryptPrivateKey(keypair.secretKey);
  return { publicKey, encryptedPrivateKey };
}
