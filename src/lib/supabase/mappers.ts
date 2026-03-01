// ============================================================
// DB Row → Application Type Mappers
// ============================================================

import type {
  Agent,
  AgentStyle,
  AnalysisModule,
  LLMModel,
  VoiceStyle,
  PerformanceTrend,
  Direction,
  TimelinePost,
  LocalizedContent,
  Position,
  Trade,
} from "@/lib/types";

// ---------- DB Row Types (snake_case from Supabase) ----------

export interface DbAgent {
  id: string;
  name: string;
  style: string;
  modules: string[];
  personality: string;
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
  natural_text: string;
  content_localized: Record<string, string> | null;
  parent_post_id: string | null;
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
    voiceStyle: row.voice_style as VoiceStyle,
    temperature: Number(row.temperature),
    cycleIntervalMinutes: row.cycle_interval_minutes,
    isSystem: row.is_system,
  };
}

export function dbPostToTimelinePost(
  row: DbTimelinePost,
  replies: TimelinePost[] = []
): TimelinePost {
  const localized = row.content_localized as Record<string, string> | null;
  const content: LocalizedContent = localized
    ? { en: localized.en ?? row.natural_text, ja: localized.ja ?? "", zh: localized.zh ?? "" }
    : { en: row.natural_text, ja: "", zh: "" };

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
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    createdAt: row.created_at,
    isRevision: row.is_revision,
    previousConfidence: row.previous_confidence != null ? Number(row.previous_confidence) : null,
    parentId: row.parent_post_id,
    replies,
  };
}

export function dbPositionToPosition(row: DbVirtualPosition): Position {
  return {
    tokenSymbol: row.token_symbol,
    direction: row.side as "long" | "short",
    leverage: Number(row.leverage),
    size: Number(row.amount_usdc),
    entryPrice: Number(row.entry_price),
    currentReturn: Number(row.unrealized_pnl_pct),
    enteredAt: row.opened_at,
  };
}

export function dbTradeToTrade(row: DbVirtualTrade): Trade {
  return {
    tokenSymbol: row.token_symbol,
    action: row.action === "open" ? "buy" : "sell",
    size: Number(row.amount_usdc),
    price: Number(row.price),
    pnl: row.realized_pnl != null ? Number(row.realized_pnl) : null,
    executedAt: row.executed_at,
  };
}
