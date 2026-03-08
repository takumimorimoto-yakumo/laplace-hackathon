import { describe, it, expect } from "vitest";
import {
  computePredictionStats,
  computeRentalPlan,
} from "../agent-stats";
import type { Agent } from "../types";
import type { ResolvedPrediction } from "../supabase/queries";

const mockAgent: Agent = {
  id: "agent-001",
  name: "DeFi Yield Hunter",
  style: "swing",
  modules: ["defi", "risk"],
  llm: "claude-sonnet",
  accuracy: 0.81,
  rank: 1,
  totalVotes: 2841,
  trend: "streak",
  portfolioValue: 14230,
  portfolioReturn: 0.423,
  bio: "Test agent",
  personality: "Test",
  outlook: "bullish",
  voiceStyle: "analytical",
  temperature: 0.4,
  cycleIntervalMinutes: 60,
  isSystem: true,
  tier: "system",
  totalPredictions: 0,
  isPaused: false,
  totalVotesGiven: 0,
  followerCount: 0,
  followingCount: 0,
  replyCount: 0,
  rentalPriceUsdc: 9.99,
  liveTradingEnabled: false,
};

const mockPredictions: ResolvedPrediction[] = [
  {
    id: "p1",
    tokenSymbol: "SOL",
    direction: "bullish",
    confidence: 0.8,
    priceAtPrediction: 100,
    priceAtResolution: 110,
    outcome: "correct",
    directionScore: 1.0,
    calibrationScore: 0.85,
    finalScore: 85,
    resolvedAt: "2026-03-01T00:00:00Z",
    txSignature: null,
  },
  {
    id: "p2",
    tokenSymbol: "JUP",
    direction: "bearish",
    confidence: 0.6,
    priceAtPrediction: 2.0,
    priceAtResolution: 2.1,
    outcome: "incorrect",
    directionScore: 0,
    calibrationScore: 0.5,
    finalScore: 15,
    resolvedAt: "2026-03-02T00:00:00Z",
    txSignature: null,
  },
];

describe("computePredictionStats", () => {
  it("returns correct total and correct predictions from real data", () => {
    const stats = computePredictionStats(mockPredictions, mockAgent);
    expect(stats.totalPredictions).toBe(2);
    expect(stats.correctPredictions).toBe(1);
  });

  it("computes average calibration score", () => {
    const stats = computePredictionStats(mockPredictions, mockAgent);
    expect(stats.calibrationScore).toBeCloseTo((0.85 + 0.5) / 2, 1);
  });

  it("returns zeros for empty predictions", () => {
    const stats = computePredictionStats([], mockAgent);
    expect(stats.totalPredictions).toBe(0);
    expect(stats.correctPredictions).toBe(0);
    expect(stats.calibrationScore).toBe(0);
  });

  it("totalVotesEarned matches agent totalVotes", () => {
    const stats = computePredictionStats(mockPredictions, mockAgent);
    expect(stats.totalVotesEarned).toBe(mockAgent.totalVotes);
  });
});

describe("computeRentalPlan", () => {
  it("uses agent rentalPriceUsdc for pricing", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.monthlyPriceUsdc).toBe(9.99);
  });

  it("uses custom rentalPriceUsdc value", () => {
    const plan = computeRentalPlan({ ...mockAgent, rentalPriceUsdc: 25.00 });
    expect(plan.monthlyPriceUsdc).toBe(25.00);
  });

  it("plan has correct agentId", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.agentId).toBe(mockAgent.id);
  });

  it("plan has 7 benefits", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.benefits).toHaveLength(7);
  });

  it("plan has SKR discount", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.skrDiscountPercent).toBe(10);
  });

  it("plan includes new premium benefits", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.benefits).toContain("rental.benefit.chat");
    expect(plan.benefits).toContain("rental.benefit.earlySignals");
    expect(plan.benefits).toContain("rental.benefit.customAnalysis");
  });
});
