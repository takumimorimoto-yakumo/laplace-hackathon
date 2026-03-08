import { describe, it, expect } from "vitest";
import {
  buildRealMarketSummary,
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
  buildReplyMessages,
  buildBrowseMessages,
  buildPricingMessages,
  buildChatSystemPrompt,
} from "@/lib/agents/prompt-builder";
import type { RealMarketData } from "@/lib/agents/prompt-builder";
import type { Agent, TimelinePost, PredictionMarket } from "@/lib/types";

// ============================================================
// Mock Data Factories
// ============================================================

function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-001",
    name: "TestBot Alpha",
    style: "swing",
    modules: ["technical", "onchain"],
    llm: "claude-sonnet",
    accuracy: 0.72,
    rank: 5,
    totalVotes: 1200,
    trend: "stable",
    portfolioValue: 50000,
    portfolioReturn: 0.15,
    bio: "A swing trader focused on Solana ecosystem tokens.",
    personality: "Calm, data-driven, and methodical.",
    outlook: "bullish",
    voiceStyle: "analytical",
    temperature: 0.7,
    cycleIntervalMinutes: 30,
    isSystem: true,
    tier: "system",
    totalPredictions: 0,
    isPaused: false,
    totalVotesGiven: 340,
    followerCount: 89,
    followingCount: 12,
    replyCount: 45,
    rentalPriceUsdc: 9.99,
    ...overrides,
  };
}

function createMockMarketData(overrides: Partial<RealMarketData> = {}): RealMarketData {
  return {
    symbol: "SOL",
    address: "So11111111111111111111111111111111111111112",
    price: 185.5,
    change24h: 3.2,
    volume24h: 2_500_000_000,
    tvl: 800_000_000,
    marketCap: 85_000_000_000,
    coingeckoId: "solana",
    name: "Solana",
    volumeRank: 1,
    marketCapRank: 5,
    volatility24h: 0.045,
    sparkline7d: [170, 172, 178, 180, 183, 185, 185.5],
    ...overrides,
  };
}

function createMockPost(overrides: Partial<TimelinePost> = {}): TimelinePost {
  return {
    id: "post-001",
    agentId: "agent-002",
    content: {
      en: "SOL showing strong accumulation patterns on-chain with whale addresses increasing.",
      ja: "SOLはオンチェーンで強い蓄積パターンを示しています。",
      zh: "SOL在链上显示出强劲的积累模式。",
    },
    direction: "bullish",
    confidence: 0.8,
    tokenSymbol: "SOL",
    tokenAddress: "So11111111111111111111111111111111111111112",
    priceAtPrediction: 183.0,
    evidence: [
      "source: on-chain data shows whale accumulation",
      "source: RSI at 62, not yet overbought",
    ],
    evidenceLocalized: null,
    likes: 15,
    upvotes: 10,
    downvotes: 2,
    createdAt: "2026-03-08T10:00:00Z",
    isRevision: false,
    previousConfidence: null,
    publishedAt: "2026-03-08T10:00:00Z",
    parentId: null,
    replies: [],
    ...overrides,
  };
}

function createMockPredictionMarket(
  overrides: Partial<PredictionMarket> = {}
): PredictionMarket {
  return {
    marketId: "market-001",
    proposerAgentId: "agent-003",
    sourcePostId: "post-003",
    tokenSymbol: "SOL",
    conditionType: "price_above",
    threshold: 200,
    priceAtCreation: 185.0,
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    poolYes: 500,
    poolNo: 300,
    createdAt: "2026-03-08T08:00:00Z",
    isResolved: false,
    outcome: null,
    ...overrides,
  };
}

// ============================================================
// buildRealMarketSummary
// ============================================================

describe("buildRealMarketSummary", () => {
  it("formats a single token with all fields", () => {
    const data = [createMockMarketData()];
    const result = buildRealMarketSummary(data);

    expect(result).toContain("SOL: $185.5");
    expect(result).toContain("+3.2%");
    expect(result).toContain("24h");
    expect(result).toContain("Vol: $2500M");
    expect(result).toContain("MCap: $85000M");
    expect(result).toContain("TVL: $800M");
    // volatility sigma character
    expect(result).toContain("\u03C3: 4.5%");
  });

  it("formats multiple tokens separated by newlines", () => {
    const data = [
      createMockMarketData({ symbol: "SOL", price: 185.5, change24h: 3.2 }),
      createMockMarketData({
        symbol: "JUP",
        price: 1.23,
        change24h: -5.1,
        volume24h: 150_000_000,
        marketCap: 1_200_000_000,
        tvl: 400_000_000,
        volatility24h: 0.08,
      }),
    ];
    const result = buildRealMarketSummary(data);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("SOL");
    expect(lines[1]).toContain("JUP");
    expect(lines[1]).toContain("-5.1%");
  });

  it("omits MCap when marketCap is null", () => {
    const data = [createMockMarketData({ marketCap: null })];
    const result = buildRealMarketSummary(data);

    expect(result).not.toContain("MCap:");
  });

  it("omits TVL when tvl is null", () => {
    const data = [createMockMarketData({ tvl: null })];
    const result = buildRealMarketSummary(data);

    expect(result).not.toContain("TVL:");
  });

  it("omits volatility when volatility24h is zero", () => {
    const data = [createMockMarketData({ volatility24h: 0 })];
    const result = buildRealMarketSummary(data);

    expect(result).not.toContain("\u03C3:");
  });

  it("returns empty string for empty array", () => {
    const result = buildRealMarketSummary([]);
    expect(result).toBe("");
  });

  it("shows + prefix for positive change and no prefix for negative", () => {
    const pos = [createMockMarketData({ change24h: 2.5 })];
    const neg = [createMockMarketData({ change24h: -4.3 })];

    expect(buildRealMarketSummary(pos)).toContain("+2.5%");
    expect(buildRealMarketSummary(neg)).toContain("-4.3%");
    expect(buildRealMarketSummary(neg)).not.toContain("+-");
  });

  it("handles zero change24h with + prefix", () => {
    const data = [createMockMarketData({ change24h: 0 })];
    const result = buildRealMarketSummary(data);

    expect(result).toContain("+0.0%");
  });

  it("omits both MCap and TVL when both are null", () => {
    const data = [createMockMarketData({ marketCap: null, tvl: null })];
    const result = buildRealMarketSummary(data);

    expect(result).not.toContain("MCap:");
    expect(result).not.toContain("TVL:");
    // Should still have price and volume
    expect(result).toContain("Vol:");
  });
});

// ============================================================
// buildSystemPrompt
// ============================================================

describe("buildSystemPrompt", () => {
  const agent = createMockAgent();
  const marketData = [createMockMarketData()];

  it("contains agent identity information", () => {
    const prompt = buildSystemPrompt(agent, marketData);

    expect(prompt).toContain(`"${agent.name}"`);
    expect(prompt).toContain(`Style: ${agent.style}`);
    expect(prompt).toContain("technical, onchain");
    expect(prompt).toContain(agent.personality);
    expect(prompt).toContain(agent.outlook);
    expect(prompt).toContain(agent.voiceStyle);
    expect(prompt).toContain(agent.bio);
    expect(prompt).toContain("72% accuracy");
    expect(prompt).toContain("rank #5");
  });

  it("contains the Three Laws", () => {
    const prompt = buildSystemPrompt(agent, marketData);

    expect(prompt).toContain("Three Laws");
    expect(prompt).toContain("AI agent in Laplace");
    expect(prompt).toContain("confidence level honestly");
    expect(prompt).toContain("virtual predictions only");
  });

  it("contains token list from market data", () => {
    const prompt = buildSystemPrompt(agent, marketData);

    expect(prompt).toContain("Available Tokens (Solana)");
    expect(prompt).toContain("SOL (Solana)");
    expect(prompt).toContain("addr:So11111111111111111111111111111111111111112");
    expect(prompt).toContain("[MCap Rank #5]");
  });

  it("contains output schema including allocation_pct", () => {
    const prompt = buildSystemPrompt(agent, marketData);

    expect(prompt).toContain("Output Format");
    expect(prompt).toContain("should_post");
    expect(prompt).toContain("token_symbol");
    expect(prompt).toContain("direction");
    expect(prompt).toContain("confidence");
    expect(prompt).toContain("natural_text");
    expect(prompt).toContain("price_target");
    expect(prompt).toContain("allocation_pct");
  });

  it("contains risk management guidelines", () => {
    const prompt = buildSystemPrompt(agent, marketData);

    expect(prompt).toContain("Risk Management Guidelines");
    expect(prompt).toContain("advisory guidelines");
    expect(prompt).toContain("full autonomy");
  });

  it("includes memory block and self-reflection rules when provided", () => {
    const memoryBlock = "## Memory\n- Correct on SOL last time\n- Wrong on JUP";
    const prompt = buildSystemPrompt(agent, marketData, memoryBlock);

    expect(prompt).toContain("## Memory");
    expect(prompt).toContain("Correct on SOL last time");
    expect(prompt).toContain("Self-Reflection Rules");
    expect(prompt).toContain("track record");
  });

  it("excludes memory block and self-reflection when memoryBlock is undefined", () => {
    const prompt = buildSystemPrompt(agent, marketData);

    expect(prompt).not.toContain("Self-Reflection Rules");
  });

  it("excludes memory block and self-reflection when memoryBlock is null", () => {
    const prompt = buildSystemPrompt(agent, marketData, null);

    expect(prompt).not.toContain("Self-Reflection Rules");
  });

  it("excludes memory block and self-reflection when memoryBlock is empty string", () => {
    const prompt = buildSystemPrompt(agent, marketData, "");

    expect(prompt).not.toContain("Self-Reflection Rules");
  });

  it("includes user directives for user-tier agent", () => {
    const userAgent = createMockAgent({
      tier: "user",
      isSystem: false,
      userDirectives: "Focus on meme coins",
      customWatchlist: ["BONK", "WIF"],
      userAlpha: "Big airdrop coming for BONK holders",
    });
    const prompt = buildSystemPrompt(userAgent, marketData);

    expect(prompt).toContain("Your Coach's Strategic Directives");
    expect(prompt).toContain("Focus on meme coins");
    expect(prompt).toContain("Priority Watchlist");
    expect(prompt).toContain("BONK, WIF");
    expect(prompt).toContain("Intelligence from Your Coach");
    expect(prompt).toContain("Big airdrop coming for BONK holders");
    expect(prompt).toContain("Verify against your data sources");
  });

  it("excludes user directives for system-tier agent even when fields are set", () => {
    const sysAgent = createMockAgent({
      tier: "system",
      userDirectives: "Should not appear",
      customWatchlist: ["SOL"],
      userAlpha: "Should not appear",
    });
    const prompt = buildSystemPrompt(sysAgent, marketData);

    expect(prompt).not.toContain("Your Coach's Strategic Directives");
    expect(prompt).not.toContain("Priority Watchlist");
    expect(prompt).not.toContain("Intelligence from Your Coach");
  });

  it("handles user-tier agent with no directives set", () => {
    const userAgent = createMockAgent({
      tier: "user",
      isSystem: false,
    });
    const prompt = buildSystemPrompt(userAgent, marketData);

    expect(prompt).not.toContain("Your Coach's Strategic Directives");
    expect(prompt).not.toContain("Priority Watchlist");
    expect(prompt).not.toContain("Intelligence from Your Coach");
  });

  it("handles empty market data array", () => {
    const prompt = buildSystemPrompt(agent, []);

    expect(prompt).toContain("Available Tokens (Solana)");
    expect(prompt).toContain(agent.name);
  });

  it("lists multiple tokens in the token list", () => {
    const multiMarket = [
      createMockMarketData({ symbol: "SOL", name: "Solana", marketCapRank: 5 }),
      createMockMarketData({ symbol: "JUP", name: "Jupiter", marketCapRank: 42 }),
    ];
    const prompt = buildSystemPrompt(agent, multiMarket);

    expect(prompt).toContain("SOL (Solana)");
    expect(prompt).toContain("[MCap Rank #5]");
    expect(prompt).toContain("JUP (Jupiter)");
    expect(prompt).toContain("[MCap Rank #42]");
  });

  it("omits MCap Rank when marketCapRank is 0", () => {
    const data = [createMockMarketData({ marketCapRank: 0 })];
    const prompt = buildSystemPrompt(agent, data);

    expect(prompt).not.toContain("[MCap Rank #0]");
  });
});

// ============================================================
// buildUserPrompt
// ============================================================

describe("buildUserPrompt", () => {
  const marketData = [createMockMarketData()];

  it("contains current market data section", () => {
    const posts = [createMockPost()];
    const result = buildUserPrompt(posts, marketData);

    expect(result).toContain("Current Market Data");
    expect(result).toContain("SOL: $185.5");
  });

  it("contains recent agent posts", () => {
    const posts = [createMockPost()];
    const result = buildUserPrompt(posts, marketData);

    expect(result).toContain("Recent Agent Posts");
    expect(result).toContain("[SOL]");
    expect(result).toContain("BULLISH");
    expect(result).toContain("80%");
    expect(result).toContain("SOL showing strong accumulation");
  });

  it("shows 'No recent posts' message for empty posts array", () => {
    const result = buildUserPrompt([], marketData);

    expect(result).toContain("No recent posts from other agents.");
  });

  it("contains decision guidance about should_post", () => {
    const result = buildUserPrompt([], marketData);

    expect(result).toContain("should_post");
    expect(result).toContain("market is calm");
    expect(result).toContain("low confidence");
  });

  it("formats multiple posts", () => {
    const posts = [
      createMockPost({ direction: "bullish", confidence: 0.9, tokenSymbol: "SOL" }),
      createMockPost({
        id: "post-002",
        direction: "bearish",
        confidence: 0.65,
        tokenSymbol: "JUP",
        content: {
          en: "JUP looking weak with declining volume and bearish divergence on daily.",
          ja: "JUPは弱く見えます。",
          zh: "JUP看起来很弱。",
        },
      }),
    ];
    const result = buildUserPrompt(posts, marketData);

    expect(result).toContain("[SOL] BULLISH (90%)");
    expect(result).toContain("[JUP] BEARISH (65%)");
  });

  it("handles post with null tokenSymbol", () => {
    const post = createMockPost({ tokenSymbol: null });
    const result = buildUserPrompt([post], marketData);

    // Should not have brackets around null token
    expect(result).toContain("BULLISH (80%)");
    expect(result).not.toContain("[null]");
  });
});

// ============================================================
// buildMessages
// ============================================================

describe("buildMessages", () => {
  const agent = createMockAgent();
  const marketData = [createMockMarketData()];
  const posts = [createMockPost()];

  it("returns exactly 2 ChatMessage objects", () => {
    const messages = buildMessages(agent, posts, marketData);

    expect(messages).toHaveLength(2);
  });

  it("first message has role 'system'", () => {
    const messages = buildMessages(agent, posts, marketData);

    expect(messages[0].role).toBe("system");
  });

  it("second message has role 'user'", () => {
    const messages = buildMessages(agent, posts, marketData);

    expect(messages[1].role).toBe("user");
  });

  it("system message contains agent identity and three laws", () => {
    const messages = buildMessages(agent, posts, marketData);

    expect(messages[0].content).toContain(agent.name);
    expect(messages[0].content).toContain("Three Laws");
    expect(messages[0].content).toContain("Output Format");
  });

  it("user message contains market data and posts", () => {
    const messages = buildMessages(agent, posts, marketData);

    expect(messages[1].content).toContain("Current Market Data");
    expect(messages[1].content).toContain("Recent Agent Posts");
    expect(messages[1].content).toContain("SOL");
  });

  it("passes memoryBlock through to system prompt", () => {
    const memory = "## Recent Performance\n- 3 correct calls in a row";
    const messages = buildMessages(agent, posts, marketData, memory);

    expect(messages[0].content).toContain("Recent Performance");
    expect(messages[0].content).toContain("Self-Reflection Rules");
  });

  it("does not include memory when memoryBlock is null", () => {
    const messages = buildMessages(agent, posts, marketData, null);

    expect(messages[0].content).not.toContain("Self-Reflection Rules");
  });
});

// ============================================================
// buildReplyMessages
// ============================================================

describe("buildReplyMessages", () => {
  const marketData = [createMockMarketData()];
  const recentPosts = [createMockPost()];

  it("returns 2 ChatMessage objects with correct roles", () => {
    const agent = createMockAgent();
    const targetPost = createMockPost();
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("includes contrarian debate guidance for contrarian agents", () => {
    const agent = createMockAgent({ style: "contrarian" });
    const targetPost = createMockPost({ direction: "bullish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).toContain("Debate Stance");
    expect(messages[0].content).toContain("CONTRARIAN");
    expect(messages[0].content).toContain("challenge and push back");
    expect(messages[0].content).toContain("devil's advocate");
  });

  it("includes bearish vs bullish clash guidance", () => {
    const agent = createMockAgent({ style: "swing", outlook: "bearish" });
    const targetPost = createMockPost({ direction: "bullish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).toContain("Debate Stance");
    expect(messages[0].content).toContain("BEARISH");
    expect(messages[0].content).toContain("STRONGLY DISAGREE");
    expect(messages[0].content).toContain("optimistic take");
  });

  it("includes bullish vs bearish clash guidance", () => {
    const agent = createMockAgent({ style: "swing", outlook: "bullish" });
    const targetPost = createMockPost({ direction: "bearish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).toContain("Debate Stance");
    expect(messages[0].content).toContain("BULLISH");
    expect(messages[0].content).toContain("STRONGLY DISAGREE");
    expect(messages[0].content).toContain("pessimistic take");
  });

  it("includes ultra_bullish vs bearish clash guidance", () => {
    const agent = createMockAgent({ style: "macro", outlook: "ultra_bullish" });
    const targetPost = createMockPost({ direction: "bearish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).toContain("ULTRA_BULLISH");
    expect(messages[0].content).toContain("STRONGLY DISAGREE");
  });

  it("includes ultra_bearish vs bullish clash guidance", () => {
    const agent = createMockAgent({ style: "quant", outlook: "ultra_bearish" });
    const targetPost = createMockPost({ direction: "bullish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).toContain("ULTRA_BEARISH");
    expect(messages[0].content).toContain("STRONGLY DISAGREE");
  });

  it("does not include debate stance when same direction (bullish + bullish)", () => {
    const agent = createMockAgent({ style: "swing", outlook: "bullish" });
    const targetPost = createMockPost({ direction: "bullish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).not.toContain("Debate Stance");
    expect(messages[0].content).not.toContain("STRONGLY DISAGREE");
  });

  it("does not include debate stance for neutral post with non-contrarian agent", () => {
    const agent = createMockAgent({ style: "swing", outlook: "bearish" });
    const targetPost = createMockPost({ direction: "neutral" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).not.toContain("Debate Stance");
  });

  it("contrarian style overrides outlook-based guidance", () => {
    // Even though outlook matches direction, contrarian always pushes back
    const agent = createMockAgent({ style: "contrarian", outlook: "bullish" });
    const targetPost = createMockPost({ direction: "bullish" });
    const messages = buildReplyMessages(agent, targetPost, recentPosts, marketData);

    expect(messages[0].content).toContain("CONTRARIAN");
    expect(messages[0].content).not.toContain("STRONGLY DISAGREE");
  });

  it("user message contains the target post details", () => {
    const targetPost = createMockPost({
      tokenSymbol: "JUP",
      direction: "bearish",
      confidence: 0.65,
    });
    const messages = buildReplyMessages(
      createMockAgent(),
      targetPost,
      recentPosts,
      marketData
    );

    expect(messages[1].content).toContain("Post You Are Replying To");
    expect(messages[1].content).toContain("[JUP]");
    expect(messages[1].content).toContain("BEARISH");
    expect(messages[1].content).toContain("65%");
  });

  it("shows evidence from target post", () => {
    const targetPost = createMockPost({
      evidence: ["source: whale selling detected", "source: RSI overbought"],
    });
    const messages = buildReplyMessages(
      createMockAgent(),
      targetPost,
      recentPosts,
      marketData
    );

    expect(messages[1].content).toContain("source: whale selling detected");
    expect(messages[1].content).toContain("source: RSI overbought");
  });

  it("shows '(no evidence cited)' when evidence is empty", () => {
    const targetPost = createMockPost({ evidence: [] });
    const messages = buildReplyMessages(
      createMockAgent(),
      targetPost,
      recentPosts,
      marketData
    );

    expect(messages[1].content).toContain("(no evidence cited)");
  });

  it("includes reply output schema in system message", () => {
    const messages = buildReplyMessages(
      createMockAgent(),
      createMockPost(),
      recentPosts,
      marketData
    );

    expect(messages[0].content).toContain("agree");
    expect(messages[0].content).toContain("bookmark");
    expect(messages[0].content).toContain("vote");
    expect(messages[0].content).toContain("follow_author");
  });

  it("includes market data in user message", () => {
    const messages = buildReplyMessages(
      createMockAgent(),
      createMockPost(),
      recentPosts,
      marketData
    );

    expect(messages[1].content).toContain("Current Market Data");
    expect(messages[1].content).toContain("SOL: $185.5");
  });
});

// ============================================================
// buildBrowseMessages
// ============================================================

describe("buildBrowseMessages", () => {
  const agent = createMockAgent();
  const marketData = [createMockMarketData()];
  const posts = [createMockPost()];

  it("returns 2 ChatMessage objects with correct roles", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("system message contains agent identity and three laws", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages[0].content).toContain(agent.name);
    expect(messages[0].content).toContain("Three Laws");
  });

  it("system message contains browse task instructions", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages[0].content).toContain("scrolling through the Laplace timeline");
    expect(messages[0].content).toContain("Like posts you find insightful");
    expect(messages[0].content).toContain("Vote on post quality");
    expect(messages[0].content).toContain("Bookmark posts");
    expect(messages[0].content).toContain("Follow authors");
  });

  it("system message contains browse output schema", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages[0].content).toContain("reactions");
    expect(messages[0].content).toContain("market_bets");
    expect(messages[0].content).toContain("market_mood");
  });

  it("user message contains post IDs and details", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages[1].content).toContain("post_id: post-001");
    expect(messages[1].content).toContain("[SOL]");
    expect(messages[1].content).toContain("BULLISH");
    expect(messages[1].content).toContain("80%");
  });

  it("includes prediction market instructions when markets provided", () => {
    const markets = [createMockPredictionMarket()];
    const messages = buildBrowseMessages(agent, posts, marketData, markets);

    expect(messages[0].content).toContain("Review the open prediction markets");
    expect(messages[1].content).toContain("Open Prediction Markets");
    expect(messages[1].content).toContain("market_id: market-001");
    expect(messages[1].content).toContain("SOL > $200");
  });

  it("excludes prediction market section when no markets provided", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages[0].content).not.toContain(
      "Review the open prediction markets"
    );
    expect(messages[1].content).not.toContain("Open Prediction Markets");
  });

  it("excludes prediction market section for empty markets array", () => {
    const messages = buildBrowseMessages(agent, posts, marketData, []);

    expect(messages[0].content).not.toContain(
      "Review the open prediction markets"
    );
    expect(messages[1].content).not.toContain("Open Prediction Markets");
  });

  it("formats prediction market pool distribution", () => {
    const markets = [
      createMockPredictionMarket({ poolYes: 700, poolNo: 300 }),
    ];
    const messages = buildBrowseMessages(agent, posts, marketData, markets);

    // 700/1000 = 70%, 300/1000 = 30%
    expect(messages[1].content).toContain("YES 70%");
    expect(messages[1].content).toContain("NO 30%");
    expect(messages[1].content).toContain("Pool: $1000");
  });

  it("formats price_below condition type", () => {
    const markets = [
      createMockPredictionMarket({
        conditionType: "price_below",
        tokenSymbol: "JUP",
        threshold: 0.8,
      }),
    ];
    const messages = buildBrowseMessages(agent, posts, marketData, markets);

    expect(messages[1].content).toContain("JUP < $0.8");
  });

  it("includes market data in user message", () => {
    const messages = buildBrowseMessages(agent, posts, marketData);

    expect(messages[1].content).toContain("Current Market Data");
    expect(messages[1].content).toContain("SOL: $185.5");
  });
});

// ============================================================
// buildPricingMessages
// ============================================================

describe("buildPricingMessages", () => {
  const agent = createMockAgent();

  it("returns 2 ChatMessage objects with correct roles", () => {
    const stats = {
      subscriberCount: 25,
      accuracy: 0.78,
      rank: 3,
      portfolioReturn: 0.22,
    };
    const messages = buildPricingMessages(agent, stats);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("system message contains agent name", () => {
    const stats = {
      subscriberCount: 10,
      accuracy: 0.65,
      rank: 20,
      portfolioReturn: 0.05,
    };
    const messages = buildPricingMessages(agent, stats);

    expect(messages[0].content).toContain(agent.name);
  });

  it("system message contains formatted stats", () => {
    const stats = {
      subscriberCount: 25,
      accuracy: 0.78,
      rank: 3,
      portfolioReturn: 0.22,
    };
    const messages = buildPricingMessages(agent, stats);

    expect(messages[0].content).toContain("78%");
    expect(messages[0].content).toContain("#3");
    expect(messages[0].content).toContain("22.0%");
    expect(messages[0].content).toContain("25");
    expect(messages[0].content).toContain(agent.style);
  });

  it("system message contains pricing guidelines", () => {
    const stats = {
      subscriberCount: 5,
      accuracy: 0.5,
      rank: 50,
      portfolioReturn: -0.1,
    };
    const messages = buildPricingMessages(agent, stats);

    expect(messages[0].content).toContain("$1.00 to $30.00");
    expect(messages[0].content).toContain("Top performers");
    expect(messages[0].content).toContain("price_usdc");
    expect(messages[0].content).toContain("reasoning");
  });

  it("user message asks agent to set price", () => {
    const stats = {
      subscriberCount: 0,
      accuracy: 0.5,
      rank: 100,
      portfolioReturn: 0,
    };
    const messages = buildPricingMessages(agent, stats);

    expect(messages[1].content).toContain("monthly subscription price");
  });

  it("handles negative portfolio return", () => {
    const stats = {
      subscriberCount: 2,
      accuracy: 0.4,
      rank: 80,
      portfolioReturn: -0.15,
    };
    const messages = buildPricingMessages(agent, stats);

    expect(messages[0].content).toContain("-15.0%");
  });
});

// ============================================================
// buildChatSystemPrompt
// ============================================================

describe("buildChatSystemPrompt", () => {
  const agent = createMockAgent();

  it("contains agent identity", () => {
    const prompt = buildChatSystemPrompt(agent);

    expect(prompt).toContain(`"${agent.name}"`);
    expect(prompt).toContain(agent.personality);
    expect(prompt).toContain(agent.bio);
    expect(prompt).toContain(agent.voiceStyle);
  });

  it("contains Three Laws", () => {
    const prompt = buildChatSystemPrompt(agent);

    expect(prompt).toContain("Three Laws");
  });

  it("contains chat instructions", () => {
    const prompt = buildChatSystemPrompt(agent);

    expect(prompt).toContain("Chat Instructions");
    expect(prompt).toContain("private 1-on-1 conversation");
    expect(prompt).toContain("rented your services");
    expect(prompt).toContain("Maintain your personality");
    expect(prompt).toContain("natural language only");
  });

  it("includes market context when marketSummary is provided", () => {
    const summary = "SOL: $185.5 (+3.2% 24h) | Vol: $2500M";
    const prompt = buildChatSystemPrompt(agent, summary);

    expect(prompt).toContain("Current Market Context");
    expect(prompt).toContain(summary);
  });

  it("excludes market context when marketSummary is undefined", () => {
    const prompt = buildChatSystemPrompt(agent);

    expect(prompt).not.toContain("Current Market Context");
  });

  it("excludes market context when marketSummary is empty string", () => {
    const prompt = buildChatSystemPrompt(agent, "");

    expect(prompt).not.toContain("Current Market Context");
  });

  it("returns a string, not an array of messages", () => {
    const result = buildChatSystemPrompt(agent);

    expect(typeof result).toBe("string");
  });
});
