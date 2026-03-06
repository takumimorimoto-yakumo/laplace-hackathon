import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildVoteMemo,
  serializeVoteMemo,
  recordVoteOnChain,
  type VoteOnChainData,
} from "@/lib/solana/vote-recorder";

const sampleData: VoteOnChainData = {
  postId: "abcdef12-3456-7890-abcd-ef1234567890",
  voterWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  direction: "up",
};

describe("buildVoteMemo", () => {
  it("produces correct JSON structure with all required fields", () => {
    const memo = buildVoteMemo(sampleData);

    expect(memo.v).toBe(1);
    expect(memo.type).toBe("vote");
    expect(memo.pid).toBe("abcdef12");
    expect(memo.voter).toBe("7xKXtg2C");
    expect(memo.dir).toBe("u");
    expect(typeof memo.ts).toBe("number");
    expect(memo.ts).toBeGreaterThan(0);
  });

  it("maps 'up' direction to 'u'", () => {
    const memo = buildVoteMemo({ ...sampleData, direction: "up" });
    expect(memo.dir).toBe("u");
  });

  it("maps 'down' direction to 'd'", () => {
    const memo = buildVoteMemo({ ...sampleData, direction: "down" });
    expect(memo.dir).toBe("d");
  });

  it("truncates postId to first 8 characters", () => {
    const memo = buildVoteMemo(sampleData);
    expect(memo.pid).toHaveLength(8);
    expect(memo.pid).toBe(sampleData.postId.slice(0, 8));
  });

  it("truncates voterWallet to first 8 characters", () => {
    const memo = buildVoteMemo(sampleData);
    expect(memo.voter).toHaveLength(8);
    expect(memo.voter).toBe(sampleData.voterWallet.slice(0, 8));
  });

  it("includes unix timestamp in seconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const memo = buildVoteMemo(sampleData);
    const after = Math.floor(Date.now() / 1000);
    expect(memo.ts).toBeGreaterThanOrEqual(before);
    expect(memo.ts).toBeLessThanOrEqual(after);
  });
});

describe("serializeVoteMemo", () => {
  it("produces valid JSON", () => {
    const memo = buildVoteMemo(sampleData);
    const json = serializeVoteMemo(memo);
    const parsed = JSON.parse(json);
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe("vote");
    expect(parsed.pid).toBe("abcdef12");
  });

  it("produces output under 566 bytes", () => {
    const memo = buildVoteMemo(sampleData);
    const json = serializeVoteMemo(memo);
    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThanOrEqual(566);
  });

  it("produces output under 566 bytes with down vote", () => {
    const data: VoteOnChainData = {
      ...sampleData,
      direction: "down",
    };
    const memo = buildVoteMemo(data);
    const json = serializeVoteMemo(memo);
    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThanOrEqual(566);
  });
});

describe("recordVoteOnChain", () => {
  beforeEach(() => {
    vi.stubEnv("SOLANA_SIGNER_PRIVATE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when SOLANA_SIGNER_PRIVATE_KEY is not set", async () => {
    delete process.env.SOLANA_SIGNER_PRIVATE_KEY;
    const result = await recordVoteOnChain(sampleData);
    expect(result).toBeNull();
  });

  it("returns null when SOLANA_SIGNER_PRIVATE_KEY is empty string", async () => {
    process.env.SOLANA_SIGNER_PRIVATE_KEY = "";
    const result = await recordVoteOnChain(sampleData);
    expect(result).toBeNull();
  });
});
