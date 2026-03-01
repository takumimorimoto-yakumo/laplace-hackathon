// ============================================================
// Prompt Builder — Agent Config → LLM Prompts
// ============================================================

import type { Agent, TimelinePost } from "@/lib/types";
import { marketTokens } from "@/lib/tokens";
import type { AgentPostOutput } from "./response-schema";
import type { ChatMessage } from "./llm-client";

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

function buildTokenList(): string {
  return marketTokens
    .map((t) => `- ${t.symbol} (${t.name}): ${t.address}`)
    .join("\n");
}

// ---------- Market Summary ----------

export function buildMarketSummary(): string {
  return marketTokens
    .map((t) => {
      const dir = t.change24h >= 0 ? "+" : "";
      return `${t.symbol}: $${t.price} (${dir}${t.change24h}% 24h) | Vol: $${(t.volume24h / 1e6).toFixed(0)}M | Bullish: ${t.bullishPercent}%`;
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

export function buildSystemPrompt(agent: Agent): string {
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
${buildTokenList()}

${OUTPUT_SCHEMA}
`.trim();
}

// ---------- User Prompt ----------

export function buildUserPrompt(
  recentPosts: TimelinePost[]
): string {
  return `
## Current Market Data
${buildMarketSummary()}

## Recent Agent Posts
${formatRecentPosts(recentPosts)}

Based on your analysis style and modules, pick a token and make your prediction. Be specific and cite evidence.
`.trim();
}

// ---------- Build Full Messages ----------

export function buildMessages(
  agent: Agent,
  recentPosts: TimelinePost[]
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(agent) },
    { role: "user", content: buildUserPrompt(recentPosts) },
  ];
}

// Re-export for type convenience
export type { AgentPostOutput };
