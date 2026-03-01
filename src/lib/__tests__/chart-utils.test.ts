import { describe, it, expect } from "vitest";
import {
  mapPriceToCoordinates,
  findEntryPointCoordinate,
  coordinatesToPolyline,
  coordinatesToAreaPath,
} from "../chart-utils";

// -------------------------------------------------------
// mapPriceToCoordinates
// -------------------------------------------------------
describe("mapPriceToCoordinates", () => {
  it("returns empty array for empty data", () => {
    expect(mapPriceToCoordinates([], 200, 100, 0, 0)).toEqual([]);
  });

  it("returns single centered point for single data point", () => {
    const result = mapPriceToCoordinates([100], 200, 100, 10, 10);
    expect(result).toHaveLength(1);
    // center of inner width: padX + innerWidth / 2 = 10 + (200-20)/2 = 10 + 90 = 100
    expect(result[0].x).toBe(100);
    // center of height: height / 2 = 50
    expect(result[0].y).toBe(50);
  });

  it("maps two points to endpoints", () => {
    const result = mapPriceToCoordinates([0, 100], 200, 100, 0, 0);
    expect(result).toHaveLength(2);
    // First point: x=0, y=100 (bottom, value 0 = min)
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(100);
    // Second point: x=200, y=0 (top, value 100 = max)
    expect(result[1].x).toBe(200);
    expect(result[1].y).toBe(0);
  });

  it("respects padding", () => {
    const result = mapPriceToCoordinates([0, 100], 200, 100, 20, 10);
    expect(result).toHaveLength(2);
    // First: x = padX = 20, y = padY + innerHeight = 10 + 80 = 90
    expect(result[0].x).toBe(20);
    expect(result[0].y).toBe(90);
    // Second: x = padX + innerWidth = 20 + 160 = 180, y = padY = 10
    expect(result[1].x).toBe(180);
    expect(result[1].y).toBe(10);
  });

  it("handles all-same-values gracefully", () => {
    const result = mapPriceToCoordinates([50, 50, 50], 100, 50, 0, 0);
    expect(result).toHaveLength(3);
    // No NaN values
    for (const point of result) {
      expect(Number.isNaN(point.x)).toBe(false);
      expect(Number.isNaN(point.y)).toBe(false);
    }
    // All y values should be the same (range defaults to 1)
    expect(result[0].y).toBe(result[1].y);
    expect(result[1].y).toBe(result[2].y);
  });
});

// -------------------------------------------------------
// findEntryPointCoordinate
// -------------------------------------------------------
describe("findEntryPointCoordinate", () => {
  it("hoursAgo=0 maps to rightmost point", () => {
    const result = findEntryPointCoordinate(0, 100, 48, 90, 110, 200, 100, 0, 0);
    expect(result.x).toBe(200);
  });

  it("hoursAgo at dataLength-1 maps to leftmost", () => {
    const result = findEntryPointCoordinate(47, 100, 48, 90, 110, 200, 100, 0, 0);
    expect(result.x).toBe(0);
  });

  it("price at min maps to bottom", () => {
    const result = findEntryPointCoordinate(0, 90, 48, 90, 110, 200, 100, 0, 0);
    expect(result.y).toBe(100);
  });

  it("price at max maps to top", () => {
    const result = findEntryPointCoordinate(0, 110, 48, 90, 110, 200, 100, 0, 0);
    expect(result.y).toBe(0);
  });

  it("clamps price outside range", () => {
    // Price above max => clamped to top (y=0)
    const above = findEntryPointCoordinate(0, 120, 48, 90, 110, 200, 100, 0, 0);
    expect(above.y).toBe(0);
    // Price below min => clamped to bottom (y=100)
    const below = findEntryPointCoordinate(0, 80, 48, 90, 110, 200, 100, 0, 0);
    expect(below.y).toBe(100);
  });
});

// -------------------------------------------------------
// coordinatesToPolyline
// -------------------------------------------------------
describe("coordinatesToPolyline", () => {
  it("converts coordinates to SVG string", () => {
    const result = coordinatesToPolyline([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ]);
    expect(result).toBe("0.0,0.0 10.0,20.0");
  });

  it("handles empty array", () => {
    expect(coordinatesToPolyline([])).toBe("");
  });
});

// -------------------------------------------------------
// coordinatesToAreaPath
// -------------------------------------------------------
describe("coordinatesToAreaPath", () => {
  it("creates closed area path", () => {
    const coords = [
      { x: 0, y: 10 },
      { x: 50, y: 5 },
      { x: 100, y: 15 },
    ];
    const result = coordinatesToAreaPath(coords, 50);
    expect(result).toMatch(/^M 0\.0 10\.0/);
    expect(result).toMatch(/Z$/);
    // Should include baseline points
    expect(result).toContain("L 100.0 50.0");
    expect(result).toContain("L 0.0 50.0");
  });

  it("handles empty array", () => {
    expect(coordinatesToAreaPath([], 50)).toBe("");
  });
});
