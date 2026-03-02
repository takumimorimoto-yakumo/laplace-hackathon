// ============================================================
// Prompt Builder — Agent Config → LLM Prompts
// ============================================================

import type { Agent, MarketToken, TimelinePost } from "@/lib/types";
import { seedTokens } from "@/lib/tokens";
import type { AgentPostOutput } from "./response-schema";
import type { ChatMessage } from "./llm-client";

// ---------- Real Market Data Interface ----------

export interface RealMarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  tvl: number | null;
  marketCap: number | null;
}

// ---------- Three Laws of the Agent World ----------

const THREE_LAWS = `
## Three Laws
1. You are an AI agent in Laplace — a city of 100+ agents analyzing Solana crypto markets.
2. You must always disclose your confidence level honestly. Never be more confident than your analysis supports.
3. You generate virtual predictions only. No real money is involved. Your goal is accuracy and insight.
`.trim();

// ---------- JSON Output Schema ----------

const OUTPUT_SCHEMA = `
## Output Format
Respond with a single JSON object (no markdown, no extra text):
{
  "token_symbol": "SOL",
  "token_address": "So11111111111111111111111111111111111111112",
  "direction": "bullish" | "bearish" | "neutral",
  "confidence": 0.72,
  "evidence": ["source: on-chain data shows ...", "source: technical pattern ..."],
  "natural_text": "Your analysis post in English. 2-4 sentences. Be specific.",
  "reasoning": "Brief internal reasoning for this call",
  "uncertainty": "What could invalidate this thesis",
  "confidence_rationale": "Why this specific confidence level"
}
`.trim();

// ---------- Token List ----------

function buildTokenList(tokens: MarketToken[] = seedTokens): string {
  return tokens
    .map((t) => `- ${t.symbol} (${t.name}): ${t.address}`)
    .join("\n");
}

// ---------- Market Summary ----------

export function buildMarketSummary(tokens: MarketToken[] = seedTokens): string {
  return tokens
    .map((t) => {
      const dir = t.change24h >= 0 ? "+" : "";
      return `${t.symbol}: $${t.price} (${dir}${t.change24h}% 24h) | Vol: $${(t.volume24h / 1e6).toFixed(0)}M | Bullish: ${t.bullishPercent}%`;
    })
    .join("\n");
}

// ---------- Real Market Summary ----------

export function buildRealMarketSummary(data: RealMarketData[]): string {
  return data
    .map((d) => {
      const dir = d.change24h >= 0 ? "+" : "";
      const parts = [
        `${d.symbol}: $${d.price} (${dir}${d.change24h}% 24h)`,
        `Vol: $${(d.volume24h / 1e6).toFixed(0)}M`,
      ];
      if (d.marketCap !== null) {
        parts.push(`MCap: $${(d.marketCap / 1e6).toFixed(0)}M`);
      }
      if (d.tvl !== null) {
        parts.push(`TVL: $${(d.tvl / 1e6).toFixed(0)}M`);
      }
      return parts.join(" | ");
    })
    .join("\n");
}

// ---------- Recent Posts Context ----------

function formatRecentPosts(posts: TimelinePost[]): string {
  if (posts.length === 0) return "No recent posts from other agents.";

  return posts
    .map((p) => {
      const token = p.tokenSymbol ? `[${p.tokenSymbol}]` : "";
      const dir = p.direction.toUpperCase();
      const conf = `${(p.confidence * 100).toFixed(0)}%`;
      return `- ${token} ${dir} (${conf}): ${p.content.en.slice(0, 120)}`;
    })
    .join("\n");
}

// ---------- System Prompt ----------

export function buildSystemPrompt(agent: Agent, tokens?: MarketToken[]): string {
  return `
You are "${agent.name}", an AI crypto analyst agent in Laplace.

## Your Identity
- Style: ${agent.style}
- Analysis modules: ${agent.modules.join(", ")}
- Personality: ${agent.personality}
- Voice style: ${agent.voiceStyle}
- Bio: ${agent.bio}
- Track record: ${(agent.accuracy * 100).toFixed(0)}% accuracy, rank #${agent.rank}

${THREE_LAWS}

## Available Tokens (Solana)
${buildTokenList(tokens)}

${OUTPUT_SCHEMA}
`.trim();
}

// ---------- User Prompt ----------

export function buildUserPrompt(
  recentPosts: TimelinePost[],
  realMarketData?: RealMarketData[]
): string {
  const marketSummary = realMarketData
    ? buildRealMarketSummary(realMarketData)
    : buildMarketSummary();

  return `
## Current Market Data
${marketSummary}

## Recent Agent Posts
${formatRecentPosts(recentPosts)}

Based on your analysis style and modules, pick a token and make your prediction. Be specific and cite evidence.
`.trim();
}

// ---------- Build Full Messages ----------

export function buildMessages(
  agent: Agent,
  recentPosts: TimelinePost[],
  realMarketData?: RealMarketData[],
  tokens?: MarketToken[]
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(agent, tokens) },
    { role: "user", content: buildUserPrompt(recentPosts, realMarketData) },
  ];
}

// Re-export for type convenience
export type { AgentPostOutput };
