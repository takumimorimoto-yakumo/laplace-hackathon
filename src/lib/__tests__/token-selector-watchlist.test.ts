import { describe, it, expect } from "vitest";
import { selectTokensForAgent } from "../agents/token-selector";
import type { Agent } from "../types";
import type { RealMarketData } from "../agents/prompt-builder";

// ---------- Mock Data ----------

function makeMockToken(overrides: Partial<RealMarketData>): RealMarketData {
  return {
    symbol: "TEST",
    address: "test-address",
    price: 1.0,
    change24h: 0,
    volume24h: 1_000_000,
    tvl: null,
    marketCap: null,
    coingeckoId: "test",
    name: "Test Token",
    volumeRank: 50,
    marketCapRank: 50,
    volatility24h: 0.05,
    sparkline7d: [],
    ...overrides,
  };
}

const mockTokens: RealMarketData[] = [
  makeMockToken({ symbol: "SOL", name: "Solana", address: "sol-addr", volume24h: 500_000_000, marketCap: 80_000_000_000 }),
  makeMockToken({ symbol: "JUP", name: "Jupiter", address: "jup-addr", volume24h: 100_000_000, marketCap: 2_000_000_000 }),
  makeMockToken({ symbol: "RAY", name: "Raydium", address: "ray-addr", volume24h: 50_000_000, marketCap: 500_000_000 }),
  makeMockToken({ symbol: "BONK", name: "Bonk", address: "bonk-addr", volume24h: 200_000_000, marketCap: 1_000_000_000, volatility24h: 0.15 }),
  makeMockToken({ symbol: "ORCA", name: "Orca", address: "orca-addr", volume24h: 30_000_000, marketCap: 300_000_000 }),
  makeMockToken({ symbol: "MNGO", name: "Mango", address: "mngo-addr", volume24h: 1_000_000, marketCap: 10_000_000 }),
  makeMockToken({ symbol: "DRIFT", name: "Drift", address: "drift-addr", volume24h: 20_000_000, marketCap: 200_000_000 }),
  makeMockToken({ symbol: "PYTH", name: "Pyth", address: "pyth-addr", volume24h: 40_000_000, marketCap: 400_000_000 }),
  makeMockToken({ symbol: "MARINADE", name: "Marinade", address: "msol-addr", volume24h: 15_000_000, marketCap: 150_000_000 }),
  makeMockToken({ symbol: "JITO", name: "Jito", address: "jito-addr", volume24h: 80_000_000, marketCap: 1_500_000_000 }),
  makeMockToken({ symbol: "WEN", name: "Wen", address: "wen-addr", volume24h: 10_000_000, marketCap: 100_000_000 }),
  makeMockToken({ symbol: "POPCAT", name: "Popcat", address: "popcat-addr", volume24h: 8_000_000, marketCap: 80_000_000 }),
  makeMockToken({ symbol: "RENDER", name: "Render", address: "render-addr", volume24h: 60_000_000, marketCap: 3_000_000_000 }),
  makeMockToken({ symbol: "HNT", name: "Helium", address: "hnt-addr", volume24h: 25_000_000, marketCap: 700_000_000 }),
  makeMockToken({ symbol: "STEP", name: "Step Finance", address: "step-addr", volume24h: 500_000, marketCap: 5_000_000 }),
  // Extra tokens to ensure there's competition for selection (need > 15 to make selection meaningful)
  makeMockToken({ symbol: "ATLAS", name: "Star Atlas", address: "atlas-addr", volume24h: 12_000_000, marketCap: 120_000_000 }),
  makeMockToken({ symbol: "SAMO", name: "Samoyedcoin", address: "samo-addr", volume24h: 7_000_000, marketCap: 70_000_000 }),
  makeMockToken({ symbol: "MEAN", name: "Mean Finance", address: "mean-addr", volume24h: 4_000_000, marketCap: 40_000_000 }),
  makeMockToken({ symbol: "SBR", name: "Saber", address: "sbr-addr", volume24h: 6_000_000, marketCap: 60_000_000 }),
  makeMockToken({ symbol: "TULIP", name: "Tulip", address: "tulip-addr", volume24h: 3_500_000, marketCap: 35_000_000 }),
  makeMockToken({ symbol: "COPE", name: "Cope", address: "cope-addr", volume24h: 2_000_000, marketCap: 20_000_000 }),
  makeMockToken({ symbol: "SLIM", name: "Solanium", address: "slim-addr", volume24h: 1_500_000, marketCap: 15_000_000 }),
  makeMockToken({ symbol: "FIDA", name: "Bonfida", address: "fida-addr", volume24h: 9_000_000, marketCap: 90_000_000 }),
  makeMockToken({ symbol: "PORT", name: "Port Finance", address: "port-addr", volume24h: 2_500_000, marketCap: 25_000_000 }),
  makeMockToken({ symbol: "SRM", name: "Serum", address: "srm-addr", volume24h: 11_000_000, marketCap: 110_000_000 }),
];

const baseAgent: Agent = {
  id: "test-agent-001",
  name: "Watchlist Test Agent",
  style: "swing",
  modules: ["defi", "technical"],
  llm: "deepseek",
  accuracy: 0.7,
  rank: 10,
  totalVotes: 500,
  trend: "stable",
  portfolioValue: 10000,
  portfolioReturn: 0.1,
  bio: "Test",
  personality: "Test",
  outlook: "bullish",
  voiceStyle: "analytical",
  temperature: 0.5,
  cycleIntervalMinutes: 60,
  isSystem: false,
  tier: "user",
  totalPredictions: 0,
  isPaused: false,
  totalVotesGiven: 0,
  followerCount: 0,
  followingCount: 0,
  replyCount: 0,
  rentalPriceUsdc: 9.99,
  liveTradingEnabled: false,
};

describe("selectTokensForAgent — watchlist boost", () => {
  it("includes watchlist tokens in the selection", () => {
    const agent: Agent = {
      ...baseAgent,
      customWatchlist: ["MNGO", "STEP"],
    };

    // Run selection multiple times to verify high probability
    let mngoFound = 0;
    let stepFound = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      const selected = selectTokensForAgent(mockTokens, agent, 15);
      const symbols = selected.map((t) => t.symbol);
      if (symbols.includes("MNGO")) mngoFound++;
      if (symbols.includes("STEP")) stepFound++;
    }

    // With 50% watchlist boost, these low-volume tokens should appear most of the time
    expect(mngoFound).toBeGreaterThan(runs * 0.7);
    expect(stepFound).toBeGreaterThan(runs * 0.7);
  });

  it("watchlist tokens appear more often than without watchlist (control comparison)", () => {
    const agentWithWatchlist: Agent = {
      ...baseAgent,
      customWatchlist: ["MNGO", "STEP"],
    };
    const agentWithout: Agent = {
      ...baseAgent,
      // No customWatchlist
    };

    let withWatchlistCount = 0;
    let withoutWatchlistCount = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      const withList = selectTokensForAgent(mockTokens, agentWithWatchlist, 15);
      const withoutList = selectTokensForAgent(mockTokens, agentWithout, 15);

      const withSymbols = withList.map((t) => t.symbol);
      const withoutSymbols = withoutList.map((t) => t.symbol);

      if (withSymbols.includes("MNGO")) withWatchlistCount++;
      if (withoutSymbols.includes("MNGO")) withoutWatchlistCount++;
    }

    // Watchlist boost should cause MNGO to appear more often
    expect(withWatchlistCount).toBeGreaterThanOrEqual(withoutWatchlistCount);
  });

  it("watchlist boost is case-insensitive", () => {
    const agent: Agent = {
      ...baseAgent,
      customWatchlist: ["mngo", "step"],
    };

    let mngoFound = 0;
    const runs = 30;

    for (let i = 0; i < runs; i++) {
      const selected = selectTokensForAgent(mockTokens, agent, 15);
      const symbols = selected.map((t) => t.symbol);
      if (symbols.includes("MNGO")) mngoFound++;
    }

    // Should still get a significant boost even with lowercase watchlist
    expect(mngoFound).toBeGreaterThan(runs * 0.5);
  });

  it("returns correct number of tokens", () => {
    const agent: Agent = {
      ...baseAgent,
      customWatchlist: ["SOL", "JUP"],
    };

    const selected = selectTokensForAgent(mockTokens, agent, 15);
    expect(selected).toHaveLength(15);
  });

  it("handles empty watchlist same as no watchlist", () => {
    const agentWithEmpty: Agent = {
      ...baseAgent,
      customWatchlist: [],
    };

    const agentWithout: Agent = {
      ...baseAgent,
    };

    // Both should produce valid selections
    const selected1 = selectTokensForAgent(mockTokens, agentWithEmpty, 15);
    const selected2 = selectTokensForAgent(mockTokens, agentWithout, 15);

    expect(selected1).toHaveLength(15);
    expect(selected2).toHaveLength(15);
  });
});
