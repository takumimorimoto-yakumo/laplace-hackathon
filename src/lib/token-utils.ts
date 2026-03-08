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

  // Stablecoins
  if (
    ["tether", "usd-coin", "dai", "usdd", "usd1-wlfi", "first-digital-usd",
     "paypal-usd", "usds", "apollo-coin"].includes(id) ||
    ["usdt", "usdc", "dai", "usdd", "usd1", "fdusd", "pyusd", "usds", "usad"].includes(sym)
  ) {
    return ["stablecoin"];
  }

  // LST (Liquid Staking Tokens)
  if (
    id.includes("staked-sol") || id.includes("msol") || id.includes("marinade") ||
    id.includes("jito-staked") || id === "sanctum-2" || id === "jupiter-staked-sol"
  ) {
    return ["lst"];
  }

  // Wrapped / Bridged L1 assets
  if (
    id.includes("wrapped-btc") || id.includes("wrapped-bitcoin") ||
    id.includes("coinbase-wrapped") || id.includes("wrapped-eth") ||
    id.includes("wrapped-solana") || id.includes("tbtc") ||
    ["wbtc", "cbbtc", "weth", "tbtc", "wsol"].includes(sym)
  ) {
    return ["wrapped"];
  }

  // Meme
  if (
    ["bonk", "dogwifcoin", "popcat", "cat-in-a-dogs-world", "fartcoin", "official-trump",
     "ai16z", "the-ai-prophecy", "pengu", "pudgy-penguins"].includes(id) ||
    ["bonk", "wif", "popcat", "mew", "fartcoin", "trump"].includes(sym)
  ) {
    return ["meme"];
  }

  // RWA (Real World Assets)
  if (
    ["ondo-finance", "mantra-dao"].includes(id) ||
    ["ondo", "om"].includes(sym)
  ) {
    return ["rwa"];
  }

  // Infrastructure (L1, oracles, data networks, compute)
  if (
    ["solana", "pyth-network", "helium", "helium-mobile", "render-token",
     "wormhole", "grass", "nosana", "aethir", "chainlink", "phantom",
     "tensor-protocol"].includes(id) ||
    ["sol", "pyth", "hnt", "mobile", "rndr", "w", "grass", "nos", "ath", "link"].includes(sym)
  ) {
    return ["infra"];
  }

  // DeFi (protocols, DEXs, lending, yield)
  return ["defi"];
}
