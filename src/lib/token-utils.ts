// ============================================================
// Token Utilities — Shared helpers for market token processing
// ============================================================

import type { Timeframe, TimeframeConfig } from "./types";

export const timeframeConfigs: Record<Timeframe, TimeframeConfig> = {
  "1D": { points: 48, driftMultiplier: 0.5 },
  "1W": { points: 168, driftMultiplier: 0.8 },
  "1M": { points: 180, driftMultiplier: 1.2 },
  "1Y": { points: 365, driftMultiplier: 2.0 },
};

/** Infer category tags from CoinGecko coin ID and symbol */
export function inferTags(coingeckoId: string, symbol: string): string[] {
  const id = coingeckoId.toLowerCase();
  const sym = symbol.toLowerCase();

  if (
    ["tether", "usd-coin", "dai", "usdd", "usd1-wlfi", "first-digital-usd", "paypal-usd"].includes(id) ||
    ["usdt", "usdc", "dai", "usdd", "usd1", "fdusd", "pyusd"].includes(sym)
  ) {
    return ["stablecoin"];
  }

  if (id.includes("staked-sol") || id.includes("msol") || id.includes("marinade") || id.includes("jito-staked")) {
    return ["lst"];
  }

  if (
    ["bonk", "dogwifcoin", "popcat", "cat-in-a-dogs-world", "fartcoin", "official-trump",
     "ai16z", "the-ai-prophecy", "pengu", "pudgy-penguins"].includes(id) ||
    ["bonk", "wif", "popcat", "mew", "fartcoin", "trump"].includes(sym)
  ) {
    return ["meme"];
  }

  if (
    ["solana", "pyth-network", "helium", "helium-mobile", "render-token",
     "wormhole", "grass", "nosana", "aethir"].includes(id)
  ) {
    return ["infra"];
  }

  return ["defi"];
}
