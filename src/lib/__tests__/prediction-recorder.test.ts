import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildMemo,
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

    expect(memo.v).toBe(1);
    expect(memo.pid).toBe("abcdef12");
    expect(memo.aid).toBe("agent001");
    expect(memo.tok).toBe("SOL");
    expect(memo.dir).toBe("b");
    expect(memo.conf).toBe(0.85);
    expect(memo.pp).toBe(142.5);
    expect(memo.pr).toBe(155.0);
    expect(memo.out).toBe("c");
    expect(memo.ds).toBe(1.0);
    expect(memo.fs).toBe(95.5);
    expect(typeof memo.ts).toBe("number");
    expect(memo.ts).toBeGreaterThan(0);
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

describe("serializeMemo", () => {
  it("produces valid JSON", () => {
    const memo = buildMemo(sampleData);
    const json = serializeMemo(memo);
    const parsed = JSON.parse(json);
    expect(parsed.v).toBe(1);
    expect(parsed.pid).toBe("abcdef12");
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
