import { describe, it, expect } from "vitest";
import { computePositionPnL } from "../agents/runner";

describe("computePositionPnL", () => {
  // ------ Long positions ------

  it("long position with price increase", () => {
    const result = computePositionPnL("long", 100, 110, 10, 1000);
    expect(result.unrealizedPnl).toBe(100); // (110 - 100) * 10
    expect(result.unrealizedPnlPct).toBe(10); // (100 / 1000) * 100
    expect(result.markToMarketValue).toBe(1100); // 110 * 10
  });

  it("long position with price decrease", () => {
    const result = computePositionPnL("long", 100, 90, 10, 1000);
    expect(result.unrealizedPnl).toBe(-100); // (90 - 100) * 10
    expect(result.unrealizedPnlPct).toBe(-10);
    expect(result.markToMarketValue).toBe(900); // 90 * 10
  });

  it("long position with no price change", () => {
    const result = computePositionPnL("long", 50, 50, 20, 1000);
    expect(result.unrealizedPnl).toBe(0);
    expect(result.unrealizedPnlPct).toBe(0);
    expect(result.markToMarketValue).toBe(1000);
  });

  // ------ Short positions ------

  it("short position with price decrease (profit)", () => {
    const result = computePositionPnL("short", 100, 80, 10, 1000);
    expect(result.unrealizedPnl).toBe(200); // (100 - 80) * 10
    expect(result.unrealizedPnlPct).toBe(20);
    expect(result.markToMarketValue).toBe(1200); // 1000 + 200
  });

  it("short position with price increase (loss)", () => {
    const result = computePositionPnL("short", 100, 120, 10, 1000);
    expect(result.unrealizedPnl).toBe(-200); // (100 - 120) * 10
    expect(result.unrealizedPnlPct).toBe(-20);
    expect(result.markToMarketValue).toBe(800); // 1000 + (-200)
  });

  it("short position with no price change", () => {
    const result = computePositionPnL("short", 100, 100, 10, 1000);
    expect(result.unrealizedPnl).toBe(0);
    expect(result.unrealizedPnlPct).toBe(0);
    expect(result.markToMarketValue).toBe(1000);
  });

  // ------ Edge cases ------

  it("handles zero amountUsdc without division error", () => {
    const result = computePositionPnL("long", 100, 150, 5, 0);
    expect(result.unrealizedPnl).toBe(250);
    expect(result.unrealizedPnlPct).toBe(0); // 0 division guard
    expect(result.markToMarketValue).toBe(750);
  });

  it("handles fractional prices (crypto)", () => {
    const result = computePositionPnL("long", 0.001, 0.0015, 1000000, 1000);
    expect(result.unrealizedPnl).toBeCloseTo(500);
    expect(result.unrealizedPnlPct).toBeCloseTo(50);
    expect(result.markToMarketValue).toBeCloseTo(1500);
  });

  it("handles very large prices (BTC-like)", () => {
    const result = computePositionPnL("long", 60000, 65000, 0.1, 6000);
    expect(result.unrealizedPnl).toBeCloseTo(500);
    expect(result.unrealizedPnlPct).toBeCloseTo(8.3333, 2);
    expect(result.markToMarketValue).toBeCloseTo(6500);
  });
});
