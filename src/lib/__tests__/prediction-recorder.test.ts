import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildMemo,
  buildIntegrityHash,
  serializeMemo,
  getSignerKeypair,
  type OnChainPredictionData,
} from "@/lib/solana/prediction-recorder";

const sampleData: OnChainPredictionData = {
  predictionId: "abcdef12-3456-7890-abcd-ef1234567890",
  agentId: "agent001-uuid-goes-here-xxxxxxxxxxxx",
  tokenSymbol: "SOL",
  direction: "bullish",
  confidence: 0.85,
  priceAtPrediction: 142.5,
  priceAtResolution: 155.0,
  outcome: "correct",
  directionScore: 1.0,
  finalScore: 95.5,
};

describe("buildMemo", () => {
  it("produces correct JSON structure with all required fields", () => {
    const memo = buildMemo(sampleData);

    expect(memo.v).toBe(2);
    expect(memo.pid).toBe("abcdef12");
    expect(memo.aid).toBe("agent001");
    expect(memo.tok).toBe("SOL");
    expect(memo.dir).toBe("b");
    expect(memo.pp).toBe(142.5);
    expect(memo.pr).toBe(155.0);
    expect(memo.out).toBe("c");
    expect(typeof memo.hash).toBe("string");
    expect(memo.hash).toHaveLength(16);
    expect(typeof memo.ts).toBe("number");
    expect(memo.ts).toBeGreaterThan(0);
  });

  it("does not expose confidence, directionScore or finalScore", () => {
    const memo = buildMemo(sampleData);
    const keys = Object.keys(memo);
    expect(keys).not.toContain("conf");
    expect(keys).not.toContain("ds");
    expect(keys).not.toContain("fs");
  });

  it("hash matches buildIntegrityHash output for the same inputs", () => {
    const memo = buildMemo(sampleData);
    const expected = buildIntegrityHash(
      sampleData.confidence,
      sampleData.directionScore,
      sampleData.finalScore,
      sampleData.predictionId
    );
    expect(memo.hash).toBe(expected);
  });

  it("maps bearish direction to 's'", () => {
    const memo = buildMemo({ ...sampleData, direction: "bearish" });
    expect(memo.dir).toBe("s");
  });

  it("maps neutral direction to 'n'", () => {
    const memo = buildMemo({ ...sampleData, direction: "neutral" });
    expect(memo.dir).toBe("n");
  });

  it("maps incorrect outcome to 'i'", () => {
    const memo = buildMemo({ ...sampleData, outcome: "incorrect" });
    expect(memo.out).toBe("i");
  });

  it("truncates predictionId and agentId to first 8 characters", () => {
    const memo = buildMemo(sampleData);
    expect(memo.pid).toHaveLength(8);
    expect(memo.aid).toHaveLength(8);
  });

  it("includes unix timestamp in seconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const memo = buildMemo(sampleData);
    const after = Math.floor(Date.now() / 1000);
    expect(memo.ts).toBeGreaterThanOrEqual(before);
    expect(memo.ts).toBeLessThanOrEqual(after);
  });
});

describe("buildIntegrityHash", () => {
  it("returns a 16-character hex string", () => {
    const hash = buildIntegrityHash(0.85, 1.0, 95.5, "abcdef12-3456-7890-abcd-ef1234567890");
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic for the same inputs", () => {
    const args: [number, number, number, string] = [0.85, 1.0, 95.5, "abcdef12-3456-7890-abcd-ef1234567890"];
    expect(buildIntegrityHash(...args)).toBe(buildIntegrityHash(...args));
  });

  it("produces different hashes when confidence differs", () => {
    const id = "abcdef12-3456-7890-abcd-ef1234567890";
    const h1 = buildIntegrityHash(0.85, 1.0, 95.5, id);
    const h2 = buildIntegrityHash(0.90, 1.0, 95.5, id);
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes when predictionId (salt) differs", () => {
    const h1 = buildIntegrityHash(0.85, 1.0, 95.5, "aaaaaaaa-0000-0000-0000-000000000001");
    const h2 = buildIntegrityHash(0.85, 1.0, 95.5, "aaaaaaaa-0000-0000-0000-000000000002");
    expect(h1).not.toBe(h2);
  });
});

describe("serializeMemo", () => {
  it("produces valid JSON", () => {
    const memo = buildMemo(sampleData);
    const json = serializeMemo(memo);
    const parsed = JSON.parse(json);
    expect(parsed.v).toBe(2);
    expect(parsed.pid).toBe("abcdef12");
    expect(typeof parsed.hash).toBe("string");
    expect(parsed.hash).toHaveLength(16);
  });

  it("produces output under 566 bytes", () => {
    const memo = buildMemo(sampleData);
    const json = serializeMemo(memo);
    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThanOrEqual(566);
  });

  it("produces output under 566 bytes with long token symbol", () => {
    const data: OnChainPredictionData = {
      ...sampleData,
      tokenSymbol: "BONK",
      priceAtPrediction: 0.00000001234,
      priceAtResolution: 0.00000005678,
    };
    const memo = buildMemo(data);
    const json = serializeMemo(memo);
    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThanOrEqual(566);
  });

  it("produces output under 566 bytes with extreme values", () => {
    const data: OnChainPredictionData = {
      predictionId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      agentId: "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
      tokenSymbol: "WBTC",
      direction: "bullish",
      confidence: 0.99,
      priceAtPrediction: 99999.99999999,
      priceAtResolution: 99999.99999999,
      outcome: "correct",
      directionScore: 1.0,
      finalScore: 100.0,
    };
    const memo = buildMemo(data);
    const json = serializeMemo(memo);
    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThanOrEqual(566);
  });
});

describe("getSignerKeypair", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubEnv("SOLANA_SIGNER_PRIVATE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  it("throws when SOLANA_SIGNER_PRIVATE_KEY is not set", () => {
    delete process.env.SOLANA_SIGNER_PRIVATE_KEY;
    expect(() => getSignerKeypair()).toThrow(
      "SOLANA_SIGNER_PRIVATE_KEY environment variable is not set"
    );
  });

  it("throws when SOLANA_SIGNER_PRIVATE_KEY is empty string", () => {
    process.env.SOLANA_SIGNER_PRIVATE_KEY = "";
    expect(() => getSignerKeypair()).toThrow(
      "SOLANA_SIGNER_PRIVATE_KEY environment variable is not set"
    );
  });
});

describe("recordBatchOnChain", () => {
  beforeEach(() => {
    vi.stubEnv("SOLANA_SIGNER_PRIVATE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty map when SOLANA_SIGNER_PRIVATE_KEY is not set", async () => {
    delete process.env.SOLANA_SIGNER_PRIVATE_KEY;
    const { recordBatchOnChain } = await import(
      "@/lib/solana/prediction-recorder"
    );
    const result = await recordBatchOnChain([sampleData]);
    expect(result.size).toBe(0);
  });

  it("returns empty map for empty input", async () => {
    const { recordBatchOnChain } = await import(
      "@/lib/solana/prediction-recorder"
    );
    const result = await recordBatchOnChain([]);
    expect(result.size).toBe(0);
  });
});
