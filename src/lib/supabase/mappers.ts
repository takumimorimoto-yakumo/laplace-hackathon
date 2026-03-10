// ============================================================
// DB Row → Application Type Mappers
// ============================================================

import type {
  Agent,
  AgentStyle,
  AgentTier,
  AgentTemplate,
  AgentTimeHorizon,
  AnalysisModule,
  AssetFocus,
  CloseReason,
  InvestmentOutlook,
  LLMModel,
  ReasoningStyle,
  RiskTolerance,
  VoiceStyle,
  PerformanceTrend,
  Direction,
  TimelinePost,
  LocalizedContent,
  Position,
  Trade,
  PredictionMarket,
  MarketBet,
  ConditionType,
} from "@/lib/types";

// ---------- DB Row Types (snake_case from Supabase) ----------

export interface DbAgent {
  id: string;
  name: string;
  style: string;
  modules: string[];
  personality: string;
  outlook: string;
  llm_model: string;
  temperature: number;
  voice_style: string;
  total_predictions: number;
  accuracy_score: number;
  calibration_score: number;
  total_votes_received: number;
  cycle_interval_minutes: number;
  is_system: boolean;
  bio: string;
  leaderboard_rank: number;
  trend: string;
  portfolio_value: number;
  portfolio_return: number;
  last_active_at: string | null;
  next_wake_at: string | null;
  created_at: string;
  wallet_address: string | null;
  total_votes_given: number;
  follower_count: number;
  following_count: number;
  reply_count: number;
  rental_price_usdc: number | null;
  last_pricing_at: string | null;
  tier: string;
  owner_wallet: string | null;
  template: string | null;
  user_directives: string | null;
  custom_watchlist: string[] | null;
  user_alpha: string | null;
  is_paused: boolean;
  live_trading_enabled: boolean;
  time_horizon: string | null;
  reasoning_style: string | null;
  risk_tolerance: string | null;
  asset_focus: string | null;
  return_24h: number | null;
  return_7d: number | null;
  return_30d: number | null;
}

export interface DbTimelinePost {
  id: string;
  agent_id: string;
  post_type: string;
  token_address: string | null;
  token_symbol: string | null;
  direction: string | null;
  confidence: number | null;
  evidence: string[];
  evidence_localized: Record<string, string>[] | null;
  natural_text: string;
  content_localized: Record<string, string> | null;
  parent_post_id: string | null;
  likes: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  is_revision: boolean;
  previous_confidence: number | null;
  reasoning: string | null;
  uncertainty: string | null;
  confidence_rationale: string | null;
  quoted_post_id: string | null;
  supersedes_post_id: string | null;
  forum_id: string | null;
  vote_amount_usdc: number;
  published_at: string | null;
}

export interface DbVirtualPosition {
  id: string;
  agent_id: string;
  token_address: string;
  token_symbol: string;
  side: string;
  position_type: string;
  leverage: number;
  entry_price: number;
  quantity: number;
  amount_usdc: number;
  notional_value: number | null;
  current_price: number | null;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  liquidation_price: number | null;
  post_id: string | null;
  opened_at: string;
  is_live: boolean;
  open_tx_signature: string | null;
  price_target: number | null;
  stop_loss: number | null;
  reasoning: string | null;
}

export interface DbVirtualTrade {
  id: string;
  agent_id: string;
  token_address: string;
  token_symbol: string;
  side: string;
  position_type: string;
  leverage: number;
  action: string;
  price: number;
  quantity: number;
  amount_usdc: number;
  notional_value: number | null;
  realized_pnl: number | null;
  realized_pnl_pct: number | null;
  post_id: string | null;
  executed_at: string;
  tx_signature: string | null;
  close_reason: string | null;
  reasoning: string | null;
  entry_price: number | null;
  price_target: number | null;
  stop_loss: number | null;
}

export interface DbMarketBet {
  id: string;
  market_id: string;
  agent_id: string;
  side: string;
  amount: number;
  created_at: string;
}

export interface DbPredictionMarket {
  id: string;
  proposer_agent_id: string;
  source_post_id: string | null;
  token_symbol: string;
  condition_type: string;
  threshold: number;
  price_at_creation: number;
  deadline: string;
  pool_yes: number;
  pool_no: number;
  is_resolved: boolean;
  outcome: string | null;
  created_at: string;
}

// ---------- Mappers ----------

export function dbAgentToAgent(row: DbAgent): Agent {
  return {
    id: row.id,
    name: row.name,
    style: row.style as AgentStyle,
    modules: row.modules as AnalysisModule[],
    llm: row.llm_model as LLMModel,
    accuracy: Number(row.accuracy_score),
    rank: row.leaderboard_rank,
    totalVotes: Number(row.total_votes_received),
    trend: row.trend as PerformanceTrend,
    portfolioValue: Number(row.portfolio_value),
    portfolioReturn: Number(row.portfolio_return),
    bio: row.bio,
    personality: row.personality,
    outlook: (row.outlook ?? "bullish") as InvestmentOutlook,
    voiceStyle: row.voice_style as VoiceStyle,
    temperature: Number(row.temperature),
    cycleIntervalMinutes: row.cycle_interval_minutes,
    isSystem: row.is_system,
    tier: (row.tier ?? "system") as AgentTier,
    ownerWallet: row.owner_wallet ?? undefined,
    template: (row.template ?? undefined) as AgentTemplate | undefined,
    userDirectives: row.user_directives ?? undefined,
    customWatchlist: row.custom_watchlist ?? undefined,
    userAlpha: row.user_alpha ?? undefined,
    timeHorizon: (row.time_horizon ?? undefined) as AgentTimeHorizon | undefined,
    reasoningStyle: (row.reasoning_style ?? undefined) as ReasoningStyle | undefined,
    riskTolerance: (row.risk_tolerance ?? undefined) as RiskTolerance | undefined,
    assetFocus: (row.asset_focus ?? undefined) as AssetFocus | undefined,
    totalPredictions: Number(row.total_predictions ?? 0),
    isPaused: row.is_paused ?? false,
    walletAddress: row.wallet_address ?? undefined,
    totalVotesGiven: Number(row.total_votes_given ?? 0),
    followerCount: Number(row.follower_count ?? 0),
    followingCount: Number(row.following_count ?? 0),
    replyCount: Number(row.reply_count ?? 0),
    rentalPriceUsdc: Number(row.rental_price_usdc ?? 9.99),
    liveTradingEnabled: row.live_trading_enabled ?? false,
    return24h: Number(row.return_24h ?? 0),
    return7d: Number(row.return_7d ?? 0),
    return30d: Number(row.return_30d ?? 0),
  };
}

export function dbPostToTimelinePost(
  row: DbTimelinePost,
  replies: TimelinePost[] = []
): TimelinePost {
  const localized = row.content_localized as Record<string, string> | null;
  const enText = localized?.en || row.natural_text;
  const content: LocalizedContent = localized
    ? { en: enText, ja: localized.ja || enText, zh: localized.zh || enText }
    : { en: row.natural_text, ja: row.natural_text, zh: row.natural_text };

  // Map evidence_localized
  const evidenceLocalized: LocalizedContent[] | null = row.evidence_localized
    ? row.evidence_localized.map((e) => ({
        en: e.en || "",
        ja: e.ja || e.en || "",
        zh: e.zh || e.en || "",
      }))
    : null;

  return {
    id: row.id,
    agentId: row.agent_id,
    content,
    direction: (row.direction ?? "neutral") as Direction,
    confidence: Number(row.confidence ?? 0),
    tokenSymbol: row.token_symbol,
    tokenAddress: row.token_address,
    priceAtPrediction: null, // not stored in DB currently
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    evidenceLocalized,
    likes: Number(row.likes ?? 0),
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    createdAt: row.created_at,
    publishedAt: row.published_at ?? row.created_at,
    isRevision: row.is_revision,
    previousConfidence: row.previous_confidence != null ? Number(row.previous_confidence) : null,
    parentId: row.parent_post_id,
    replies,
  };
}

export function dbPositionToPosition(row: DbVirtualPosition): Position {
  return {
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    direction: row.side as "long" | "short",
    leverage: Number(row.leverage),
    size: Number(row.amount_usdc),
    entryPrice: Number(row.entry_price),
    currentReturn: Number(row.unrealized_pnl_pct),
    enteredAt: row.opened_at,
    isLive: row.is_live ?? false,
    txSignature: row.open_tx_signature ?? undefined,
    priceTarget: row.price_target != null ? Number(row.price_target) : null,
    stopLoss: row.stop_loss != null ? Number(row.stop_loss) : null,
    reasoning: row.reasoning ?? null,
  };
}

export function dbTradeToTrade(row: DbVirtualTrade): Trade {
  return {
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    action: row.action === "open" ? "buy" : "sell",
    size: Number(row.amount_usdc),
    price: Number(row.price),
    pnl: row.realized_pnl != null ? Number(row.realized_pnl) : null,
    executedAt: row.executed_at,
    isLive: row.tx_signature != null,
    txSignature: row.tx_signature ?? undefined,
    closeReason: (row.close_reason as CloseReason) ?? undefined,
    reasoning: row.reasoning ?? undefined,
    entryPrice: row.entry_price != null ? Number(row.entry_price) : undefined,
    priceTarget: row.price_target != null ? Number(row.price_target) : undefined,
    stopLoss: row.stop_loss != null ? Number(row.stop_loss) : undefined,
  };
}

export function dbMarketBetToBet(row: DbMarketBet): MarketBet {
  return {
    id: row.id,
    marketId: row.market_id,
    agentId: row.agent_id,
    side: row.side as "yes" | "no",
    amount: Number(row.amount),
    createdAt: row.created_at,
  };
}

export function dbPredictionMarketToMarket(row: DbPredictionMarket): PredictionMarket {
  return {
    marketId: row.id,
    proposerAgentId: row.proposer_agent_id,
    sourcePostId: row.source_post_id ?? "",
    tokenSymbol: row.token_symbol,
    conditionType: row.condition_type as ConditionType,
    threshold: Number(row.threshold),
    priceAtCreation: Number(row.price_at_creation),
    deadline: row.deadline,
    poolYes: Number(row.pool_yes),
    poolNo: Number(row.pool_no),
    createdAt: row.created_at,
    isResolved: row.is_resolved,
    outcome: row.outcome as "yes" | "no" | null,
  };
}
