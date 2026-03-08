import { describe, it, expect } from "vitest";
import {
  dbAgentToAgent,
  dbPostToTimelinePost,
  dbPositionToPosition,
  dbTradeToTrade,
  dbMarketBetToBet,
  dbPredictionMarketToMarket,
  type DbAgent,
  type DbTimelinePost,
  type DbVirtualPosition,
  type DbVirtualTrade,
  type DbMarketBet,
  type DbPredictionMarket,
} from "@/lib/supabase/mappers";

// ============================================================
// Helper: complete DB row factories
// ============================================================

function makeDbAgent(overrides: Partial<DbAgent> = {}): DbAgent {
  return {
    id: "agent-001",
    name: "TestAgent",
    style: "quant",
    modules: ["onchain", "technical"],
    personality: "Analytical and data-driven",
    outlook: "bullish",
    llm_model: "claude-sonnet",
    temperature: 0.7,
    voice_style: "analytical",
    total_predictions: 150,
    accuracy_score: 0.82,
    calibration_score: 0.91,
    total_votes_received: 3200,
    cycle_interval_minutes: 60,
    is_system: true,
    bio: "A quantitative analyst agent",
    leaderboard_rank: 5,
    trend: "streak",
    portfolio_value: 125000,
    portfolio_return: 0.25,
    last_active_at: "2026-03-07T12:00:00Z",
    next_wake_at: "2026-03-07T13:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    wallet_address: "So1anaWa11etAddr3ss",
    total_votes_given: 450,
    follower_count: 1200,
    following_count: 30,
    reply_count: 88,
    rental_price_usdc: 19.99,
    last_pricing_at: "2026-03-01T00:00:00Z",
    tier: "system",
    owner_wallet: "OwnerWa11etAddr3ss",
    template: "day_trader",
    user_directives: "Focus on SOL ecosystem",
    custom_watchlist: ["SOL", "JUP", "RAY"],
    user_alpha: "Insider tip: watch JUP staking",
    is_paused: false,
    live_trading_enabled: false,
    ...overrides,
  };
}

function makeDbPost(overrides: Partial<DbTimelinePost> = {}): DbTimelinePost {
  return {
    id: "post-001",
    agent_id: "agent-001",
    post_type: "prediction",
    token_address: "So11111111111111111111111111111111",
    token_symbol: "SOL",
    direction: "bullish",
    confidence: 85,
    evidence: ["Strong volume increase", "Breakout pattern"],
    evidence_localized: null,
    natural_text: "SOL is looking strong with a breakout pattern forming.",
    content_localized: null,
    parent_post_id: null,
    likes: 42,
    upvotes: 30,
    downvotes: 5,
    created_at: "2026-03-07T10:00:00Z",
    is_revision: false,
    previous_confidence: null,
    reasoning: "Technical analysis shows breakout",
    uncertainty: "Low",
    confidence_rationale: "Volume supports the move",
    quoted_post_id: null,
    supersedes_post_id: null,
    forum_id: null,
    vote_amount_usdc: 10,
    published_at: "2026-03-07T10:05:00Z",
    ...overrides,
  };
}

function makeDbPosition(
  overrides: Partial<DbVirtualPosition> = {}
): DbVirtualPosition {
  return {
    id: "pos-001",
    agent_id: "agent-001",
    token_address: "So11111111111111111111111111111111",
    token_symbol: "SOL",
    side: "long",
    position_type: "spot",
    leverage: 2,
    entry_price: 145.5,
    quantity: 10,
    amount_usdc: 1455,
    notional_value: 2910,
    current_price: 150.0,
    unrealized_pnl: 45.0,
    unrealized_pnl_pct: 3.09,
    liquidation_price: 72.75,
    post_id: "post-001",
    opened_at: "2026-03-06T08:00:00Z",
    is_live: false,
    open_tx_signature: null,
    price_target: null,
    stop_loss: null,
    reasoning: null,
    ...overrides,
  };
}

function makeDbTrade(overrides: Partial<DbVirtualTrade> = {}): DbVirtualTrade {
  return {
    id: "trade-001",
    agent_id: "agent-001",
    token_address: "So11111111111111111111111111111111",
    token_symbol: "SOL",
    side: "long",
    position_type: "spot",
    leverage: 1,
    action: "open",
    price: 145.5,
    quantity: 10,
    amount_usdc: 1455,
    notional_value: 1455,
    realized_pnl: null,
    realized_pnl_pct: null,
    post_id: "post-001",
    executed_at: "2026-03-06T08:00:00Z",
    tx_signature: null,
    ...overrides,
  };
}

function makeDbMarketBet(
  overrides: Partial<DbMarketBet> = {}
): DbMarketBet {
  return {
    id: "bet-001",
    market_id: "market-001",
    agent_id: "agent-001",
    side: "yes",
    amount: 100,
    created_at: "2026-03-07T09:00:00Z",
    ...overrides,
  };
}

function makeDbPredictionMarket(
  overrides: Partial<DbPredictionMarket> = {}
): DbPredictionMarket {
  return {
    id: "market-001",
    proposer_agent_id: "agent-001",
    source_post_id: "post-001",
    token_symbol: "SOL",
    condition_type: "price_above",
    threshold: 200,
    price_at_creation: 145.5,
    deadline: "2026-04-01T00:00:00Z",
    pool_yes: 5000,
    pool_no: 3000,
    is_resolved: false,
    outcome: null,
    created_at: "2026-03-07T00:00:00Z",
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("dbAgentToAgent", () => {
  it("maps a complete DbAgent row to Agent with all fields", () => {
    const row = makeDbAgent();
    const agent = dbAgentToAgent(row);

    expect(agent.id).toBe("agent-001");
    expect(agent.name).toBe("TestAgent");
    expect(agent.style).toBe("quant");
    expect(agent.modules).toEqual(["onchain", "technical"]);
    expect(agent.llm).toBe("claude-sonnet");
    expect(agent.accuracy).toBe(0.82);
    expect(agent.rank).toBe(5);
    expect(agent.totalVotes).toBe(3200);
    expect(agent.trend).toBe("streak");
    expect(agent.portfolioValue).toBe(125000);
    expect(agent.portfolioReturn).toBe(0.25);
    expect(agent.bio).toBe("A quantitative analyst agent");
    expect(agent.personality).toBe("Analytical and data-driven");
    expect(agent.outlook).toBe("bullish");
    expect(agent.voiceStyle).toBe("analytical");
    expect(agent.temperature).toBe(0.7);
    expect(agent.cycleIntervalMinutes).toBe(60);
    expect(agent.isSystem).toBe(true);
    expect(agent.tier).toBe("system");
    expect(agent.ownerWallet).toBe("OwnerWa11etAddr3ss");
    expect(agent.template).toBe("day_trader");
    expect(agent.userDirectives).toBe("Focus on SOL ecosystem");
    expect(agent.customWatchlist).toEqual(["SOL", "JUP", "RAY"]);
    expect(agent.userAlpha).toBe("Insider tip: watch JUP staking");
    expect(agent.isPaused).toBe(false);
    expect(agent.walletAddress).toBe("So1anaWa11etAddr3ss");
    expect(agent.totalVotesGiven).toBe(450);
    expect(agent.followerCount).toBe(1200);
    expect(agent.followingCount).toBe(30);
    expect(agent.replyCount).toBe(88);
    expect(agent.totalPredictions).toBe(150);
    expect(agent.rentalPriceUsdc).toBe(19.99);
  });

  it("converts null optional fields to undefined", () => {
    const row = makeDbAgent({
      owner_wallet: null,
      template: null,
      user_directives: null,
      custom_watchlist: null,
      user_alpha: null,
      wallet_address: null,
    });
    const agent = dbAgentToAgent(row);

    expect(agent.ownerWallet).toBeUndefined();
    expect(agent.template).toBeUndefined();
    expect(agent.userDirectives).toBeUndefined();
    expect(agent.customWatchlist).toBeUndefined();
    expect(agent.userAlpha).toBeUndefined();
    expect(agent.walletAddress).toBeUndefined();
  });

  it("applies default values when fields are null or missing", () => {
    const row = makeDbAgent({
      rental_price_usdc: null,
    });
    const agent = dbAgentToAgent(row);

    expect(agent.rentalPriceUsdc).toBe(9.99);
  });

  it("defaults tier to 'system' when tier is falsy", () => {
    // The mapper uses `row.tier ?? "system"` — null triggers the default
    const row = makeDbAgent({ tier: null as unknown as string });
    const agent = dbAgentToAgent(row);

    expect(agent.tier).toBe("system");
  });

  it("defaults outlook to 'bullish' when outlook is falsy", () => {
    const row = makeDbAgent({ outlook: null as unknown as string });
    const agent = dbAgentToAgent(row);

    expect(agent.outlook).toBe("bullish");
  });

  it("defaults is_paused to false when falsy", () => {
    const row = makeDbAgent({ is_paused: false });
    const agent = dbAgentToAgent(row);

    expect(agent.isPaused).toBe(false);
  });

  it("performs Number() conversions on numeric fields", () => {
    // Supabase sometimes returns strings for numeric columns
    const row = makeDbAgent({
      accuracy_score: "0.95" as unknown as number,
      total_votes_received: "999" as unknown as number,
      portfolio_value: "50000.50" as unknown as number,
      portfolio_return: "-0.12" as unknown as number,
      temperature: "0.3" as unknown as number,
      total_votes_given: "100" as unknown as number,
      follower_count: "500" as unknown as number,
      following_count: "20" as unknown as number,
      reply_count: "15" as unknown as number,
      rental_price_usdc: "29.99" as unknown as number,
    });
    const agent = dbAgentToAgent(row);

    expect(agent.accuracy).toBe(0.95);
    expect(typeof agent.accuracy).toBe("number");
    expect(agent.totalVotes).toBe(999);
    expect(typeof agent.totalVotes).toBe("number");
    expect(agent.portfolioValue).toBe(50000.5);
    expect(typeof agent.portfolioValue).toBe("number");
    expect(agent.portfolioReturn).toBe(-0.12);
    expect(typeof agent.portfolioReturn).toBe("number");
    expect(agent.temperature).toBe(0.3);
    expect(typeof agent.temperature).toBe("number");
    expect(agent.totalVotesGiven).toBe(100);
    expect(typeof agent.totalVotesGiven).toBe("number");
    expect(agent.followerCount).toBe(500);
    expect(typeof agent.followerCount).toBe("number");
    expect(agent.followingCount).toBe(20);
    expect(typeof agent.followingCount).toBe("number");
    expect(agent.replyCount).toBe(15);
    expect(typeof agent.replyCount).toBe("number");
    expect(agent.rentalPriceUsdc).toBe(29.99);
    expect(typeof agent.rentalPriceUsdc).toBe("number");
  });

  it("defaults totalVotesGiven, followerCount, followingCount, replyCount to 0 when null", () => {
    const row = makeDbAgent({
      total_votes_given: null as unknown as number,
      follower_count: null as unknown as number,
      following_count: null as unknown as number,
      reply_count: null as unknown as number,
    });
    const agent = dbAgentToAgent(row);

    expect(agent.totalVotesGiven).toBe(0);
    expect(agent.followerCount).toBe(0);
    expect(agent.followingCount).toBe(0);
    expect(agent.replyCount).toBe(0);
  });

  it("defaults totalPredictions to 0 when null", () => {
    const row = makeDbAgent({ total_predictions: null as unknown as number });
    const agent = dbAgentToAgent(row);

    expect(agent.totalPredictions).toBe(0);
  });
});

describe("dbPostToTimelinePost", () => {
  it("maps a post with content_localized correctly", () => {
    const row = makeDbPost({
      content_localized: {
        en: "SOL is bullish",
        ja: "SOLは強気です",
        zh: "SOL看涨",
      },
    });
    const post = dbPostToTimelinePost(row);

    expect(post.id).toBe("post-001");
    expect(post.agentId).toBe("agent-001");
    expect(post.content).toEqual({
      en: "SOL is bullish",
      ja: "SOLは強気です",
      zh: "SOL看涨",
    });
    expect(post.direction).toBe("bullish");
    expect(post.confidence).toBe(85);
    expect(post.tokenSymbol).toBe("SOL");
    expect(post.tokenAddress).toBe("So11111111111111111111111111111111");
    expect(post.priceAtPrediction).toBeNull();
    expect(post.evidence).toEqual(["Strong volume increase", "Breakout pattern"]);
    expect(post.likes).toBe(42);
    expect(post.upvotes).toBe(30);
    expect(post.downvotes).toBe(5);
    expect(post.createdAt).toBe("2026-03-07T10:00:00Z");
    expect(post.publishedAt).toBe("2026-03-07T10:05:00Z");
    expect(post.isRevision).toBe(false);
    expect(post.previousConfidence).toBeNull();
    expect(post.parentId).toBeNull();
    expect(post.replies).toEqual([]);
  });

  it("uses natural_text for all languages when content_localized is null", () => {
    const row = makeDbPost({
      content_localized: null,
      natural_text: "SOL looks great right now",
    });
    const post = dbPostToTimelinePost(row);

    expect(post.content).toEqual({
      en: "SOL looks great right now",
      ja: "SOL looks great right now",
      zh: "SOL looks great right now",
    });
  });

  it("falls back to en text for missing ja/zh in content_localized", () => {
    const row = makeDbPost({
      content_localized: {
        en: "English only content",
      },
    });
    const post = dbPostToTimelinePost(row);

    expect(post.content.en).toBe("English only content");
    expect(post.content.ja).toBe("English only content");
    expect(post.content.zh).toBe("English only content");
  });

  it("maps evidence_localized array correctly", () => {
    const row = makeDbPost({
      evidence_localized: [
        { en: "Volume up 50%", ja: "出来高50%増", zh: "成交量增50%" },
        { en: "RSI overbought", ja: "RSI買われすぎ", zh: "RSI超买" },
      ],
    });
    const post = dbPostToTimelinePost(row);

    expect(post.evidenceLocalized).toEqual([
      { en: "Volume up 50%", ja: "出来高50%増", zh: "成交量增50%" },
      { en: "RSI overbought", ja: "RSI買われすぎ", zh: "RSI超买" },
    ]);
  });

  it("sets evidenceLocalized to null when evidence_localized is null", () => {
    const row = makeDbPost({ evidence_localized: null });
    const post = dbPostToTimelinePost(row);

    expect(post.evidenceLocalized).toBeNull();
  });

  it("falls back to en for missing ja/zh in evidence_localized items", () => {
    const row = makeDbPost({
      evidence_localized: [
        { en: "Only English evidence" },
      ],
    });
    const post = dbPostToTimelinePost(row);

    expect(post.evidenceLocalized).toEqual([
      { en: "Only English evidence", ja: "Only English evidence", zh: "Only English evidence" },
    ]);
  });

  it("defaults direction to 'neutral' when null", () => {
    const row = makeDbPost({ direction: null });
    const post = dbPostToTimelinePost(row);

    expect(post.direction).toBe("neutral");
  });

  it("defaults confidence to 0 when null", () => {
    const row = makeDbPost({ confidence: null });
    const post = dbPostToTimelinePost(row);

    expect(post.confidence).toBe(0);
  });

  it("defaults evidence to empty array when not an array", () => {
    const row = makeDbPost({ evidence: null as unknown as string[] });
    const post = dbPostToTimelinePost(row);

    expect(post.evidence).toEqual([]);
  });

  it("defaults likes to 0 when null", () => {
    const row = makeDbPost({ likes: null as unknown as number });
    const post = dbPostToTimelinePost(row);

    expect(post.likes).toBe(0);
  });

  it("maps previousConfidence correctly when present", () => {
    const row = makeDbPost({
      is_revision: true,
      previous_confidence: 60,
    });
    const post = dbPostToTimelinePost(row);

    expect(post.isRevision).toBe(true);
    expect(post.previousConfidence).toBe(60);
  });

  it("passes replies through correctly", () => {
    const row = makeDbPost();
    const reply = dbPostToTimelinePost(makeDbPost({ id: "reply-001", parent_post_id: "post-001" }));
    const post = dbPostToTimelinePost(row, [reply]);

    expect(post.replies).toHaveLength(1);
    expect(post.replies[0].id).toBe("reply-001");
  });

  it("uses created_at as publishedAt when published_at is null", () => {
    const row = makeDbPost({
      published_at: null,
      created_at: "2026-03-07T10:00:00Z",
    });
    const post = dbPostToTimelinePost(row);

    expect(post.publishedAt).toBe("2026-03-07T10:00:00Z");
  });

  it("maps parentId from parent_post_id", () => {
    const row = makeDbPost({ parent_post_id: "parent-post-999" });
    const post = dbPostToTimelinePost(row);

    expect(post.parentId).toBe("parent-post-999");
  });
});

describe("dbPositionToPosition", () => {
  it("maps a complete DbVirtualPosition row to Position", () => {
    const row = makeDbPosition();
    const position = dbPositionToPosition(row);

    expect(position.tokenSymbol).toBe("SOL");
    expect(position.direction).toBe("long");
    expect(position.leverage).toBe(2);
    expect(position.size).toBe(1455);
    expect(position.entryPrice).toBe(145.5);
    expect(position.currentReturn).toBe(3.09);
    expect(position.enteredAt).toBe("2026-03-06T08:00:00Z");
    expect(position.isLive).toBe(false);
    expect(position.txSignature).toBeUndefined();
  });

  it("maps live position with tx signature", () => {
    const row = makeDbPosition({ is_live: true, open_tx_signature: "5abc123" });
    const position = dbPositionToPosition(row);

    expect(position.isLive).toBe(true);
    expect(position.txSignature).toBe("5abc123");
  });

  it("maps short positions correctly", () => {
    const row = makeDbPosition({ side: "short" });
    const position = dbPositionToPosition(row);

    expect(position.direction).toBe("short");
  });

  it("performs Number() conversions on numeric fields", () => {
    const row = makeDbPosition({
      leverage: "5" as unknown as number,
      amount_usdc: "2500.50" as unknown as number,
      entry_price: "200.75" as unknown as number,
      unrealized_pnl_pct: "-1.5" as unknown as number,
    });
    const position = dbPositionToPosition(row);

    expect(position.leverage).toBe(5);
    expect(typeof position.leverage).toBe("number");
    expect(position.size).toBe(2500.5);
    expect(typeof position.size).toBe("number");
    expect(position.entryPrice).toBe(200.75);
    expect(typeof position.entryPrice).toBe("number");
    expect(position.currentReturn).toBe(-1.5);
    expect(typeof position.currentReturn).toBe("number");
  });
});

describe("dbTradeToTrade", () => {
  it("maps action 'open' to 'buy'", () => {
    const row = makeDbTrade({ action: "open" });
    const trade = dbTradeToTrade(row);

    expect(trade.action).toBe("buy");
  });

  it("maps action 'close' to 'sell'", () => {
    const row = makeDbTrade({ action: "close" });
    const trade = dbTradeToTrade(row);

    expect(trade.action).toBe("sell");
  });

  it("maps a complete DbVirtualTrade row to Trade", () => {
    const row = makeDbTrade({
      action: "close",
      realized_pnl: 250.5,
    });
    const trade = dbTradeToTrade(row);

    expect(trade.tokenSymbol).toBe("SOL");
    expect(trade.action).toBe("sell");
    expect(trade.size).toBe(1455);
    expect(trade.price).toBe(145.5);
    expect(trade.pnl).toBe(250.5);
    expect(trade.executedAt).toBe("2026-03-06T08:00:00Z");
    expect(trade.isLive).toBe(false);
    expect(trade.txSignature).toBeUndefined();
  });

  it("maps trade with tx_signature as live", () => {
    const row = makeDbTrade({ tx_signature: "5xyz789" });
    const trade = dbTradeToTrade(row);

    expect(trade.isLive).toBe(true);
    expect(trade.txSignature).toBe("5xyz789");
  });

  it("maps null realized_pnl to null pnl", () => {
    const row = makeDbTrade({ realized_pnl: null });
    const trade = dbTradeToTrade(row);

    expect(trade.pnl).toBeNull();
  });

  it("maps non-null realized_pnl with Number() conversion", () => {
    const row = makeDbTrade({ realized_pnl: "-50.25" as unknown as number });
    const trade = dbTradeToTrade(row);

    expect(trade.pnl).toBe(-50.25);
    expect(typeof trade.pnl).toBe("number");
  });

  it("performs Number() conversions on size and price", () => {
    const row = makeDbTrade({
      amount_usdc: "3000" as unknown as number,
      price: "180.99" as unknown as number,
    });
    const trade = dbTradeToTrade(row);

    expect(trade.size).toBe(3000);
    expect(typeof trade.size).toBe("number");
    expect(trade.price).toBe(180.99);
    expect(typeof trade.price).toBe("number");
  });
});

describe("dbMarketBetToBet", () => {
  it("maps a complete DbMarketBet row to MarketBet", () => {
    const row = makeDbMarketBet();
    const bet = dbMarketBetToBet(row);

    expect(bet.id).toBe("bet-001");
    expect(bet.marketId).toBe("market-001");
    expect(bet.agentId).toBe("agent-001");
    expect(bet.side).toBe("yes");
    expect(bet.amount).toBe(100);
    expect(bet.createdAt).toBe("2026-03-07T09:00:00Z");
  });

  it("maps side 'no' correctly", () => {
    const row = makeDbMarketBet({ side: "no" });
    const bet = dbMarketBetToBet(row);

    expect(bet.side).toBe("no");
  });

  it("performs Number() conversion on amount", () => {
    const row = makeDbMarketBet({ amount: "500.75" as unknown as number });
    const bet = dbMarketBetToBet(row);

    expect(bet.amount).toBe(500.75);
    expect(typeof bet.amount).toBe("number");
  });
});

describe("dbPredictionMarketToMarket", () => {
  it("maps a complete DbPredictionMarket row to PredictionMarket", () => {
    const row = makeDbPredictionMarket();
    const market = dbPredictionMarketToMarket(row);

    expect(market.marketId).toBe("market-001");
    expect(market.proposerAgentId).toBe("agent-001");
    expect(market.sourcePostId).toBe("post-001");
    expect(market.tokenSymbol).toBe("SOL");
    expect(market.conditionType).toBe("price_above");
    expect(market.threshold).toBe(200);
    expect(market.priceAtCreation).toBe(145.5);
    expect(market.deadline).toBe("2026-04-01T00:00:00Z");
    expect(market.poolYes).toBe(5000);
    expect(market.poolNo).toBe(3000);
    expect(market.createdAt).toBe("2026-03-07T00:00:00Z");
    expect(market.isResolved).toBe(false);
    expect(market.outcome).toBeNull();
  });

  it("maps null source_post_id to empty string", () => {
    const row = makeDbPredictionMarket({ source_post_id: null });
    const market = dbPredictionMarketToMarket(row);

    expect(market.sourcePostId).toBe("");
  });

  it("maps resolved market with outcome 'yes'", () => {
    const row = makeDbPredictionMarket({
      is_resolved: true,
      outcome: "yes",
    });
    const market = dbPredictionMarketToMarket(row);

    expect(market.isResolved).toBe(true);
    expect(market.outcome).toBe("yes");
  });

  it("maps resolved market with outcome 'no'", () => {
    const row = makeDbPredictionMarket({
      is_resolved: true,
      outcome: "no",
    });
    const market = dbPredictionMarketToMarket(row);

    expect(market.isResolved).toBe(true);
    expect(market.outcome).toBe("no");
  });

  it("maps different condition types", () => {
    const belowRow = makeDbPredictionMarket({ condition_type: "price_below" });
    expect(dbPredictionMarketToMarket(belowRow).conditionType).toBe("price_below");

    const changeRow = makeDbPredictionMarket({ condition_type: "change_percent" });
    expect(dbPredictionMarketToMarket(changeRow).conditionType).toBe("change_percent");
  });

  it("performs Number() conversions on numeric fields", () => {
    const row = makeDbPredictionMarket({
      threshold: "250.5" as unknown as number,
      price_at_creation: "150.25" as unknown as number,
      pool_yes: "10000" as unknown as number,
      pool_no: "7500" as unknown as number,
    });
    const market = dbPredictionMarketToMarket(row);

    expect(market.threshold).toBe(250.5);
    expect(typeof market.threshold).toBe("number");
    expect(market.priceAtCreation).toBe(150.25);
    expect(typeof market.priceAtCreation).toBe("number");
    expect(market.poolYes).toBe(10000);
    expect(typeof market.poolYes).toBe("number");
    expect(market.poolNo).toBe(7500);
    expect(typeof market.poolNo).toBe("number");
  });
});
