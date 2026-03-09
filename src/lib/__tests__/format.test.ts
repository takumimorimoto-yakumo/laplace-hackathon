import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatPrice,
  formatChange,
  formatCompactNumber,
  formatPool,
  formatPredictionPrice,
  formatConditionShort,
  getTimeRemainingParts,
  formatPriceChange,
  formatAbsoluteDate,
  getScoreLabel,
} from "@/lib/format";
import { timeframeConfigs, inferTags } from "@/lib/token-utils";
import { getAgentAvatarUrl } from "@/lib/avatar";

// ============================================================
// format.ts
// ============================================================

describe("format.ts", () => {
  // ----------------------------------------------------------
  // formatPrice
  // ----------------------------------------------------------
  describe("formatPrice", () => {
    it("formats prices < 0.001 with 7 decimal places", () => {
      expect(formatPrice(0.0001234)).toBe("$0.0001234");
      expect(formatPrice(0.0000001)).toBe("$0.0000001");
      expect(formatPrice(0.0009999)).toBe("$0.0009999");
    });

    it("formats prices >= 0.001 and < 1 with 4 decimal places", () => {
      expect(formatPrice(0.001)).toBe("$0.0010");
      expect(formatPrice(0.5)).toBe("$0.5000");
      expect(formatPrice(0.9999)).toBe("$0.9999");
      expect(formatPrice(0.12345)).toBe("$0.1235");
    });

    it("formats prices >= 1 and < 100 with 2 decimal places", () => {
      expect(formatPrice(1)).toBe("$1.00");
      expect(formatPrice(1.5)).toBe("$1.50");
      expect(formatPrice(42.789)).toBe("$42.79");
      expect(formatPrice(99.99)).toBe("$99.99");
    });

    it("formats prices >= 100 with 2 decimal places", () => {
      expect(formatPrice(100)).toBe("$100.00");
      expect(formatPrice(1234.5)).toBe("$1234.50");
      expect(formatPrice(99999.999)).toBe("$100000.00");
      expect(formatPrice(50000)).toBe("$50000.00");
    });

    it("handles zero", () => {
      expect(formatPrice(0)).toBe("$0.0000000");
    });

    it("handles very small positive numbers", () => {
      expect(formatPrice(0.00000001)).toBe("$0.0000000");
    });

    it("handles very large numbers", () => {
      expect(formatPrice(1000000)).toBe("$1000000.00");
    });
  });

  // ----------------------------------------------------------
  // formatChange
  // ----------------------------------------------------------
  describe("formatChange", () => {
    it("adds + prefix for positive changes", () => {
      expect(formatChange(5.23)).toBe("+5.2%");
      expect(formatChange(100)).toBe("+100.0%");
      expect(formatChange(0.1)).toBe("+0.1%");
    });

    it("adds + prefix for zero", () => {
      expect(formatChange(0)).toBe("+0.0%");
    });

    it("keeps - prefix for negative changes", () => {
      expect(formatChange(-3.7)).toBe("-3.7%");
      expect(formatChange(-100)).toBe("-100.0%");
      expect(formatChange(-0.1)).toBe("-0.1%");
    });

    it("rounds to 1 decimal place", () => {
      expect(formatChange(5.678)).toBe("+5.7%");
      expect(formatChange(-2.34)).toBe("-2.3%");
      expect(formatChange(0.05)).toBe("+0.1%");
      expect(formatChange(0.04)).toBe("+0.0%");
    });

    it("handles large numbers", () => {
      expect(formatChange(9999.9)).toBe("+9999.9%");
      expect(formatChange(-500.55)).toBe("-500.6%");
    });
  });

  // ----------------------------------------------------------
  // formatCompactNumber
  // ----------------------------------------------------------
  describe("formatCompactNumber", () => {
    it("formats billions with 1 decimal and B suffix", () => {
      expect(formatCompactNumber(1_000_000_000)).toBe("$1.0B");
      expect(formatCompactNumber(2_500_000_000)).toBe("$2.5B");
      expect(formatCompactNumber(10_000_000_000)).toBe("$10.0B");
      expect(formatCompactNumber(1_234_567_890)).toBe("$1.2B");
    });

    it("formats millions with 0 decimals and M suffix", () => {
      expect(formatCompactNumber(1_000_000)).toBe("$1M");
      expect(formatCompactNumber(50_000_000)).toBe("$50M");
      expect(formatCompactNumber(999_000_000)).toBe("$999M");
      expect(formatCompactNumber(1_500_000)).toBe("$2M");
    });

    it("formats thousands with 0 decimals and K suffix", () => {
      expect(formatCompactNumber(1_000)).toBe("$1K");
      expect(formatCompactNumber(50_000)).toBe("$50K");
      expect(formatCompactNumber(999_000)).toBe("$999K");
      expect(formatCompactNumber(1_500)).toBe("$2K");
    });

    it("formats numbers below 1000 as-is with $ prefix", () => {
      expect(formatCompactNumber(999)).toBe("$999");
      expect(formatCompactNumber(0)).toBe("$0");
      expect(formatCompactNumber(1)).toBe("$1");
      expect(formatCompactNumber(500)).toBe("$500");
    });

    it("handles exact boundary values", () => {
      expect(formatCompactNumber(999)).toBe("$999");
      expect(formatCompactNumber(1000)).toBe("$1K");
      expect(formatCompactNumber(999_999)).toBe("$1000K");
      expect(formatCompactNumber(1_000_000)).toBe("$1M");
      expect(formatCompactNumber(999_999_999)).toBe("$1000M");
      expect(formatCompactNumber(1_000_000_000)).toBe("$1.0B");
    });
  });

  // ----------------------------------------------------------
  // formatPool
  // ----------------------------------------------------------
  describe("formatPool", () => {
    it("formats with locale thousands separators and $ prefix", () => {
      expect(formatPool(1000)).toBe("$1,000");
      expect(formatPool(1234567)).toBe("$1,234,567");
      expect(formatPool(0)).toBe("$0");
    });

    it("rounds to 0 decimal places", () => {
      expect(formatPool(1234.56)).toBe("$1,235");
      expect(formatPool(999.4)).toBe("$999");
      expect(formatPool(999.5)).toBe("$1,000");
    });

    it("handles small numbers", () => {
      expect(formatPool(1)).toBe("$1");
      expect(formatPool(99)).toBe("$99");
    });

    it("handles large numbers", () => {
      expect(formatPool(1_000_000_000)).toBe("$1,000,000,000");
    });
  });

  // ----------------------------------------------------------
  // formatPredictionPrice
  // ----------------------------------------------------------
  describe("formatPredictionPrice", () => {
    it("formats billions with 2 decimals and B suffix", () => {
      expect(formatPredictionPrice(1_000_000_000)).toBe("$1.00B");
      expect(formatPredictionPrice(2_500_000_000)).toBe("$2.50B");
      expect(formatPredictionPrice(1_234_567_890)).toBe("$1.23B");
    });

    it("formats millions with 2 decimals and M suffix", () => {
      expect(formatPredictionPrice(1_000_000)).toBe("$1.00M");
      expect(formatPredictionPrice(50_500_000)).toBe("$50.50M");
      expect(formatPredictionPrice(999_999_999)).toBe("$1000.00M");
    });

    it("formats thousands with locale formatting and up to 2 decimals", () => {
      expect(formatPredictionPrice(1_000)).toBe("$1,000");
      expect(formatPredictionPrice(50_000)).toBe("$50,000");
      expect(formatPredictionPrice(1_234.56)).toBe("$1,234.56");
      expect(formatPredictionPrice(999_999)).toBe("$999,999");
    });

    it("formats numbers below 1000 with 4 decimal places", () => {
      expect(formatPredictionPrice(0)).toBe("$0.0000");
      expect(formatPredictionPrice(0.5)).toBe("$0.5000");
      expect(formatPredictionPrice(999)).toBe("$999.0000");
      expect(formatPredictionPrice(0.1234)).toBe("$0.1234");
    });

    it("handles boundary between thousands and sub-thousand", () => {
      expect(formatPredictionPrice(999.9999)).toBe("$999.9999");
      expect(formatPredictionPrice(1000)).toBe("$1,000");
    });
  });

  // ----------------------------------------------------------
  // formatConditionShort
  // ----------------------------------------------------------
  describe("formatConditionShort", () => {
    describe("price_above", () => {
      it("formats with $ for thresholds below 1M", () => {
        expect(formatConditionShort("BTC", "price_above", 100000, "30d")).toBe(
          "BTC > $100000 (30d)"
        );
        expect(formatConditionShort("SOL", "price_above", 250, "7d")).toBe(
          "SOL > $250 (7d)"
        );
      });

      it("formats threshold >= 1B with B suffix and TVL label", () => {
        expect(
          formatConditionShort("ETH", "price_above", 2_000_000_000, "90d")
        ).toBe("ETH TVL > $2B (90d)");
        expect(
          formatConditionShort("SOL", "price_above", 10_000_000_000, "30d")
        ).toBe("SOL TVL > $10B (30d)");
      });

      it("formats threshold >= 1M with M suffix and TVL label", () => {
        expect(
          formatConditionShort("SOL", "price_above", 5_000_000, "30d")
        ).toBe("SOL TVL > $5M (30d)");
        expect(
          formatConditionShort("AVAX", "price_above", 1_000_000, "14d")
        ).toBe("AVAX TVL > $1M (14d)");
        expect(
          formatConditionShort("SOL", "price_above", 999_000_000, "30d")
        ).toBe("SOL TVL > $999M (30d)");
      });
    });

    describe("price_below", () => {
      it("formats with < and $", () => {
        expect(formatConditionShort("BTC", "price_below", 50000, "7d")).toBe(
          "BTC < $50000 (7d)"
        );
        expect(formatConditionShort("SOL", "price_below", 100, "30d")).toBe(
          "SOL < $100 (30d)"
        );
      });
    });

    describe("change_percent", () => {
      it("formats with % suffix", () => {
        expect(formatConditionShort("BTC", "change_percent", 10, "24h")).toBe(
          "BTC 10% (24h)"
        );
        expect(formatConditionShort("ETH", "change_percent", -5, "7d")).toBe(
          "ETH -5% (7d)"
        );
      });
    });

    describe("default condition type", () => {
      it("returns symbol and duration only", () => {
        expect(formatConditionShort("BTC", "unknown_type", 100, "30d")).toBe(
          "BTC (30d)"
        );
        expect(formatConditionShort("SOL", "custom", 0, "7d")).toBe(
          "SOL (7d)"
        );
      });
    });

    it("handles empty strings", () => {
      expect(formatConditionShort("", "price_above", 100, "")).toBe(
        " > $100 ()"
      );
    });
  });

  // ----------------------------------------------------------
  // formatPriceChange
  // ----------------------------------------------------------
  describe("formatPriceChange", () => {
    it("returns +X% and isPositive: true for positive change", () => {
      const result = formatPriceChange(100, 150);
      expect(result.text).toBe("+50.0%");
      expect(result.isPositive).toBe(true);
    });

    it("returns -X% and isPositive: false for negative change", () => {
      const result = formatPriceChange(100, 80);
      expect(result.text).toBe("-20.0%");
      expect(result.isPositive).toBe(false);
    });

    it("returns N/A when from is zero", () => {
      const result = formatPriceChange(0, 100);
      expect(result.text).toBe("N/A");
      expect(result.isPositive).toBe(false);
    });

    it("handles large percentage changes", () => {
      const result = formatPriceChange(1, 100);
      expect(result.text).toBe("+9900.0%");
      expect(result.isPositive).toBe(true);
    });

    it("handles small percentage changes with precision", () => {
      const result = formatPriceChange(1000, 1001);
      expect(result.text).toBe("+0.1%");
      expect(result.isPositive).toBe(true);
    });

    it("returns +0.0% for no change", () => {
      const result = formatPriceChange(100, 100);
      expect(result.text).toBe("+0.0%");
      expect(result.isPositive).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // formatAbsoluteDate
  // ----------------------------------------------------------
  describe("formatAbsoluteDate", () => {
    it("formats English locale with month, day, and time (same year)", () => {
      const result = formatAbsoluteDate("2026-03-07T14:30:00Z", "en");
      // Should contain "Mar" and "7" and time in HH:MM format
      expect(result).toMatch(/Mar 7, \d{2}:\d{2}/);
    });

    it("includes year in English format when different year", () => {
      const result = formatAbsoluteDate("2025-03-07T14:30:00Z", "en");
      expect(result).toMatch(/Mar 7, 2025, \d{2}:\d{2}/);
    });

    it("formats Japanese locale as 'M月D日 HH:MM' (same year)", () => {
      const result = formatAbsoluteDate("2026-03-07T14:30:00Z", "ja");
      // Should contain "3月7日" and time in HH:MM format
      expect(result).toMatch(/3月7日 \d{2}:\d{2}/);
    });

    it("includes year in Japanese format when different year", () => {
      const result = formatAbsoluteDate("2025-03-07T14:30:00Z", "ja");
      expect(result).toMatch(/2025年3月7日 \d{2}:\d{2}/);
    });

    it("formats Chinese locale same as Japanese (same year)", () => {
      const result = formatAbsoluteDate("2026-03-07T14:30:00Z", "zh");
      // Should contain "3月7日" and time in HH:MM format
      expect(result).toMatch(/3月7日 \d{2}:\d{2}/);
    });

    it("includes year in Chinese format when different year", () => {
      const result = formatAbsoluteDate("2025-03-07T14:30:00Z", "zh");
      expect(result).toMatch(/2025年3月7日 \d{2}:\d{2}/);
    });

    it("pads hours and minutes with zeros", () => {
      const result = formatAbsoluteDate("2026-03-07T09:05:00Z", "en");
      // Time should have zero-padded minutes (05) and hours should be zero-padded
      expect(result).toMatch(/Mar 7, \d{2}:05/);
    });
  });

  // ----------------------------------------------------------
  // getScoreLabel
  // ----------------------------------------------------------
  describe("getScoreLabel", () => {
    it("returns 'excellent' for score >= 0.8", () => {
      expect(getScoreLabel(0.8)).toBe("excellent");
      expect(getScoreLabel(0.9)).toBe("excellent");
      expect(getScoreLabel(1.0)).toBe("excellent");
    });

    it("returns 'good' for score >= 0.6 and < 0.8", () => {
      expect(getScoreLabel(0.6)).toBe("good");
      expect(getScoreLabel(0.7)).toBe("good");
      expect(getScoreLabel(0.799)).toBe("good");
    });

    it("returns 'average' for score >= 0.4 and < 0.6", () => {
      expect(getScoreLabel(0.4)).toBe("average");
      expect(getScoreLabel(0.5)).toBe("average");
      expect(getScoreLabel(0.599)).toBe("average");
    });

    it("returns 'poor' for score < 0.4", () => {
      expect(getScoreLabel(0.0)).toBe("poor");
      expect(getScoreLabel(0.3)).toBe("poor");
      expect(getScoreLabel(0.399)).toBe("poor");
    });

    it("handles boundary values exactly", () => {
      expect(getScoreLabel(0.8)).toBe("excellent");
      expect(getScoreLabel(0.6)).toBe("good");
      expect(getScoreLabel(0.4)).toBe("average");
    });
  });

  // ----------------------------------------------------------
  // getTimeRemainingParts
  // ----------------------------------------------------------
  describe("getTimeRemainingParts", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns ended=true for past deadlines", () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      const result = getTimeRemainingParts(pastDate);
      expect(result.ended).toBe(true);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it("returns ended=true for deadline exactly now or in the past", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T12:00:00Z"));

      const result = getTimeRemainingParts("2026-03-08T12:00:00Z");
      expect(result.ended).toBe(true);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it("calculates correct days, hours, minutes for future deadlines", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T00:00:00Z"));

      // Exactly 2 days, 5 hours, 30 minutes in the future
      const result = getTimeRemainingParts("2026-03-10T05:30:00Z");
      expect(result.ended).toBe(false);
      expect(result.days).toBe(2);
      expect(result.hours).toBe(5);
      expect(result.minutes).toBe(30);
    });

    it("handles deadline exactly 1 minute in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T12:00:00Z"));

      const result = getTimeRemainingParts("2026-03-08T12:01:00Z");
      expect(result.ended).toBe(false);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(1);
    });

    it("handles deadline exactly 1 day in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T00:00:00Z"));

      const result = getTimeRemainingParts("2026-03-09T00:00:00Z");
      expect(result.ended).toBe(false);
      expect(result.days).toBe(1);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it("handles large time differences", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

      // Roughly 365 days in the future
      const result = getTimeRemainingParts("2027-01-01T00:00:00Z");
      expect(result.ended).toBe(false);
      expect(result.days).toBe(365);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it("returns ended=true for very old deadlines", () => {
      const result = getTimeRemainingParts("2020-01-01T00:00:00Z");
      expect(result.ended).toBe(true);
    });

    it("handles hours and minutes wrapping correctly", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T00:00:00Z"));

      // 0 days, 23 hours, 59 minutes
      const result = getTimeRemainingParts("2026-03-08T23:59:00Z");
      expect(result.ended).toBe(false);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(23);
      expect(result.minutes).toBe(59);
    });
  });
});

// ============================================================
// token-utils.ts
// ============================================================

describe("token-utils.ts", () => {
  // ----------------------------------------------------------
  // timeframeConfigs
  // ----------------------------------------------------------
  describe("timeframeConfigs", () => {
    it("has all 4 timeframes", () => {
      expect(Object.keys(timeframeConfigs)).toHaveLength(4);
      expect(timeframeConfigs).toHaveProperty("1D");
      expect(timeframeConfigs).toHaveProperty("1W");
      expect(timeframeConfigs).toHaveProperty("1M");
      expect(timeframeConfigs).toHaveProperty("1Y");
    });

    it("1D has correct values", () => {
      expect(timeframeConfigs["1D"]).toEqual({
        points: 48,
        driftMultiplier: 0.5,
      });
    });

    it("1W has correct values", () => {
      expect(timeframeConfigs["1W"]).toEqual({
        points: 168,
        driftMultiplier: 0.8,
      });
    });

    it("1M has correct values", () => {
      expect(timeframeConfigs["1M"]).toEqual({
        points: 180,
        driftMultiplier: 1.2,
      });
    });

    it("1Y has correct values", () => {
      expect(timeframeConfigs["1Y"]).toEqual({
        points: 365,
        driftMultiplier: 2.0,
      });
    });
  });

  // ----------------------------------------------------------
  // inferTags
  // ----------------------------------------------------------
  describe("inferTags", () => {
    describe("stablecoin detection", () => {
      it("detects stablecoins by coingecko ID", () => {
        expect(inferTags("tether", "USDT")).toEqual(["stablecoin"]);
        expect(inferTags("usd-coin", "USDC")).toEqual(["stablecoin"]);
        expect(inferTags("dai", "DAI")).toEqual(["stablecoin"]);
        expect(inferTags("usdd", "USDD")).toEqual(["stablecoin"]);
        expect(inferTags("usd1-wlfi", "USD1")).toEqual(["stablecoin"]);
        expect(inferTags("first-digital-usd", "FDUSD")).toEqual([
          "stablecoin",
        ]);
        expect(inferTags("paypal-usd", "PYUSD")).toEqual(["stablecoin"]);
      });

      it("detects stablecoins by symbol", () => {
        expect(inferTags("some-unknown-id", "USDT")).toEqual(["stablecoin"]);
        expect(inferTags("some-unknown-id", "USDC")).toEqual(["stablecoin"]);
        expect(inferTags("some-unknown-id", "DAI")).toEqual(["stablecoin"]);
        expect(inferTags("some-unknown-id", "USDD")).toEqual(["stablecoin"]);
        expect(inferTags("some-unknown-id", "USD1")).toEqual(["stablecoin"]);
        expect(inferTags("some-unknown-id", "FDUSD")).toEqual(["stablecoin"]);
        expect(inferTags("some-unknown-id", "PYUSD")).toEqual(["stablecoin"]);
      });

      it("is case-insensitive for symbol", () => {
        expect(inferTags("unknown", "usdt")).toEqual(["stablecoin"]);
        expect(inferTags("unknown", "Usdc")).toEqual(["stablecoin"]);
      });

      it("is case-insensitive for ID", () => {
        expect(inferTags("TETHER", "XYZ")).toEqual(["stablecoin"]);
        expect(inferTags("USD-COIN", "XYZ")).toEqual(["stablecoin"]);
      });
    });

    describe("LST detection", () => {
      it("detects LSTs by coingecko ID containing LST keywords", () => {
        expect(inferTags("lido-staked-sol", "stSOL")).toEqual(["lst"]);
        expect(inferTags("msol-token", "mSOL")).toEqual(["lst"]);
        expect(inferTags("marinade-staked-sol", "mSOL")).toEqual(["lst"]);
        expect(inferTags("jito-staked-sol", "jitoSOL")).toEqual(["lst"]);
      });
    });

    describe("meme detection", () => {
      it("detects meme tokens by coingecko ID", () => {
        expect(inferTags("bonk", "BONK")).toEqual(["meme"]);
        expect(inferTags("dogwifcoin", "WIF")).toEqual(["meme"]);
        expect(inferTags("popcat", "POPCAT")).toEqual(["meme"]);
        expect(inferTags("cat-in-a-dogs-world", "MEW")).toEqual(["meme"]);
        expect(inferTags("fartcoin", "FARTCOIN")).toEqual(["meme"]);
        expect(inferTags("official-trump", "TRUMP")).toEqual(["meme"]);
        expect(inferTags("ai16z", "AI16Z")).toEqual(["meme"]);
        expect(inferTags("the-ai-prophecy", "ACT")).toEqual(["meme"]);
        expect(inferTags("pengu", "PENGU")).toEqual(["meme"]);
        expect(inferTags("pudgy-penguins", "PENGU")).toEqual(["meme"]);
      });

      it("detects meme tokens by symbol", () => {
        expect(inferTags("some-unknown", "BONK")).toEqual(["meme"]);
        expect(inferTags("some-unknown", "WIF")).toEqual(["meme"]);
        expect(inferTags("some-unknown", "POPCAT")).toEqual(["meme"]);
        expect(inferTags("some-unknown", "MEW")).toEqual(["meme"]);
        expect(inferTags("some-unknown", "FARTCOIN")).toEqual(["meme"]);
        expect(inferTags("some-unknown", "TRUMP")).toEqual(["meme"]);
      });
    });

    describe("infra detection", () => {
      it("detects infra tokens by coingecko ID", () => {
        expect(inferTags("solana", "SOL")).toEqual(["infra"]);
        expect(inferTags("pyth-network", "PYTH")).toEqual(["infra"]);
        expect(inferTags("helium", "HNT")).toEqual(["infra"]);
        expect(inferTags("helium-mobile", "MOBILE")).toEqual(["infra"]);
        expect(inferTags("render-token", "RENDER")).toEqual(["infra"]);
        expect(inferTags("wormhole", "W")).toEqual(["infra"]);
        expect(inferTags("grass", "GRASS")).toEqual(["infra"]);
        expect(inferTags("nosana", "NOS")).toEqual(["infra"]);
        expect(inferTags("aethir", "ATH")).toEqual(["infra"]);
      });
    });

    describe("default fallback", () => {
      it("returns ['defi'] for unrecognized tokens", () => {
        expect(inferTags("unknown-token", "UNK")).toEqual(["defi"]);
        expect(inferTags("raydium", "RAY")).toEqual(["defi"]);
        expect(inferTags("jupiter", "JUP")).toEqual(["defi"]);
        expect(inferTags("", "")).toEqual(["defi"]);
      });
    });
  });
});

// ============================================================
// avatar.ts
// ============================================================

describe("avatar.ts", () => {
  describe("getAgentAvatarUrl", () => {
    it("returns a DiceBear URL with the bottts-neutral style", () => {
      const url = getAgentAvatarUrl("TestAgent");
      expect(url).toContain("/bottts-neutral/svg");
    });

    it("includes the name as the seed query parameter", () => {
      const url = getAgentAvatarUrl("AlphaBot");
      expect(url).toContain("seed=AlphaBot");
    });

    it("encodes special characters in the name", () => {
      const url = getAgentAvatarUrl("Agent #1 & 2");
      expect(url).toContain("seed=Agent%20%231%20%26%202");
    });

    it("encodes unicode characters", () => {
      const url = getAgentAvatarUrl("botName");
      expect(url).toContain("seed=botName");
    });

    it("handles empty string", () => {
      const url = getAgentAvatarUrl("");
      expect(url).toContain("seed=");
      expect(url).toMatch(/seed=$/);
    });

    it("uses the default DiceBear base URL when env is not set", () => {
      const url = getAgentAvatarUrl("test");
      expect(url).toMatch(
        /^https:\/\/api\.dicebear\.com\/9\.x\/bottts-neutral\/svg\?seed=/
      );
    });

    it("handles names with slashes and question marks", () => {
      const url = getAgentAvatarUrl("a/b?c=d");
      expect(url).toContain("seed=a%2Fb%3Fc%3Dd");
    });

    it("returns consistent URLs for the same name", () => {
      const url1 = getAgentAvatarUrl("Consistent");
      const url2 = getAgentAvatarUrl("Consistent");
      expect(url1).toBe(url2);
    });

    it("returns different URLs for different names", () => {
      const url1 = getAgentAvatarUrl("Agent1");
      const url2 = getAgentAvatarUrl("Agent2");
      expect(url1).not.toBe(url2);
    });
  });
});
