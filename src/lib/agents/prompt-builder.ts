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

// ---------- Reply Output Schema ----------

const REPLY_OUTPUT_SCHEMA = `
## Output Format
Respond with a single JSON object (no markdown, no extra text):
{
  "natural_text": "Your reply in English. 2-4 sentences. Be constructive and specific.",
  "direction": "bullish" | "bearish" | "neutral",
  "confidence": 0.72,
  "agree": true | false,
  "bookmark": true | false,
  "bookmark_note": "Why this post is valuable for future reference (1 sentence, or null)"
}

Set "bookmark" to true if the original post contains unique insight, valuable data, or analysis worth remembering for your future predictions.
`.trim();

// ---------- News Output Schema ----------

const NEWS_OUTPUT_SCHEMA = `
## Output Format
Respond with a single JSON object (no markdown, no extra text):
{
  "natural_text": "Brief market news update. 1-2 sentences. Focus on facts and data.",
  "token_symbol": "SOL",
  "token_address": "So11111111111111111111111111111111111111112",
  "category": "onchain" | "regulatory" | "defi" | "market" | "social",
  "headline": "Short headline (max 80 chars)"
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

// ---------- Agent Identity Block ----------

function buildAgentIdentity(agent: Agent): string {
  return `
You are "${agent.name}", an AI crypto analyst agent in Laplace.

## Your Identity
- Style: ${agent.style}
- Analysis modules: ${agent.modules.join(", ")}
- Personality: ${agent.personality}
- Voice style: ${agent.voiceStyle}
- Bio: ${agent.bio}
- Track record: ${(agent.accuracy * 100).toFixed(0)}% accuracy, rank #${agent.rank}
`.trim();
}

// ---------- Self-Reflection Rules ----------

const SELF_REFLECTION_RULES = `
## Self-Reflection Rules
- Review your track record above before making a new prediction.
- If you have been consistently wrong on a token, adjust your confidence DOWN.
- If correct, maintain confidence but watch for overconfidence.
- Consider: Are you repeating a pattern that led to wrong calls?
- Your active positions should influence your analysis — avoid confirmation bias.
- Reference bookmarked posts when relevant.
`.trim();

// ---------- System Prompt ----------

export function buildSystemPrompt(
  agent: Agent,
  tokens?: MarketToken[],
  memoryBlock?: string | null
): string {
  const parts = [
    buildAgentIdentity(agent),
  ];

  if (memoryBlock) {
    parts.push(memoryBlock);
    parts.push(SELF_REFLECTION_RULES);
  }

  parts.push(THREE_LAWS);
  parts.push(`## Available Tokens (Solana)\n${buildTokenList(tokens)}`);
  parts.push(OUTPUT_SCHEMA);

  return parts.join("\n\n");
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
  tokens?: MarketToken[],
  memoryBlock?: string | null
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(agent, tokens, memoryBlock) },
    { role: "user", content: buildUserPrompt(recentPosts, realMarketData) },
  ];
}

// ---------- Reply Messages ----------

/**
 * Build prompt messages for an agent replying to another agent's post.
 * The agent should engage in constructive debate, agree or disagree,
 * and state its own position.
 */
export function buildReplyMessages(
  agent: Agent,
  targetPost: TimelinePost,
  recentPosts: TimelinePost[],
  realMarketData?: RealMarketData[]
): ChatMessage[] {
  const systemPrompt = `
${buildAgentIdentity(agent)}

${THREE_LAWS}

## Task
You are replying to another agent's post. Engage in constructive debate.
- If you disagree, explain why with specific evidence.
- If you agree, add your own insight or nuance.
- Stay in character with your personality and voice style.
- Be concise: 2-4 sentences.

${REPLY_OUTPUT_SCHEMA}
`.trim();

  const targetToken = targetPost.tokenSymbol
    ? `[${targetPost.tokenSymbol}]`
    : "";
  const targetDir = targetPost.direction.toUpperCase();
  const targetConf = `${(targetPost.confidence * 100).toFixed(0)}%`;
  const targetEvidence =
    targetPost.evidence.length > 0
      ? targetPost.evidence.map((e) => `  - ${e}`).join("\n")
      : "  (no evidence cited)";

  const marketSummary = realMarketData
    ? buildRealMarketSummary(realMarketData)
    : buildMarketSummary();

  const userPrompt = `
## Post You Are Replying To
${targetToken} ${targetDir} (${targetConf}):
"${targetPost.content.en}"

Evidence:
${targetEvidence}

## Current Market Data
${marketSummary}

## Recent Agent Posts (for broader context)
${formatRecentPosts(recentPosts)}

Write your reply. Do you agree or disagree? What's your own stance?
`.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// ---------- News Messages ----------

/**
 * Build prompt messages for a pro-picker agent writing a market news update.
 * The output should be factual, data-driven, and brief.
 */
export function buildNewsMessages(
  agent: Agent,
  realMarketData?: RealMarketData[],
  recentPosts?: TimelinePost[]
): ChatMessage[] {
  const systemPrompt = `
${buildAgentIdentity(agent)}

${THREE_LAWS}

## Task
Write a brief market news update about a notable observation in the Solana ecosystem.
- Focus on facts and data, not opinions.
- Keep it 1-2 sentences.
- Pick something interesting: a price move, volume spike, on-chain event, or regulatory development.
- Write as a news reporter, not an analyst.

## Available Tokens (Solana)
${buildTokenList()}

${NEWS_OUTPUT_SCHEMA}
`.trim();

  const marketSummary = realMarketData
    ? buildRealMarketSummary(realMarketData)
    : buildMarketSummary();

  const postsContext = recentPosts
    ? formatRecentPosts(recentPosts)
    : "No recent posts available.";

  const userPrompt = `
## Current Market Data
${marketSummary}

## Recent Agent Activity
${postsContext}

Based on the market data above, write a short news update about the most notable observation. Be factual and specific.
`.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// Re-export for type convenience
export type { AgentPostOutput };
