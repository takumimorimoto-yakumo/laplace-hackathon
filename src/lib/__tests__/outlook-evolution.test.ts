import { describe, it, expect } from "vitest";
import { evolveOutlook } from "@/lib/agents/outlook-evolution";
import type { PredictionRecord, OutlookInput } from "@/lib/agents/outlook-evolution";

function makePred(
  direction: "bullish" | "bearish",
  correct: boolean,
  daysAgo = 0
): PredictionRecord {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    direction,
    directionScore: correct ? 1 : 0,
    resolvedAt: d.toISOString(),
  };
}

function makeInput(
  overrides: Partial<OutlookInput> & { predictions: PredictionRecord[] }
): OutlookInput {
  return {
    currentOutlook: "bullish",
    portfolioReturn: 0,
    ...overrides,
  };
}

describe("evolveOutlook", () => {
  it("returns unchanged when insufficient data", () => {
    const result = evolveOutlook(
      makeInput({ predictions: [makePred("bullish", true)] })
    );
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("insufficient_data");
    expect(result.newOutlook).toBe("bullish");
  });

  it("returns unchanged with exactly 4 predictions", () => {
    const preds = Array.from({ length: 4 }, () => makePred("bullish", true));
    const result = evolveOutlook(makeInput({ predictions: preds }));
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("insufficient_data");
  });

  it("starts evolving at 5 predictions", () => {
    const preds = Array.from({ length: 5 }, () => makePred("bullish", true));
    const result = evolveOutlook(makeInput({ predictions: preds }));
    // All bullish and correct → should want to shift ultra_bullish
    expect(result.bullishAccuracy).toBeGreaterThan(0.9);
    expect(result.score).toBeGreaterThan(0);
  });

  it("shifts bearish agent toward neutral when bullish calls succeed", () => {
    const preds = [
      ...Array.from({ length: 5 }, () => makePred("bullish", true)),
      ...Array.from({ length: 3 }, () => makePred("bearish", false)),
    ];
    const result = evolveOutlook(
      makeInput({ currentOutlook: "bearish", predictions: preds })
    );
    // Bullish calls all correct, bearish all wrong → strong bullish signal
    // One step from bearish = neutral
    expect(result.newOutlook).toBe("neutral");
    expect(result.changed).toBe(true);
  });

  it("shifts bullish agent toward neutral when bearish calls succeed", () => {
    const preds = [
      ...Array.from({ length: 5 }, () => makePred("bearish", true)),
      ...Array.from({ length: 3 }, () => makePred("bullish", false)),
    ];
    const result = evolveOutlook(
      makeInput({ currentOutlook: "bullish", predictions: preds })
    );
    // One step from bullish = neutral
    expect(result.newOutlook).toBe("neutral");
    expect(result.changed).toBe(true);
  });

  it("only shifts one step at a time", () => {
    // Ultra bullish agent with all bearish calls correct
    const preds = Array.from({ length: 10 }, () => makePred("bearish", true));
    const result = evolveOutlook(
      makeInput({ currentOutlook: "ultra_bullish", predictions: preds })
    );
    // Should only shift one step: ultra_bullish → bullish (not neutral or bearish)
    expect(result.newOutlook).toBe("bullish");
  });

  it("stays in dead zone when score is near zero", () => {
    // Equal mix of correct bullish and correct bearish
    const preds = [
      ...Array.from({ length: 5 }, () => makePred("bullish", true)),
      ...Array.from({ length: 5 }, () => makePred("bearish", true)),
    ];
    const result = evolveOutlook(makeInput({ predictions: preds }));
    expect(result.changed).toBe(false);
    expect(Math.abs(result.score)).toBeLessThan(0.2);
  });

  it("portfolio return influences the score", () => {
    // Mixed accuracy but strong positive portfolio
    const preds = [
      ...Array.from({ length: 3 }, () => makePred("bullish", true)),
      ...Array.from({ length: 3 }, () => makePred("bearish", true)),
    ];
    const withGain = evolveOutlook(
      makeInput({ predictions: preds, portfolioReturn: 0.5 })
    );
    const withLoss = evolveOutlook(
      makeInput({ predictions: preds, portfolioReturn: -0.5 })
    );
    expect(withGain.score).toBeGreaterThan(withLoss.score);
  });

  it("recent predictions weigh more than old ones", () => {
    // Recent: bearish correct. Old: bearish wrong.
    // Recency weighting should make accuracy higher than simple average
    const preds = [
      ...Array.from({ length: 3 }, (_, i) => makePred("bearish", true, i)),       // recent, correct
      ...Array.from({ length: 3 }, (_, i) => makePred("bearish", false, i + 25)), // old, wrong
      ...Array.from({ length: 2 }, () => makePred("bullish", false, 1)),           // recent bullish wrong
    ];
    const result = evolveOutlook(makeInput({ predictions: preds }));
    // Recent bearish success + recent bullish failure → bearish signal
    expect(result.score).toBeLessThan(0);
  });

  it("handles only bullish predictions", () => {
    const preds = Array.from({ length: 6 }, () => makePred("bullish", true));
    const result = evolveOutlook(makeInput({ predictions: preds }));
    expect(result.bullishAccuracy).toBeGreaterThan(0.9);
    expect(result.bearishAccuracy).toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });

  it("handles only bearish predictions", () => {
    const preds = Array.from({ length: 6 }, () => makePred("bearish", true));
    const result = evolveOutlook(
      makeInput({ currentOutlook: "bearish", predictions: preds })
    );
    expect(result.bearishAccuracy).toBeGreaterThan(0.9);
    expect(result.bullishAccuracy).toBeNull();
    expect(result.score).toBeLessThan(0);
  });

  it("does not change ultra_bearish when already at target", () => {
    const preds = Array.from({ length: 10 }, () => makePred("bearish", true));
    const result = evolveOutlook(
      makeInput({ currentOutlook: "ultra_bearish", predictions: preds })
    );
    expect(result.newOutlook).toBe("ultra_bearish");
    expect(result.changed).toBe(false);
  });
});
