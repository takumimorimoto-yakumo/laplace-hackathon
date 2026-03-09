// ============================================================
// Prompt Builder — Agent Config → LLM Prompts
// ============================================================

import type { Agent, PredictionMarket, TimelinePost } from "@/lib/types";
import type { AgentPostOutput } from "./response-schema";
import type { ChatMessage } from "./llm-client";

// ---------- Real Market Data Interface ----------

export interface RealMarketData {
  symbol: string;
  address: string;
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
  "should_post": true | false,
  "skip_reason": "Why you chose not to post (only when should_post is false)" | null,
  "token_symbol": "SOL",
  "token_address": "So11111111111111111111111111111111111111112",
  "direction": "bullish" | "bearish" | "neutral",
  "confidence": 0.72,
  "evidence": ["source: on-chain data shows ...", "source: technical pattern ..."],
  "natural_text": "Your analysis post in English. 2-4 sentences. Be specific.",
  "reasoning": "Brief internal reasoning for this call",
  "uncertainty": "What could invalidate this thesis",
  "confidence_rationale": "Why this specific confidence level",
  "price_target": 210.50 | null,
  "stop_loss": 180.00 | null,
  "allocation_pct": 0.10
}

should_post — Set to false if you decide this is NOT a good time to post. When false, only skip_reason is required.
price_target — Concrete target price (take profit) if direction is bullish/bearish. null if neutral.
stop_loss — Price at which to cut losses. null if neutral or no stop planned.
allocation_pct — What fraction of your portfolio to allocate to this trade (0.01 to 0.50). Decide based on your conviction level, risk assessment, and current market conditions.
`.trim();

// ---------- Risk Management Guidelines ----------

const RISK_MANAGEMENT_GUIDELINES = `
## Risk Management Guidelines
These are advisory guidelines — you have full autonomy over allocation decisions:
- Low confidence (< 0.50): consider 1-5% allocation
- Medium confidence (0.50-0.75): consider 5-15% allocation
- High confidence (> 0.75): consider 15-30% allocation
- Extreme conviction with strong evidence: up to 50% is allowed but rare
- Factor in volatility, liquidity, and your recent track record
- Diversification across positions reduces portfolio risk
- Check "Your Portfolio" in the memory section for your current cash balance and exposure before deciding allocation.
- There is no hard minimum cash reserve — use your judgment based on market conditions and your risk tolerance.
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
      if (t.address) parts[0] += ` addr:${t.address}`;
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
  // Use new 7-axis guides if available, otherwise fall back to legacy style guide
  const hasNewAxes = agent.timeHorizon && agent.reasoningStyle;

  const styleGuide = hasNewAxes ? `
## Time Horizon
${agent.timeHorizon === 'scalp' ? 'You scalp on seconds-to-minutes timeframes. React to immediate price action, order flow, and momentum spikes. Your predictions resolve within ~4 hours.' :
  agent.timeHorizon === 'intraday' ? 'You focus on intraday moves within 24 hours. Use short-term technical indicators and react to immediate catalysts. Your predictions resolve within ~24 hours.' :
  agent.timeHorizon === 'swing' ? 'You target swing moves over hours to a few days (crypto moves faster than stocks). Combine technicals with on-chain trends. Your predictions resolve within ~3 days.' :
  agent.timeHorizon === 'position' ? 'You think in days to weeks. Focus on structural trends, macro cycles, and DeFi fundamentals. Your predictions resolve within ~14 days.' :
  'You have a long-term horizon of weeks to months. Focus on fundamental value, macro shifts, and sector rotation. Your predictions resolve within ~30 days.'}

## Reasoning Approach
${agent.reasoningStyle === 'momentum' ? 'You follow price momentum and volume trends. Buy strength, sell weakness.' :
  agent.reasoningStyle === 'contrarian' ? 'You go against prevailing sentiment. Buy fear, sell greed. Look for overcrowded trades.' :
  agent.reasoningStyle === 'fundamental' ? 'You focus on fundamentals: TVL, revenue, protocol economics, macro factors.' :
  agent.reasoningStyle === 'quantitative' ? 'You use data-driven signals and statistical models. Minimize subjective judgment.' :
  'You trade narratives and social momentum. Early entry on emerging trends and stories.'}

## Risk Profile
Risk tolerance: ${agent.riskTolerance ?? 'moderate'}
${agent.riskTolerance === 'conservative' ? 'You prioritize capital preservation. Small positions, tight stops.' :
  agent.riskTolerance === 'aggressive' ? 'You take concentrated bets when conviction is high. Willing to accept drawdowns for outsized returns.' :
  agent.riskTolerance === 'degen' ? 'You chase asymmetric upside with high-risk plays. YOLO when the setup is right.' :
  'You balance risk and reward. Moderate position sizing with defined risk parameters.'}

## Market Focus
${agent.assetFocus === 'blue_chip' ? 'You focus on large-cap, established tokens (SOL, ETH, BTC).' :
  agent.assetFocus === 'defi_tokens' ? 'You specialize in DeFi protocol tokens and yield opportunities.' :
  agent.assetFocus === 'meme' ? 'You hunt meme coins and social momentum plays.' :
  agent.assetFocus === 'infrastructure' ? 'You focus on infrastructure and tooling tokens.' :
  'You analyze the broad market across all token categories.'}
` : `
## Trading Style Guide
Your style determines your time horizon and analysis approach. NOTE: Crypto markets move much faster than traditional markets — adjust your expectations accordingly.
- daytrader: Focus on intraday to 24h moves. Use short-term technical indicators (RSI, MACD, volume spikes). React to immediate catalysts.
- swing: Target moves over hours to a few days. Combine technicals with on-chain trends. Look for trend continuation or reversal setups.
- macro: Think in days to weeks. Focus on monetary policy, regulatory shifts, sector rotation, and structural narratives.
- quant: Use statistical models and data-driven signals. Minimize subjective judgment. Focus on risk-adjusted returns and edge quantification.
- contrarian: Go against prevailing sentiment. Buy fear, sell greed. Look for overcrowded trades and sentiment extremes.
- degen: High-conviction, high-risk plays. Chase asymmetric upside. Early entry on new narratives, memes, and momentum.
`;

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
${styleGuide}
## Investment Outlook Guide
Your current outlook shapes your default stance on market analysis:
- ultra_bullish: You actively seek bullish signals, tend to see upside in most situations, and are enthusiastic about growth narratives.
- bullish: You lean optimistic but remain grounded. You look for confirmation before committing.
- bearish: You lean cautious and skeptical. You focus on risks, overvaluation, and potential downturns.
- ultra_bearish: You actively seek risks, always expect the worst, and prioritize capital preservation above all.
Stay true to your current outlook while still being data-driven.
Note: Your outlook evolves over time based on your prediction accuracy and portfolio performance. If your bearish calls prove more accurate, you naturally shift bearish — and vice versa. This is not something you control; it reflects your track record.
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

  // Apply directives for any tier (admin can configure system agents too)
  const hasDirectives = agent.userDirectives || agent.customWatchlist?.length || agent.userAlpha;
  if (hasDirectives) {
    const isSystem = agent.tier !== 'user';
    const dirLabel = isSystem ? 'Admin Configuration Overrides' : "Your Coach's Strategic Directives";
    const alphaLabel = isSystem ? 'Admin Intelligence' : 'Intelligence from Your Coach';
    const dirParts: string[] = [];
    if (agent.userDirectives) {
      dirParts.push(`## ${dirLabel}\n${agent.userDirectives}`);
    }
    if (agent.customWatchlist?.length) {
      dirParts.push(`## Priority Watchlist\nFocus on: ${agent.customWatchlist.join(', ')}`);
    }
    if (agent.userAlpha) {
      dirParts.push(`## ${alphaLabel}\n${agent.userAlpha}\nVerify against your data sources.`);
    }
    if (dirParts.length > 0) parts.push(dirParts.join('\n\n'));
  }

  parts.push(THREE_LAWS);
  parts.push(`## Available Tokens (Solana)\n${buildTokenList(marketData)}`);
  parts.push(OUTPUT_SCHEMA);
  parts.push(RISK_MANAGEMENT_GUIDELINES);

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

First, decide whether the current market conditions warrant a post from you right now. Set "should_post" to false if:
- The market is calm with no significant moves or catalysts
- You have low confidence and nothing meaningful to say
- Recent agent posts already cover what you would say
- There is no actionable insight you can offer right now

If you DO decide to post, pick a token and make your prediction. Be specific and cite evidence.
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
  const isContrarian = agent.reasoningStyle === "contrarian" || agent.style === "contrarian";
  if (isContrarian) {
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

// ---------- Prediction Market Formatter ----------

function formatPredictionMarkets(markets: PredictionMarket[]): string {
  if (markets.length === 0) return "";

  return markets
    .map((m) => {
      const condition =
        m.conditionType === "price_above"
          ? `${m.tokenSymbol} > $${m.threshold}`
          : `${m.tokenSymbol} < $${m.threshold}`;

      const totalPool = m.poolYes + m.poolNo;
      const yesPrice = totalPool > 0 ? ((m.poolYes / totalPool) * 100).toFixed(0) : "50";
      const noPrice = totalPool > 0 ? ((m.poolNo / totalPool) * 100).toFixed(0) : "50";

      const deadlineDate = new Date(m.deadline);
      const now = new Date();
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      const timeLeft = diffHours >= 48 ? `${Math.ceil(diffHours / 24)}d` : `${diffHours}h`;

      return `- market_id: ${m.marketId}\n  ${condition} | YES ${yesPrice}% / NO ${noPrice}% | Pool: $${totalPool} | Expires: ${timeLeft}`;
    })
    .join("\n");
}

// ---------- Browse Output Schema ----------

const BROWSE_OUTPUT_SCHEMA = `
## Output Format
Respond with a single JSON object (no markdown, no extra text):
{
  "reactions": [
    {
      "post_id": "<uuid of the post>",
      "like": true | false,
      "vote": "up" | "down" | "none",
      "bookmark": true | false,
      "follow_author": true | false,
      "reason": "Brief reason for your reaction (1 sentence)"
    }
  ],
  "market_bets": [
    {
      "market_id": "<uuid of the market>",
      "side": "yes" | "no",
      "reason": "Brief reason for this bet (1 sentence)"
    }
  ],
  "market_mood": "Your 1-sentence overall impression of the current timeline"
}

Rules for reactions:
- You do NOT need to react to every post. Only react to posts that genuinely interest you.
- "like" — true if the post is well-written, insightful, or you appreciate the analysis (regardless of agreement).
- "vote" — "up" for high-quality analysis, "down" for low-quality or misleading, "none" if neutral.
- "bookmark" — true only for posts with unique data or insight you want to remember.
- "follow_author" — true only if the author consistently impresses you.
- Be selective: 3-6 reactions out of the posts shown is realistic.

Rules for market_bets:
- Only bet on markets where you have a clear opinion. You may leave market_bets as an empty array [].
- "side" — "yes" if you think the condition will be met, "no" if you think it won't.
- Maximum 3 bets. Each bet costs 100 USDC (virtual).
- Consider the current pool distribution — contrarian bets can be more profitable.
`.trim();

// ---------- Browse Messages ----------

/**
 * Build prompt messages for an agent browsing the timeline.
 * The agent reviews recent posts and decides which to like, vote, bookmark, or follow.
 */
export function buildBrowseMessages(
  agent: Agent,
  timelinePosts: TimelinePost[],
  realMarketData: RealMarketData[],
  predictionMarkets?: PredictionMarket[]
): ChatMessage[] {
  const hasPredictionMarkets = predictionMarkets && predictionMarkets.length > 0;

  const taskLines = [
    "You are scrolling through the Laplace timeline. Review the posts below and react naturally.",
    "- Like posts you find insightful (even if you disagree with the direction).",
    "- Vote on post quality (up = well-reasoned, down = low-effort or misleading).",
    "- Bookmark posts with unique data you want to reference later.",
    "- Follow authors who consistently produce valuable analysis.",
  ];

  if (hasPredictionMarkets) {
    taskLines.push("- Review the open prediction markets and decide whether to place bets.");
    taskLines.push("- Only bet when you have a strong conviction. Skipping all markets is fine.");
  }

  taskLines.push("- Stay in character: your personality and outlook should influence your reactions.");

  const systemPrompt = `
${buildAgentIdentity(agent)}

${THREE_LAWS}

## Task
${taskLines.join("\n")}

${BROWSE_OUTPUT_SCHEMA}
`.trim();

  const postsList = timelinePosts
    .map((p) => {
      const token = p.tokenSymbol ? `[${p.tokenSymbol}]` : "";
      const dir = p.direction.toUpperCase();
      const conf = `${(p.confidence * 100).toFixed(0)}%`;
      const text = p.content.en.slice(0, 200);
      return `- post_id: ${p.id}\n  ${token} ${dir} (${conf}): "${text}"`;
    })
    .join("\n");

  const marketSummary = buildRealMarketSummary(realMarketData);

  const marketSection = hasPredictionMarkets
    ? `\n\n## Open Prediction Markets\n${formatPredictionMarkets(predictionMarkets)}\n\nReview these markets and decide whether to bet YES or NO on any of them. You may skip all.`
    : "";

  const userPrompt = `
## Current Market Data
${marketSummary}

## Timeline Posts (most recent first)
${postsList}${marketSection}

Browse the timeline above and react. Be yourself — react only to posts that genuinely catch your attention.
`.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// ---------- Chat System Prompt ----------

/**
 * Build system prompt for private 1-on-1 chat between a renter and an agent.
 * The agent should maintain its personality and respond concisely.
 */
export function buildChatSystemPrompt(
  agent: Agent,
  marketSummary?: string
): string {
  const parts = [
    buildAgentIdentity(agent),
    THREE_LAWS,
    `## Chat Instructions
- You are in a private 1-on-1 conversation with a user who has rented your services.
- Maintain your personality, voice style, and investment outlook at all times.
- Respond in the same language the user writes in. If unsure, default to English.
- Be concise: 2-5 sentences per response. Get to the point.
- You may discuss crypto markets, tokens, trading strategies, and your own analysis.
- If the user asks about your positions or predictions, share your honest assessment.
- Do not generate JSON. Respond in natural language only.`,
  ];

  if (marketSummary) {
    parts.push(`## Current Market Context\n${marketSummary}`);
  }

  return parts.join("\n\n");
}

// ---------- Pricing Messages ----------

/**
 * Build prompt messages for an agent to determine its own monthly subscription price.
 * The agent considers its performance stats and subscriber base.
 */
export function buildPricingMessages(
  agent: Agent,
  stats: { subscriberCount: number; accuracy: number; rank: number; portfolioReturn: number }
): ChatMessage[] {
  const systemPrompt = `
You are "${agent.name}", an AI crypto analyst agent in Laplace.

## Task
Determine your monthly subscription price in USDC. Consider:
- Your accuracy: ${(stats.accuracy * 100).toFixed(0)}%
- Your rank: #${stats.rank}
- Your portfolio return: ${(stats.portfolioReturn * 100).toFixed(1)}%
- Current subscribers: ${stats.subscriberCount}
- Your style: ${agent.style}${agent.reasoningStyle ? ` (${agent.reasoningStyle})` : ''}${agent.riskTolerance ? ` / risk: ${agent.riskTolerance}` : ''}

## Pricing Guidelines
- Range: $1.00 to $30.00
- Top performers (>80% accuracy, top 5 rank): $15-$30
- Good performers (60-80% accuracy): $5-$15
- New/average agents: $1-$5
- More subscribers = can charge more
- Better track record = higher price

## Output Format
Respond with a single JSON object:
{
  "price_usdc": 9.99,
  "reasoning": "Brief explanation of pricing decision"
}
`.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Set your monthly subscription price based on your current performance and market position." },
  ];
}

// ---------- Custom Analysis Messages ----------

/**
 * Build prompt messages for a custom analysis request from a subscriber.
 * The agent analyzes a specific token requested by the renter.
 */
export function buildCustomAnalysisMessages(
  agent: Agent,
  tokenSymbol: string,
  realMarketData: RealMarketData[]
): ChatMessage[] {
  const systemPrompt = `
${buildAgentIdentity(agent)}

${THREE_LAWS}

## Task
A subscriber has requested your detailed analysis of ${tokenSymbol}.
Provide a thorough analysis using your expertise and available market data.
You MUST set "should_post" to true — this is a paid custom analysis request.

${OUTPUT_SCHEMA}
`.trim();

  const marketSummary = buildRealMarketSummary(realMarketData);

  const userPrompt = `
## Current Market Data
${marketSummary}

Provide your detailed analysis of ${tokenSymbol}. Focus on:
1. Current price action and momentum
2. Key support/resistance levels or on-chain signals
3. Your directional view with specific evidence
4. Risk factors to watch

Be thorough — this is a custom analysis request from a subscriber.
`.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// Re-export for type convenience
export type { AgentPostOutput };
