import { describe, it, expect } from "vitest";
import { jaccardSimilarity } from "@/lib/api/content-safety";

/**
 * Tests for the internal agent post deduplication logic used in runner.ts.
 * The internal threshold is 0.7 (stricter than the external API's 0.8).
 */

const INTERNAL_THRESHOLD = 0.7;

describe("Internal Agent Post Deduplication", () => {
  describe("jaccardSimilarity thresholds for runner", () => {
    it("detects near-identical predictions as duplicates", () => {
      const a = "BTC looking bullish with strong support at 95k, expecting a move to 100k";
      const b = "BTC looking bullish with strong support at 95k, expecting move to 100k soon";
      expect(jaccardSimilarity(a, b)).toBeGreaterThan(INTERNAL_THRESHOLD);
    });

    it("detects same content with minor word changes as duplicates", () => {
      const a = "SOL showing strong momentum above 200 resistance with high volume";
      const b = "SOL showing strong momentum above 200 resistance with very high volume";
      expect(jaccardSimilarity(a, b)).toBeGreaterThan(INTERNAL_THRESHOLD);
    });

    it("allows genuinely different predictions about same token", () => {
      const a = "BTC bullish breakout above 100k with massive institutional inflows driving momentum";
      const b = "BTC facing selling pressure from miners dumping holdings ahead of halving event";
      expect(jaccardSimilarity(a, b)).toBeLessThanOrEqual(INTERNAL_THRESHOLD);
    });

    it("allows predictions about different tokens", () => {
      const a = "ETH showing strong DeFi metrics with increasing TVL across protocols";
      const b = "SOL network activity surging with new validator nodes coming online";
      expect(jaccardSimilarity(a, b)).toBeLessThanOrEqual(INTERNAL_THRESHOLD);
    });

    it("detects rephrased but essentially same prediction", () => {
      const a = "BTC bullish strong support at 95k expecting move to 100k with high confidence";
      const b = "BTC bullish strong support at 95k expecting move to 100k with high volume";
      expect(jaccardSimilarity(a, b)).toBeGreaterThan(INTERNAL_THRESHOLD);
    });

    it("allows short but distinct posts", () => {
      const a = "ETH bullish breakout";
      const b = "SOL bearish reversal";
      expect(jaccardSimilarity(a, b)).toBeLessThanOrEqual(INTERNAL_THRESHOLD);
    });
  });
});
