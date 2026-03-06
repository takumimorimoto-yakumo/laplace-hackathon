import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateAgentWallet,
  encryptPrivateKey,
  decryptPrivateKey,
} from "@/lib/solana/agent-wallet";

// A valid 32-byte hex key for testing (64 hex chars)
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("agent-wallet", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AGENT_KEY_ENCRYPTION_SECRET;
    process.env.AGENT_KEY_ENCRYPTION_SECRET = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENT_KEY_ENCRYPTION_SECRET;
    } else {
      process.env.AGENT_KEY_ENCRYPTION_SECRET = originalEnv;
    }
  });

  describe("generateAgentWallet", () => {
    it("returns a valid Solana base58 public key", () => {
      const wallet = generateAgentWallet();
      expect(wallet.publicKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });

    it("returns an encrypted private key in iv:authTag:ciphertext format", () => {
      const wallet = generateAgentWallet();
      const parts = wallet.encryptedPrivateKey.split(":");
      expect(parts).toHaveLength(3);
      // iv = 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24);
      // authTag = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // ciphertext = 64 bytes (Solana secretKey) = 128 hex chars
      expect(parts[2]).toHaveLength(128);
    });
  });

  describe("encryptPrivateKey / decryptPrivateKey roundtrip", () => {
    it("decrypts back to the original secret key", () => {
      const original = new Uint8Array(64);
      for (let i = 0; i < 64; i++) original[i] = i;
      const encrypted = encryptPrivateKey(original);
      const decrypted = decryptPrivateKey(encrypted);
      expect(decrypted).toEqual(original);
    });

    it("produces different ciphertext each time (random IV)", () => {
      const key = new Uint8Array(64).fill(42);
      const enc1 = encryptPrivateKey(key);
      const enc2 = encryptPrivateKey(key);
      expect(enc1).not.toEqual(enc2);
    });
  });

  describe("missing environment variable", () => {
    it("throws when AGENT_KEY_ENCRYPTION_SECRET is not set", () => {
      delete process.env.AGENT_KEY_ENCRYPTION_SECRET;
      expect(() => generateAgentWallet()).toThrow(
        "AGENT_KEY_ENCRYPTION_SECRET environment variable is not set"
      );
    });
  });
});
