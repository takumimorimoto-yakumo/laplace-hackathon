import { describe, it, expect } from "vitest";
import {
  generatePortfolioHistory,
  generateAccuracyHistory,
  computePredictionStats,
  computeRentalPlan,
} from "../agent-stats";
import type { Agent } from "../types";

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
  voiceStyle: "analytical",
  temperature: 0.4,
  cycleIntervalMinutes: 60,
  isSystem: true,
};

describe("generatePortfolioHistory", () => {
  it("returns 30 snapshots", () => {
    const snapshots = generatePortfolioHistory(mockAgent);
    expect(snapshots).toHaveLength(30);
  });

  it("last snapshot value equals agent portfolioValue", () => {
    const snapshots = generatePortfolioHistory(mockAgent);
    expect(snapshots[snapshots.length - 1].value).toBe(mockAgent.portfolioValue);
  });

  it("every snapshot has a date string", () => {
    const snapshots = generatePortfolioHistory(mockAgent);
    for (const s of snapshots) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("values are positive numbers", () => {
    const snapshots = generatePortfolioHistory(mockAgent);
    for (const s of snapshots) {
      expect(s.value).toBeGreaterThan(0);
    }
  });
});

describe("generateAccuracyHistory", () => {
  it("returns 30 snapshots", () => {
    const snapshots = generateAccuracyHistory(mockAgent);
    expect(snapshots).toHaveLength(30);
  });

  it("last snapshot accuracy equals agent accuracy", () => {
    const snapshots = generateAccuracyHistory(mockAgent);
    expect(snapshots[snapshots.length - 1].accuracy).toBe(mockAgent.accuracy);
  });

  it("all accuracy values are between 0.4 and 0.95", () => {
    const snapshots = generateAccuracyHistory(mockAgent);
    for (const s of snapshots) {
      expect(s.accuracy).toBeGreaterThanOrEqual(0.4);
      expect(s.accuracy).toBeLessThanOrEqual(0.95);
    }
  });
});

describe("computePredictionStats", () => {
  it("returns correct total predictions", () => {
    const stats = computePredictionStats(mockAgent);
    expect(stats.totalPredictions).toBe(Math.round(mockAgent.totalVotes / 20));
  });

  it("returns correct predictions based on accuracy", () => {
    const stats = computePredictionStats(mockAgent);
    const expectedCorrect = Math.round(stats.totalPredictions * mockAgent.accuracy);
    expect(stats.correctPredictions).toBe(expectedCorrect);
  });

  it("calibration score is within valid range", () => {
    const stats = computePredictionStats(mockAgent);
    expect(stats.calibrationScore).toBeGreaterThan(0);
    expect(stats.calibrationScore).toBeLessThanOrEqual(1);
  });

  it("totalVotesEarned matches agent totalVotes", () => {
    const stats = computePredictionStats(mockAgent);
    expect(stats.totalVotesEarned).toBe(mockAgent.totalVotes);
  });
});

describe("computeRentalPlan", () => {
  it("top-3 agent gets highest price", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.monthlyPriceUsdc).toBe(49.99);
  });

  it("mid-rank agent gets mid price", () => {
    const plan = computeRentalPlan({ ...mockAgent, rank: 5 });
    expect(plan.monthlyPriceUsdc).toBe(29.99);
  });

  it("low-rank agent gets lowest price", () => {
    const plan = computeRentalPlan({ ...mockAgent, rank: 8 });
    expect(plan.monthlyPriceUsdc).toBe(19.99);
  });

  it("plan has correct agentId", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.agentId).toBe(mockAgent.id);
  });

  it("plan has 4 benefits", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.benefits).toHaveLength(4);
  });

  it("plan has SKR discount", () => {
    const plan = computeRentalPlan(mockAgent);
    expect(plan.skrDiscountPercent).toBe(10);
  });
});
