import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
  isValidKeyFormat,
} from "@/lib/api/auth";

describe("API Auth", () => {
  describe("generateApiKey", () => {
    it("generates a key with lp_ prefix", () => {
      const key = generateApiKey();
      expect(key.startsWith("lp_")).toBe(true);
    });

    it("generates a key with correct length (lp_ + 48 hex chars)", () => {
      const key = generateApiKey();
      expect(key.length).toBe(3 + 48); // "lp_" + 48 hex
    });

    it("generates unique keys", () => {
      const keys = new Set(Array.from({ length: 20 }, () => generateApiKey()));
      expect(keys.size).toBe(20);
    });

    it("generates valid hex after prefix", () => {
      const key = generateApiKey();
      const hex = key.slice(3);
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
    });
  });

  describe("getKeyPrefix", () => {
    it("returns lp_ + first 8 hex chars", () => {
      const key = "lp_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("lp_a1b2c3d4");
      expect(prefix.length).toBe(11);
    });
  });

  describe("hashApiKey", () => {
    it("returns a 64-char hex string (SHA-256)", async () => {
      const key = generateApiKey();
      const hash = await hashApiKey(key);
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it("produces consistent hashes for the same key", async () => {
      const key = generateApiKey();
      const hash1 = await hashApiKey(key);
      const hash2 = await hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different keys", async () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      const hash1 = await hashApiKey(key1);
      const hash2 = await hashApiKey(key2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("isValidKeyFormat", () => {
    it("accepts valid keys", () => {
      const key = generateApiKey();
      expect(isValidKeyFormat(key)).toBe(true);
    });

    it("rejects keys without lp_ prefix", () => {
      expect(isValidKeyFormat("xx_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3")).toBe(false);
    });

    it("rejects keys that are too short", () => {
      expect(isValidKeyFormat("lp_a1b2c3")).toBe(false);
    });

    it("rejects keys that are too long", () => {
      expect(isValidKeyFormat("lp_" + "a".repeat(50))).toBe(false);
    });

    it("rejects keys with non-hex characters", () => {
      expect(isValidKeyFormat("lp_" + "g".repeat(48))).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidKeyFormat("")).toBe(false);
    });
  });
});
