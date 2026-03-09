import { describe, it, expect } from "vitest";
import {
  resolutionCutoffMs,
  marketDeadlineMs,
  positionExpiryMs,
  memoryLimits,
} from "../agents/time-horizon";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("resolutionCutoffMs", () => {
  it("returns 4h for scalp", () => {
    expect(resolutionCutoffMs("scalp")).toBe(4 * HOUR);
  });

  it("returns 24h for intraday", () => {
    expect(resolutionCutoffMs("intraday")).toBe(24 * HOUR);
  });

  it("returns 3d for swing", () => {
    expect(resolutionCutoffMs("swing")).toBe(3 * DAY);
  });

  it("returns 14d for position", () => {
    expect(resolutionCutoffMs("position")).toBe(14 * DAY);
  });

  it("returns 30d for long_term", () => {
    expect(resolutionCutoffMs("long_term")).toBe(30 * DAY);
  });

  // Legacy compatibility
  it("returns 3d for legacy 'days'", () => {
    expect(resolutionCutoffMs("days")).toBe(3 * DAY);
  });

  it("returns 14d for legacy 'weeks'", () => {
    expect(resolutionCutoffMs("weeks")).toBe(14 * DAY);
  });

  it("returns 30d for legacy 'months'", () => {
    expect(resolutionCutoffMs("months")).toBe(30 * DAY);
  });

  // Fallback
  it("returns 3d for unknown values", () => {
    expect(resolutionCutoffMs("unknown")).toBe(3 * DAY);
  });

  it("returns 3d for empty string", () => {
    expect(resolutionCutoffMs("")).toBe(3 * DAY);
  });
});

describe("marketDeadlineMs", () => {
  it("returns 4h for scalp", () => {
    expect(marketDeadlineMs("scalp")).toBe(4 * HOUR);
  });

  it("returns 24h for intraday", () => {
    expect(marketDeadlineMs("intraday")).toBe(24 * HOUR);
  });

  it("returns 3d for swing", () => {
    expect(marketDeadlineMs("swing")).toBe(3 * DAY);
  });

  it("returns 14d for position", () => {
    expect(marketDeadlineMs("position")).toBe(14 * DAY);
  });

  it("returns 30d for long_term", () => {
    expect(marketDeadlineMs("long_term")).toBe(30 * DAY);
  });

  it("returns 3d when undefined", () => {
    expect(marketDeadlineMs(undefined)).toBe(3 * DAY);
  });
});

describe("positionExpiryMs", () => {
  it("returns 2x resolution cutoff for each horizon", () => {
    expect(positionExpiryMs("scalp")).toBe(8 * HOUR);
    expect(positionExpiryMs("intraday")).toBe(48 * HOUR);
    expect(positionExpiryMs("swing")).toBe(6 * DAY);
    expect(positionExpiryMs("position")).toBe(28 * DAY);
    expect(positionExpiryMs("long_term")).toBe(60 * DAY);
  });

  it("falls back to swing (6d) for unknown values", () => {
    expect(positionExpiryMs("unknown")).toBe(6 * DAY);
  });
});

describe("memoryLimits", () => {
  it("returns shallow limits for scalp", () => {
    expect(memoryLimits("scalp")).toEqual({ predictions: 8, trades: 8, bookmarks: 2 });
  });

  it("returns moderate limits for swing", () => {
    expect(memoryLimits("swing")).toEqual({ predictions: 10, trades: 8, bookmarks: 3 });
  });

  it("returns deep limits for long_term", () => {
    expect(memoryLimits("long_term")).toEqual({ predictions: 20, trades: 12, bookmarks: 5 });
  });

  it("returns position limits", () => {
    expect(memoryLimits("position")).toEqual({ predictions: 15, trades: 10, bookmarks: 5 });
  });

  it("returns intraday limits", () => {
    expect(memoryLimits("intraday")).toEqual({ predictions: 8, trades: 8, bookmarks: 3 });
  });

  it("falls back to swing defaults for undefined", () => {
    expect(memoryLimits(undefined)).toEqual({ predictions: 10, trades: 8, bookmarks: 3 });
  });

  it("falls back to swing defaults for unknown values", () => {
    expect(memoryLimits("unknown")).toEqual({ predictions: 10, trades: 8, bookmarks: 3 });
  });
});
