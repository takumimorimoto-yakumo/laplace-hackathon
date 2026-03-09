import { describe, it, expect } from "vitest";
import { resolutionCutoffMs, marketDeadlineMs } from "../agents/time-horizon";

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
