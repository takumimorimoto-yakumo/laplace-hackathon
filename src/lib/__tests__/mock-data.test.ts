import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatChange,
  formatCompactNumber,
} from "../mock-data";
import { isProPicker } from "../agents/pro-picker";
import type { Agent } from "../types";

// -------------------------------------------------------
// Formatting helpers
// -------------------------------------------------------
describe("formatPrice", () => {
  it("formats prices >= 100 with 2 decimals", () => {
    expect(formatPrice(123.456)).toBe("$123.46");
  });

  it("formats prices < 100 with 2 decimals", () => {
    expect(formatPrice(45.678)).toBe("$45.68");
  });

  it("formats prices < 1 with 4 decimals", () => {
    expect(formatPrice(0.5678)).toBe("$0.5678");
  });

  it("formats very small prices with 7 decimals", () => {
    expect(formatPrice(0.0001234)).toBe("$0.0001234");
  });
});

describe("formatChange", () => {
  it("formats positive change with + sign", () => {
    expect(formatChange(5.3)).toBe("+5.3%");
  });

  it("formats negative change with - sign", () => {
    expect(formatChange(-3.2)).toBe("-3.2%");
  });

  it("formats zero change with + sign", () => {
    expect(formatChange(0)).toBe("+0.0%");
  });
});

describe("formatCompactNumber", () => {
  it("formats billions", () => {
    expect(formatCompactNumber(8_200_000_000)).toBe("$8.2B");
  });

  it("formats millions", () => {
    expect(formatCompactNumber(3_100_000)).toBe("$3M");
  });

  it("formats thousands", () => {
    expect(formatCompactNumber(14_230)).toBe("$14K");
  });

  it("formats small numbers", () => {
    expect(formatCompactNumber(500)).toBe("$500");
  });
});

// -------------------------------------------------------
// Pro Picker
// -------------------------------------------------------
describe("pro picker", () => {
  const highRankAgent: Agent = {
    id: "test-001", name: "Test Agent", style: "swing", modules: ["defi"],
    llm: "claude-sonnet", accuracy: 0.8, rank: 1, totalVotes: 1000,
    trend: "stable", portfolioValue: 10000, portfolioReturn: 0.1,
    bio: "Test", personality: "Test", outlook: "bullish", voiceStyle: "analytical",
    temperature: 0.5, cycleIntervalMinutes: 60, isSystem: true,
    totalVotesGiven: 0, followerCount: 0, followingCount: 0, replyCount: 0,
  };

  const lowAccuracyAgent: Agent = {
    ...highRankAgent, id: "test-002", accuracy: 0.5, rank: 10,
  };

  it("includes agents with high rank and accuracy", () => {
    expect(isProPicker(highRankAgent)).toBe(true);
  });

  it("excludes agents with accuracy below 60%", () => {
    expect(isProPicker(lowAccuracyAgent)).toBe(false);
  });

  it("excludes agents ranked above 10", () => {
    expect(isProPicker({ ...highRankAgent, rank: 11 })).toBe(false);
  });
});
