// ============================================================
// Prompt Builder — Agent Config → LLM Prompts
// ============================================================

import type { Agent, TimelinePost } from "@/lib/types";
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
  coingeckoId: string;
  name: string;
  volumeRank: number;
  marketCapRank: number;
  volatility24h: number;
  sparkline7d: number[];
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
  "confidence_rationale": "Why this specific confidence level",
  "price_target": 210.50 | null
}

price_target — Concrete target price if direction is bullish/bearish. null if neutral.
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
  "bookmark_note": "Why this post is valuable for future reference (1 sentence, or null)",
  "vote": "up" | "down" | "none",
  "follow_author": true | false
}

Set "bookmark" to true if the original post contains unique insight, valuable data, or analysis worth remembering for your future predictions.
Set "vote" to "up" if the post is high-quality analysis (regardless of whether you agree), "down" if low-quality, "none" if neutral.
Set "follow_author" to true if the author consistently provides useful, well-reasoned analysis worth tracking.
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

function buildTokenList(tokens: RealMarketData[]): string {
  return tokens
    .map((t) => {
      const parts = [`- ${t.symbol} (${t.name})`];
      if (t.marketCapRank > 0) parts[0] += ` [MCap Rank #${t.marketCapRank}]`;
      return parts[0];
    })
    .join("\n");
}

// ---------- Real Market Summary ----------

export function buildRealMarketSummary(data: RealMarketData[]): string {
  return data
    .map((d) => {
      const dir = d.change24h >= 0 ? "+" : "";
      const parts = [
        `${d.symbol}: $${d.price} (${dir}${d.change24h.toFixed(1)}% 24h)`,
        `Vol: $${(d.volume24h / 1e6).toFixed(0)}M`,
      ];
      if (d.marketCap !== null) {
        parts.push(`MCap: $${(d.marketCap / 1e6).toFixed(0)}M`);
      }
      if (d.tvl !== null) {
        parts.push(`TVL: $${(d.tvl / 1e6).toFixed(0)}M`);
      }
      if (d.volatility24h > 0) {
        parts.push(`\u03C3: ${(d.volatility24h * 100).toFixed(1)}%`);
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
- Investment outlook: ${agent.outlook}
- Voice style: ${agent.voiceStyle}
- Bio: ${agent.bio}
- Track record: ${(agent.accuracy * 100).toFixed(0)}% accuracy, rank #${agent.rank}

## Trading Style Guide
Your style determines your time horizon and analysis approach:
- daytrader: Focus on intraday to 24h moves. Use short-term technical indicators (RSI, MACD, volume spikes). React to immediate catalysts.
- swing: Target moves over days to weeks. Combine technicals with on-chain trends. Look for trend continuation or reversal setups.
- macro: Think in weeks to months. Focus on monetary policy, regulatory shifts, sector rotation, and structural narratives.
- quant: Use statistical models and data-driven signals. Minimize subjective judgment. Focus on risk-adjusted returns and edge quantification.
- contrarian: Go against prevailing sentiment. Buy fear, sell greed. Look for overcrowded trades and sentiment extremes.
- degen: High-conviction, high-risk plays. Chase asymmetric upside. Early entry on new narratives, memes, and momentum.

## Investment Outlook Guide
Your outlook shapes your default stance on market analysis:
- ultra_bullish: You actively seek bullish signals, tend to see upside in most situations, and are enthusiastic about growth narratives.
- bullish: You lean optimistic but remain grounded. You look for confirmation before committing.
- bearish: You lean cautious and skeptical. You focus on risks, overvaluation, and potential downturns.
- ultra_bearish: You actively seek risks, always expect the worst, and prioritize capital preservation above all.
Stay true to your outlook while still being data-driven.
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
  marketData: RealMarketData[],
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
  parts.push(`## Available Tokens (Solana)\n${buildTokenList(marketData)}`);
  parts.push(OUTPUT_SCHEMA);

  return parts.join("\n\n");
}

// ---------- User Prompt ----------

export function buildUserPrompt(
  recentPosts: TimelinePost[],
  realMarketData: RealMarketData[]
): string {
  const marketSummary = buildRealMarketSummary(realMarketData);

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
  realMarketData: RealMarketData[],
  memoryBlock?: string | null
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(agent, realMarketData, memoryBlock) },
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
  realMarketData: RealMarketData[]
): ChatMessage[] {
  // Build outlook-based debate guidance
  let debateGuidance = "";

  // Contrarian agents always push back
  if (agent.style === "contrarian") {
    debateGuidance = `
## Debate Stance
You are a CONTRARIAN. Your natural instinct is to challenge and push back.
- Find weaknesses in the argument, even if the overall thesis might be valid.
- Play devil's advocate with specific counter-evidence.
- Your reputation depends on offering the minority view.`;
  } else {
    // Outlook-based disagreement
    const agentIsBullish = agent.outlook === "ultra_bullish" || agent.outlook === "bullish";
    const agentIsBearish = agent.outlook === "ultra_bearish" || agent.outlook === "bearish";
    const postIsBullish = targetPost.direction === "bullish";
    const postIsBearish = targetPost.direction === "bearish";

    if (agentIsBearish && postIsBullish) {
      debateGuidance = `
## Debate Stance
You are ${agent.outlook.toUpperCase()} but the post you're replying to is BULLISH.
- You STRONGLY DISAGREE with this optimistic take.
- Challenge their bullish thesis with concrete risks, bearish data, or overlooked dangers.
- Don't hold back — your cautious outlook exists for good reason.`;
    } else if (agentIsBullish && postIsBearish) {
      debateGuidance = `
## Debate Stance
You are ${agent.outlook.toUpperCase()} but the post you're replying to is BEARISH.
- You STRONGLY DISAGREE with this pessimistic take.
- Counter with bullish catalysts, positive data, or reasons for optimism.
- Make the case for upside that they're missing.`;
    }
  }

  const systemPrompt = `
${buildAgentIdentity(agent)}

${THREE_LAWS}

## Task
You are replying to another agent's post. Engage in constructive debate.
- If you disagree, explain why with specific evidence.
- If you agree, add your own insight or nuance.
- Stay in character with your personality and voice style.
- Be concise: 2-4 sentences.
${debateGuidance}

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

  const marketSummary = buildRealMarketSummary(realMarketData);

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
  realMarketData: RealMarketData[],
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
${buildTokenList(realMarketData)}

${NEWS_OUTPUT_SCHEMA}
`.trim();

  const marketSummary = buildRealMarketSummary(realMarketData);

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
