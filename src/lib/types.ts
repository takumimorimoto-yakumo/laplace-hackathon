// ============================================================
// Shared Type Definitions — Laplace MVP
// ============================================================

export type AgentStyle =
  | "swing"
  | "daytrader"
  | "macro"
  | "contrarian"
  | "quant"
  | "degen";

export type AnalysisModule =
  | "onchain"
  | "technical"
  | "sentiment"
  | "defi"
  | "macro_regulatory"
  | "risk"
  | "news"
  | "cross_chain";

export type LLMModel =
  | "claude-sonnet"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gemini-pro"
  | "deepseek"
  | "qwen"
  | "minimax"
  | "grok"
  | "external";

export type Direction = "bullish" | "bearish" | "neutral";

export type Locale = "en" | "ja" | "zh";

export interface LocalizedContent {
  en: string;
  ja: string;
  zh: string;
}

export type PerformanceTrend = "streak" | "stable" | "declining";

export type VoiceStyle = "concise" | "analytical" | "structural" | "provocative";

export type InvestmentOutlook = "ultra_bullish" | "bullish" | "bearish" | "ultra_bearish";

export interface Agent {
  id: string;
  name: string;
  style: AgentStyle;
  modules: AnalysisModule[];
  llm: LLMModel;
  accuracy: number;
  rank: number;
  totalVotes: number;
  trend: PerformanceTrend;
  portfolioValue: number;
  portfolioReturn: number;
  bio: string;
  personality: string;
  outlook: InvestmentOutlook;
  voiceStyle: VoiceStyle;
  temperature: number;
  cycleIntervalMinutes: number;
  isSystem: boolean;
}

export interface TimelinePost {
  id: string;
  agentId: string;
  content: LocalizedContent;
  direction: Direction;
  confidence: number;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  priceAtPrediction: number | null;
  evidence: string[];
  upvotes: number;
  downvotes: number;
  createdAt: string;
  isRevision: boolean;
  previousConfidence: number | null;
  parentId: string | null;
  replies: TimelinePost[];
}

export interface MarketToken {
  address: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  decimals: number;
  price: number;
  change24h: number;
  tags: string[];
  tvl: number | null;
  volume24h: number;
  marketCap: number | null;
  agentCount: number;
  bullishPercent: number;
  sparkline7d: number[];
  priceHistory48h: number[];
}

export interface EntryPoint {
  postId: string;
  agentId: string;
  agentName: string;
  direction: Direction;
  confidence: number;
  priceAtPrediction: number;
  createdAt: string;
}

export interface PredictionContest {
  id: string;
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  poolAmount: number;
  entries: ContestEntry[];
}

export interface ContestEntry {
  agentId: string;
  currentReturn: number;
  firstPlaceProbability: number;
  topThreeProbability: number;
}

export interface Position {
  tokenSymbol: string;
  direction: "long" | "short";
  leverage: number;
  size: number;
  entryPrice: number;
  currentReturn: number;
  enteredAt: string;
}

export interface Trade {
  tokenSymbol: string;
  action: "buy" | "sell";
  size: number;
  price: number;
  pnl: number | null;
  executedAt: string;
}

export type ConditionType = "price_above" | "price_below" | "change_percent";

export interface PredictionMarket {
  marketId: string;
  proposerAgentId: string;
  sourcePostId: string;
  tokenSymbol: string;
  conditionType: ConditionType;
  threshold: number;
  priceAtCreation: number;
  deadline: string;
  poolYes: number;
  poolNo: number;
  isResolved: boolean;
  outcome: "yes" | "no" | null;
}

export interface AgentRentalPlan {
  agentId: string;
  monthlyPriceUsdc: number;
  skrDiscountPercent: number;
  benefits: string[];
}

export type WalletName = "phantom" | "solflare" | "seedvault";

export interface WalletOption {
  name: WalletName;
  label: string;
  icon: string;
}

export interface ThinkingProcess {
  postId: string;
  consensus: LocalizedContent[];
  debatePoints: LocalizedContent[];
  blindSpots: LocalizedContent[];
}

export type NewsCategory = "onchain" | "regulatory" | "defi" | "market" | "social";

export interface NewsItem {
  id: string;
  authorAgentId: string;
  title: LocalizedContent;
  source: string;
  category: NewsCategory;
  tokenSymbols: string[];
  publishedAt: string;
}

export type Timeframe = "1D" | "1W" | "1M" | "1Y";

export interface TimeframeConfig {
  points: number;
  driftMultiplier: number;
}

export interface PortfolioSnapshot {
  date: string;
  value: number;
}

export interface AccuracySnapshot {
  date: string;
  accuracy: number;
}

export interface AgentPredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  calibrationScore: number;
  totalVotesEarned: number;
}

export interface CopyTradeConfig {
  agentId: string;
  totalBudget: number;
  perTradeLimit: number;
  scale: number;
  maxLeverage: number;
  perpEnabled: boolean;
  isActive: boolean;
}

export interface CopyTradeMirror {
  id: string;
  agentId: string;
  tokenSymbol: string;
  action: "buy" | "sell";
  size: number;
  price: number;
  pnl: number | null;
  executedAt: string;
}

export interface UserVotingStats {
  totalVotes: number;
  correctVotes: number;
  hitRate: number;
  totalRewards: number;
}

// ============================================================
// External Agent API Types
// ============================================================

export interface ApiKey {
  id: string;
  agentId: string;
  keyPrefix: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: number;
}

export interface ApiErrorResponse {
  error: string;
  details?: string[];
}

export interface ApiPostRequest {
  natural_text: string;
  direction?: Direction;
  confidence?: number;
  token_symbol?: string;
  token_address?: string;
  evidence?: string[];
}

export interface AgentRegistrationRequest {
  name: string;
  style: AgentStyle;
  bio?: string;
}

export interface AgentRegistrationResponse {
  agent_id: string;
  api_key: string;
  key_prefix: string;
  name: string;
}
