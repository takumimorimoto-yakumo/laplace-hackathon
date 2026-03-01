// ============================================================
// Market Token Data & Helpers — Laplace MVP
// ============================================================

import type { MarketToken, Timeframe, TimeframeConfig } from "./types";

export const timeframeConfigs: Record<Timeframe, TimeframeConfig> = {
  "1H": { points: 48, driftMultiplier: 0.5 },  // 48h of 1H candles
  "4H": { points: 42, driftMultiplier: 0.8 },  // 7d of 4H candles
  "1D": { points: 30, driftMultiplier: 1.2 },   // 30d of 1D candles
  "1W": { points: 52, driftMultiplier: 2.0 },   // 1y of 1W candles
};

export function generatePriceHistory(
  currentPrice: number,
  volatility: number,
  count: number,
  driftMultiplier: number
): number[] {
  const points: number[] = [];
  const drift = volatility * driftMultiplier;
  let price = currentPrice * (1 - drift * 0.5);
  for (let i = 0; i < count; i++) {
    const trend = ((currentPrice - price) / (count - i)) * 0.3;
    const noise =
      (Math.sin(i * 1.7) * 0.4 + Math.cos(i * 0.8) * 0.3) *
      volatility *
      currentPrice;
    price = price + trend + noise;
    price = Math.max(price, currentPrice * (1 - drift));
    price = Math.min(price, currentPrice * (1 + drift));
    points.push(Number(price.toPrecision(6)));
  }
  points[count - 1] = currentPrice;
  return points;
}

// Legacy wrapper (used by MarketToken.priceHistory48h)
export function generatePriceHistory48h(currentPrice: number, volatility: number): number[] {
  return generatePriceHistory(currentPrice, volatility, 48, 0.5);
}

export function getTimeframeData(
  token: MarketToken,
  timeframe: Timeframe
): number[] {
  if (timeframe === "1H") return token.priceHistory48h;
  const cfg = timeframeConfigs[timeframe];
  return generatePriceHistory(token.price, token.change24h / 100 || 0.03, cfg.points, cfg.driftMultiplier);
}

export const marketTokens: MarketToken[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    price: 185.32,
    change24h: 12.5,
    category: "infra",
    tvl: null,
    volume24h: 1_800_000_000,
    agentCount: 23,
    bullishPercent: 72,
    sparkline7d: [170, 172, 168, 175, 178, 180, 185],
    priceHistory48h: generatePriceHistory48h(185.32, 0.04),
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    price: 1.82,
    change24h: 8.3,
    category: "defi",
    tvl: 1_800_000_000,
    volume24h: 180_000_000,
    agentCount: 18,
    bullishPercent: 65,
    sparkline7d: [1.60, 1.55, 1.65, 1.70, 1.68, 1.75, 1.82],
    priceHistory48h: generatePriceHistory48h(1.82, 0.05),
  },
  {
    address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    symbol: "RAY",
    name: "Raydium",
    price: 4.15,
    change24h: 3.1,
    category: "defi",
    tvl: 950_000_000,
    volume24h: 85_000_000,
    agentCount: 15,
    bullishPercent: 58,
    sparkline7d: [3.90, 3.95, 4.00, 3.85, 4.05, 4.10, 4.15],
    priceHistory48h: generatePriceHistory48h(4.15, 0.03),
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    price: 0.0000234,
    change24h: 25.0,
    category: "meme",
    tvl: null,
    volume24h: 320_000_000,
    agentCount: 20,
    bullishPercent: 45,
    sparkline7d: [18.0, 19.5, 17.5, 21.0, 20.0, 22.5, 23.4],
    priceHistory48h: generatePriceHistory48h(0.0000234, 0.08),
  },
  {
    address: "ONDO1111111111111111111111111111111111111111",
    symbol: "ONDO",
    name: "Ondo Finance",
    price: 1.45,
    change24h: 1.8,
    category: "rwa",
    tvl: 500_000_000,
    volume24h: 42_000_000,
    agentCount: 8,
    bullishPercent: 70,
    sparkline7d: [1.38, 1.40, 1.42, 1.39, 1.43, 1.44, 1.45],
    priceHistory48h: generatePriceHistory48h(1.45, 0.02),
  },
  {
    address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    symbol: "ORCA",
    name: "Orca",
    price: 3.87,
    change24h: -2.1,
    category: "defi",
    tvl: 620_000_000,
    volume24h: 38_000_000,
    agentCount: 12,
    bullishPercent: 48,
    sparkline7d: [4.00, 3.95, 3.98, 3.90, 3.85, 3.88, 3.87],
    priceHistory48h: generatePriceHistory48h(3.87, 0.03),
  },
  {
    address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    symbol: "PYTH",
    name: "Pyth Network",
    price: 0.42,
    change24h: 5.6,
    category: "infra",
    tvl: null,
    volume24h: 56_000_000,
    agentCount: 10,
    bullishPercent: 62,
    sparkline7d: [0.38, 0.39, 0.37, 0.40, 0.41, 0.40, 0.42],
    priceHistory48h: generatePriceHistory48h(0.42, 0.04),
  },
  {
    address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    symbol: "JITO",
    name: "Jito",
    price: 3.21,
    change24h: 7.2,
    category: "defi",
    tvl: 1_200_000_000,
    volume24h: 72_000_000,
    agentCount: 14,
    bullishPercent: 67,
    sparkline7d: [2.90, 2.95, 3.00, 3.05, 3.10, 3.15, 3.21],
    priceHistory48h: generatePriceHistory48h(3.21, 0.04),
  },
];

export function getToken(address: string): MarketToken | undefined {
  return marketTokens.find((t) => t.address === address);
}

export function getTokenBySymbol(symbol: string): MarketToken | undefined {
  return marketTokens.find((t) => t.symbol === symbol);
}
