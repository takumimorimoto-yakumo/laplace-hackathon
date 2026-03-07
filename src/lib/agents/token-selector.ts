// ============================================================
// Token Selector — Agent-specific token selection
// ============================================================

import type { Agent, AnalysisModule, AgentStyle } from "@/lib/types";
import type { RealMarketData } from "./prompt-builder";

// ---------- Module-Based Scoring ----------

/** Weight multiplier applied per analysis module */
const MODULE_SCORERS: Record<
  AnalysisModule,
  (token: RealMarketData) => number
> = {
  defi: (t) => {
    // Boost tokens with high TVL
    if (t.tvl !== null && t.tvl > 0) return t.tvl / 1e9;
    return 0;
  },
  onchain: (t) => {
    // Boost tokens with high volume
    return t.volume24h / 1e9;
  },
  sentiment: (t) => {
    // Boost tokens with high volatility
    return t.volatility24h * 100;
  },
  news: (t) => {
    // Boost tokens with high volatility (news-worthy)
    return t.volatility24h * 100;
  },
  macro_regulatory: (t) => {
    // Boost tokens with large marketCap
    if (t.marketCap !== null) return t.marketCap / 1e10;
    return 0;
  },
  risk: (t) => {
    // Boost both high volatility and large marketCap
    const volScore = t.volatility24h * 50;
    const mcapScore = t.marketCap !== null ? t.marketCap / 1e10 : 0;
    return volScore + mcapScore;
  },
  technical: (t) => {
    // Boost tokens with sufficient volume (>$10M)
    return t.volume24h > 10_000_000 ? 1 : 0;
  },
  cross_chain: () => {
    // Small boost to all
    return 0.1;
  },
};

/**
 * Compute a module-based score for a token given agent's analysis modules.
 */
function computeModuleScore(
  token: RealMarketData,
  modules: AnalysisModule[]
): number {
  let score = 0;
  for (const mod of modules) {
    const scorer = MODULE_SCORERS[mod];
    score += scorer(token);
  }
  return score;
}

// ---------- Style-Based Scoring ----------

/** Style-based score adjustments applied after module scoring */
const STYLE_SCORERS: Record<AgentStyle, (token: RealMarketData) => number> = {
  daytrader: (t) => {
    // Boost Volume + volatility
    return t.volume24h / 1e9 + t.volatility24h * 50;
  },
  macro: (t) => {
    // Boost marketCap
    if (t.marketCap !== null) return t.marketCap / 1e10;
    return 0;
  },
  degen: (t) => {
    // Boost volatility, downweight large marketCap
    const volBoost = t.volatility24h * 100;
    const mcapPenalty =
      t.marketCap !== null && t.marketCap > 10_000_000_000 ? -1 : 0;
    return volBoost + mcapPenalty;
  },
  contrarian: (t) => {
    // Boost tokens with extreme changes (absolute value of change24h)
    return Math.abs(t.change24h) / 10;
  },
  swing: () => {
    // Balanced — no extra boost
    return 0;
  },
  quant: (t) => {
    // Boost volume
    return t.volume24h / 1e9;
  },
};

/**
 * Compute a style-based score for a token given agent's trading style.
 */
function computeStyleScore(
  token: RealMarketData,
  style: AgentStyle
): number {
  const scorer = STYLE_SCORERS[style];
  return scorer(token);
}

// ---------- Fisher-Yates Shuffle ----------

/**
 * Fisher-Yates shuffle to eliminate LLM position bias.
 * Mutates the array in place and returns it.
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

// ---------- Recency Penalty ----------

/**
 * Compute a penalty for tokens the agent has recently discussed.
 * Tokens that appear in recentSymbols get a negative score adjustment,
 * scaled by how recently/frequently they appeared.
 */
function computeRecencyPenalty(
  symbol: string,
  recentSymbols: string[]
): number {
  const upper = symbol.toUpperCase();
  let penalty = 0;
  for (let i = 0; i < recentSymbols.length; i++) {
    if (recentSymbols[i].toUpperCase() === upper) {
      // More recent = higher penalty (index 0 = most recent)
      penalty += 1.0 - i * 0.1;
    }
  }
  return penalty;
}

// ---------- Main Selection ----------

/**
 * Select tokens personalized for a specific agent based on their
 * analysis modules and trading style.
 *
 * 1. Score each token using module-based and style-based heuristics
 * 2. Apply recency penalty for recently discussed tokens
 * 3. Add random noise (30% of max score) for variety
 * 4. Sort by combined score (descending)
 * 5. Take top `count` tokens (default 20)
 * 6. Fisher-Yates shuffle to eliminate LLM position bias
 *
 * @param allTokens - Full list of available market tokens
 * @param agent - The agent to personalize for
 * @param count - Number of tokens to select (default 20, range 15-30)
 * @param recentSymbols - Symbols recently posted about (most recent first)
 * @returns Shuffled subset of tokens tailored to the agent
 */
export function selectTokensForAgent(
  allTokens: RealMarketData[],
  agent: Agent,
  count: number = 20,
  recentSymbols: string[] = []
): RealMarketData[] {
  // Clamp count to 15-30 range
  const safeCount = Math.max(15, Math.min(30, count));

  // Score each token
  const scored = allTokens.map((token) => {
    const moduleScore = computeModuleScore(token, agent.modules);
    const styleScore = computeStyleScore(token, agent.style);
    const baseScore = moduleScore + styleScore;
    return { token, baseScore };
  });

  // Find max base score for noise scaling
  const maxBase = Math.max(...scored.map((s) => s.baseScore), 1);

  // Apply recency penalty + random noise
  const final = scored.map((s) => {
    const recencyPenalty = computeRecencyPenalty(s.token.symbol, recentSymbols);
    // Random noise: up to 30% of max base score
    const noise = Math.random() * maxBase * 0.3;
    return {
      token: s.token,
      score: s.baseScore - recencyPenalty * maxBase * 0.5 + noise,
    };
  });

  // Sort by score descending
  final.sort((a, b) => b.score - a.score);

  // Take top N
  const selected = final.slice(0, safeCount).map((s) => s.token);

  // Fisher-Yates shuffle to eliminate position bias
  return fisherYatesShuffle(selected);
}
