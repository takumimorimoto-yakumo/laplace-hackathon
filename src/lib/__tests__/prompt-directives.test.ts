import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../agents/prompt-builder";
import type { Agent } from "../types";

const baseAgent: Agent = {
  id: "test-user-001",
  name: "User Test Agent",
  style: "swing",
  modules: ["defi", "technical"],
  llm: "deepseek",
  accuracy: 0.7,
  rank: 15,
  totalVotes: 500,
  trend: "stable",
  portfolioValue: 10000,
  portfolioReturn: 0.1,
  bio: "Test bio",
  personality: "Test personality",
  outlook: "bullish",
  voiceStyle: "analytical",
  temperature: 0.5,
  cycleIntervalMinutes: 60,
  isSystem: false,
  tier: "user",
  ownerWallet: "wallet123",
  template: "swing_trader",
  totalPredictions: 0,
  isPaused: false,
  totalVotesGiven: 0,
  followerCount: 0,
  followingCount: 0,
  replyCount: 0,
  rentalPriceUsdc: 9.99,
  liveTradingEnabled: false,
  return24h: 0,
  return7d: 0,
  return30d: 0,
};

describe("buildSystemPrompt — user agent directives", () => {
  it("includes strategic directives for user-tier agent", () => {
    const agent: Agent = {
      ...baseAgent,
      userDirectives: "Focus on large-cap DeFi tokens only",
    };
    const prompt = buildSystemPrompt(agent, []);
    expect(prompt).toContain("Your Coach's Strategic Directives");
    expect(prompt).toContain("Focus on large-cap DeFi tokens only");
  });

  it("includes priority watchlist for user-tier agent", () => {
    const agent: Agent = {
      ...baseAgent,
      customWatchlist: ["SOL", "JUP", "RAY"],
    };
    const prompt = buildSystemPrompt(agent, []);
    expect(prompt).toContain("Priority Watchlist");
    expect(prompt).toContain("SOL, JUP, RAY");
  });

  it("includes intelligence from coach for user-tier agent", () => {
    const agent: Agent = {
      ...baseAgent,
      userAlpha: "Insider info: major protocol upgrade coming for JUP next week",
    };
    const prompt = buildSystemPrompt(agent, []);
    expect(prompt).toContain("Intelligence from Your Coach");
    expect(prompt).toContain(
      "Insider info: major protocol upgrade coming for JUP next week"
    );
    expect(prompt).toContain("Verify against your data sources");
  });

  it("includes all three directive sections when all are present", () => {
    const agent: Agent = {
      ...baseAgent,
      userDirectives: "Be aggressive on dips",
      customWatchlist: ["SOL", "BONK"],
      userAlpha: "Whale accumulation detected on BONK",
    };
    const prompt = buildSystemPrompt(agent, []);
    expect(prompt).toContain("Your Coach's Strategic Directives");
    expect(prompt).toContain("Be aggressive on dips");
    expect(prompt).toContain("Priority Watchlist");
    expect(prompt).toContain("SOL, BONK");
    expect(prompt).toContain("Intelligence from Your Coach");
    expect(prompt).toContain("Whale accumulation detected on BONK");
  });

  it("includes directive sections for system-tier agent with admin labels", () => {
    const systemAgent: Agent = {
      ...baseAgent,
      tier: "system",
      isSystem: true,
      userDirectives: "Focus on macro trends",
      customWatchlist: ["SOL"],
      userAlpha: "Fed meeting next week",
    };
    const prompt = buildSystemPrompt(systemAgent, []);
    expect(prompt).toContain("Admin Configuration Overrides");
    expect(prompt).toContain("Focus on macro trends");
    expect(prompt).toContain("Priority Watchlist");
    expect(prompt).toContain("SOL");
    expect(prompt).toContain("Admin Intelligence");
    expect(prompt).toContain("Fed meeting next week");
    // Should NOT use user-tier labels
    expect(prompt).not.toContain("Your Coach's Strategic Directives");
    expect(prompt).not.toContain("Intelligence from Your Coach");
  });

  it("includes directive sections for external-tier agent with admin labels", () => {
    const externalAgent: Agent = {
      ...baseAgent,
      tier: "external",
      userDirectives: "Watch DeFi protocols",
    };
    const prompt = buildSystemPrompt(externalAgent, []);
    expect(prompt).toContain("Admin Configuration Overrides");
    expect(prompt).toContain("Watch DeFi protocols");
    expect(prompt).not.toContain("Your Coach's Strategic Directives");
  });

  it("omits empty directives sections gracefully", () => {
    const agent: Agent = {
      ...baseAgent,
      // No userDirectives, customWatchlist, or userAlpha set
    };
    const prompt = buildSystemPrompt(agent, []);
    expect(prompt).not.toContain("Your Coach's Strategic Directives");
    expect(prompt).not.toContain("Priority Watchlist");
    expect(prompt).not.toContain("Intelligence from Your Coach");
  });

  it("omits empty watchlist array", () => {
    const agent: Agent = {
      ...baseAgent,
      customWatchlist: [],
    };
    const prompt = buildSystemPrompt(agent, []);
    expect(prompt).not.toContain("Priority Watchlist");
  });

  it("always includes Three Laws and agent identity", () => {
    const prompt = buildSystemPrompt(baseAgent, []);
    expect(prompt).toContain("Three Laws");
    expect(prompt).toContain(baseAgent.name);
    expect(prompt).toContain("Available Tokens");
  });
});
