import { describe, it, expect } from "vitest";
import {
  buildPerformanceMemo,
  serializePerformanceMemo,
} from "../solana/performance-recorder";
import type { AgentPerformanceData } from "../solana/performance-recorder";

const mockData: AgentPerformanceData = {
  agentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  agentName: "AlphaTrader",
  date: "2026-03-06",
  totalTrades: 42,
  wins: 28,
  losses: 14,
  winRate: 0.6667,
  portfolioValue: 12345.67,
  returnPct: 23.45,
  dailyPnl: 150.30,
  totalPredictions: 100,
  correctPredictions: 72,
  accuracy: 0.72,
  rank: 5,
};

describe("buildPerformanceMemo", () => {
  it("creates compact memo with correct fields", () => {
    const memo = buildPerformanceMemo(mockData);

    expect(memo.v).toBe(1);
    expect(memo.type).toBe("perf");
    expect(memo.aid).toBe("aaaaaaaa");
    expect(memo.name).toBe("AlphaTrader");
    expect(memo.d).toBe("2026-03-06");
    expect(memo.tt).toBe(42);
    expect(memo.w).toBe(28);
    expect(memo.l).toBe(14);
    expect(memo.wr).toBe(0.67);
    expect(memo.pv).toBe(12345.67);
    expect(memo.ret).toBe(23.45);
    expect(memo.dpnl).toBe(150.3);
    expect(memo.tp).toBe(100);
    expect(memo.cp).toBe(72);
    expect(memo.acc).toBe(0.72);
    expect(memo.rank).toBe(5);
    expect(memo.ts).toBeGreaterThan(0);
  });

  it("truncates agent name to 16 chars", () => {
    const longNameData = { ...mockData, agentName: "VeryLongAgentNameThatExceedsLimit" };
    const memo = buildPerformanceMemo(longNameData);
    expect(memo.name).toBe("VeryLongAgentNam");
  });

  it("truncates agent ID to 8 chars", () => {
    const memo = buildPerformanceMemo(mockData);
    expect(memo.aid.length).toBe(8);
  });
});

describe("serializePerformanceMemo", () => {
  it("serializes to valid JSON under 566 bytes", () => {
    const memo = buildPerformanceMemo(mockData);
    const json = serializePerformanceMemo(memo);

    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("perf");

    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThanOrEqual(566);
  });

  it("produces compact output", () => {
    const memo = buildPerformanceMemo(mockData);
    const json = serializePerformanceMemo(memo);
    // Should be well under 300 bytes for typical data
    const byteLength = new TextEncoder().encode(json).length;
    expect(byteLength).toBeLessThan(300);
  });
});
