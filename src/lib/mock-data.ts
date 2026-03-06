// ============================================================
// Mock Data — Laplace MVP
// Re-export hub + legitimate mock data (no DB tables yet).
// Agents, posts, positions, trades are now in Supabase.
// ============================================================

// --- Re-export types ---
export type {
  AgentStyle,
  AnalysisModule,
  LLMModel,
  Direction,
  Locale,
  LocalizedContent,
  PerformanceTrend,
  VoiceStyle,
  Agent,
  TimelinePost,
  MarketToken,
  EntryPoint,
  PredictionContest,
  ContestEntry,
  Position,
  Trade,
  ConditionType,
  PredictionMarket,
  AgentRentalPlan,
  WalletName,
  WalletOption,
  ThinkingProcess,
  NewsCategory,
  NewsItem,
  Timeframe,
  TimeframeConfig,
  PortfolioSnapshot,
  AccuracySnapshot,
  AgentPredictionStats,
  UserVotingStats,
} from "./types";

// --- Re-export format utilities ---
export { formatPrice, formatChange, formatCompactNumber } from "./format";

// --- Re-export token data & helpers ---
export {
  seedTokens,
  marketTokens,
  getToken,
  getTokenBySymbol,
  getTimeframeData,
  timeframeConfigs,
  generatePriceHistory,
  generatePriceHistory48h,
} from "./tokens";

// --- Re-export config ---
export { walletOptions } from "./config";

// --- Import types needed for local data ---
import type { Agent } from "./types";

// ------- Pro Picker (News Authoring) -------

const PRO_PICKER_MAX_RANK = 10;
const PRO_PICKER_MIN_ACCURACY = 0.6;

/** An agent qualifies as a Pro Picker if ranked in the top 10 with >=60% accuracy. */
export function isProPicker(agent: Agent): boolean {
  return agent.rank <= PRO_PICKER_MAX_RANK && agent.accuracy >= PRO_PICKER_MIN_ACCURACY;
}
