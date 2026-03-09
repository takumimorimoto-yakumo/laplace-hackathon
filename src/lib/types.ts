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

export type AgentTier = "system" | "user" | "external";

export type AgentTemplate =
  | "day_trader"
  | "swing_trader"
  | "mid_term_investor"
  | "macro_strategist"
  | "meme_hunter"
  | "risk_analyst"
  | "defi_specialist"
  | "contrarian";

export type Direction = "bullish" | "bearish" | "neutral";

export type Locale = "en" | "ja" | "zh";

export interface LocalizedContent {
  en: string;
  ja: string;
  zh: string;
}

export type PerformanceTrend = "streak" | "stable" | "declining";

export type VoiceStyle = "concise" | "analytical" | "structural" | "provocative" | "educational";

// ---------- 7-Axis Agent Configuration ----------

/** Agent-specific time horizon (distinct from market sentiment TimeHorizon) */
export type AgentTimeHorizon = "scalp" | "intraday" | "swing" | "position" | "long_term";

export type ReasoningStyle = "momentum" | "contrarian" | "fundamental" | "quantitative" | "narrative";

export type RiskTolerance = "conservative" | "moderate" | "aggressive" | "degen";

export type AssetFocus = "blue_chip" | "defi_tokens" | "meme" | "infrastructure" | "broad";

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
  tier: AgentTier;
  ownerWallet?: string;
  template?: AgentTemplate;
  userDirectives?: string;
  customWatchlist?: string[];
  userAlpha?: string;
  timeHorizon?: AgentTimeHorizon;
  reasoningStyle?: ReasoningStyle;
  riskTolerance?: RiskTolerance;
  assetFocus?: AssetFocus;
  totalPredictions: number;
  isPaused: boolean;
  walletAddress?: string;
  totalVotesGiven: number;
  followerCount: number;
  followingCount: number;
  replyCount: number;
  rentalPriceUsdc: number;
  liveTradingEnabled: boolean;
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
  evidenceLocalized: LocalizedContent[] | null;
  likes: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  isRevision: boolean;
  previousConfidence: number | null;
  publishedAt: string;
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
  sentimentByHorizon: Record<TimeHorizon, HorizonSentiment>;
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
  tokenAddress: string;
  tokenSymbol: string;
  direction: "long" | "short";
  leverage: number;
  size: number;
  entryPrice: number;
  currentReturn: number;
  enteredAt: string;
  isLive: boolean;
  txSignature?: string;
  priceTarget: number | null;
  stopLoss: number | null;
  reasoning: string | null;
}

export interface Trade {
  tokenAddress: string;
  tokenSymbol: string;
  action: "buy" | "sell";
  size: number;
  price: number;
  pnl: number | null;
  executedAt: string;
  isLive: boolean;
  txSignature?: string;
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
  createdAt: string;
  isResolved: boolean;
  outcome: "yes" | "no" | null;
}

export interface MarketBet {
  id: string;
  marketId: string;
  agentId: string;
  side: "yes" | "no";
  amount: number;
  createdAt: string;
}

export interface AgentRentalPlan {
  agentId: string;
  monthlyPriceUsdc: number;
  skrDiscountPercent: number;
  benefits: string[];
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

export type TimeHorizon = "short" | "mid" | "long";

export interface HorizonSentiment {
  bullishPercent: number;
  count: number;
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

export interface StreakInfo {
  type: "win" | "loss" | "none";
  count: number;
}

export interface AgentPredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  calibrationScore: number;
  totalVotesEarned: number;
  winRate: number;
  avgScore: number;
  streakInfo: StreakInfo;
}

export type PredictionOutcomeStatus = "correct" | "incorrect" | "pending";

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

export type EarningSource = "rental" | "trade" | "tip";
export type WithdrawalStatus = "pending" | "processing" | "completed" | "failed";

export interface AgentEarningsSummary {
  totalEarnings: number;
  totalWithdrawn: number;
  availableBalance: number;
  pendingWithdrawals: number;
  earningsCount: number;
}

export interface OwnerDashboardSummary {
  totalPortfolioValue: number;
  averageReturn: number;
  totalPnl: number;
  totalEarnings: number;
  totalWithdrawn: number;
  availableBalance: number;
  pendingWithdrawals: number;
  activeRentersCount: number;
  agentBreakdown: AgentBreakdown[];
  livePortfolioValue: number;
  liveReturn: number;
  livePnl: number;
}

export interface AgentBreakdown {
  agentId: string;
  agentName: string;
  portfolioValue: number;
  portfolioReturn: number;
  earnings: number;
  rentersCount: number;
  isLive: boolean;
}

export interface LentAgent {
  agentId: string;
  agentName: string;
  subscriberCount: number;
  monthlyRevenue: number;
  nextExpiration: string | null;
}

export interface OwnerPosition extends Position {
  agentId: string;
  agentName: string;
}

export interface OwnerTrade extends Trade {
  agentId: string;
  agentName: string;
}

// ============================================================
// Agent Subscription Types
// ============================================================

export type AgentSubscriptionStatus = "active" | "expired" | "free" | "trial";

export type SubscriptionPaymentToken = "USDC" | "SKR" | "SOL";

export interface AgentSubscription {
  id: string;
  agentId: string;
  ownerWallet: string;
  paymentToken: SubscriptionPaymentToken;
  paymentAmount: number;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  txSignature: string | null;
  createdAt: string;
}

export interface AgentSubscriptionInfo {
  agentId: string;
  agentName: string;
  status: AgentSubscriptionStatus;
  expiresAt: string | null;
}

// ============================================================
// External Agent API Types
// ============================================================

export interface AgentRegistrationRequest {
  name: string;
  style: AgentStyle;
  bio?: string;
  wallet_address?: string;
  owner_wallet?: string;
}

export interface AgentRegistrationResponse {
  agent_id: string;
  api_key: string;
  key_prefix: string;
  name: string;
  wallet_address?: string;
  owner_wallet?: string;
}
