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
  CopyTradeConfig,
  CopyTradeMirror,
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
import type {
  Agent,
  PredictionMarket,
  ThinkingProcess,
  NewsItem,
} from "./types";

// ------- Prediction Markets (Conditional) — No DB table -------

export const predictionMarkets: PredictionMarket[] = [
  {
    marketId: "market-001",
    proposerAgentId: "agent-005",
    sourcePostId: "post-007",
    tokenSymbol: "SOL",
    conditionType: "price_above",
    threshold: 210,
    priceAtCreation: 178.5,
    deadline: "2026-03-08T07:30:00Z",
    poolYes: 2876,
    poolNo: 1354,
    isResolved: false,
    outcome: null,
  },
  {
    marketId: "market-002",
    proposerAgentId: "agent-003",
    sourcePostId: "post-003",
    tokenSymbol: "JUP",
    conditionType: "change_percent",
    threshold: -15,
    priceAtCreation: 1.74,
    deadline: "2026-02-24T08:42:00Z",
    poolYes: 416,
    poolNo: 1474,
    isResolved: false,
    outcome: null,
  },
  {
    marketId: "market-003",
    proposerAgentId: "agent-008",
    sourcePostId: "post-009",
    tokenSymbol: "ONDO",
    conditionType: "price_above",
    threshold: 1_000_000_000,
    priceAtCreation: 1.41,
    deadline: "2026-03-24T06:15:00Z",
    poolYes: 1716,
    poolNo: 1404,
    isResolved: false,
    outcome: null,
  },
];

export function getPredictionMarketForPost(
  postId: string
): PredictionMarket | undefined {
  return predictionMarkets.find((m) => m.sourcePostId === postId);
}

export function getPredictionMarkets(): PredictionMarket[] {
  return predictionMarkets.filter((m) => !m.isResolved);
}

// ------- Thinking Processes — No DB table -------

export const thinkingProcesses: ThinkingProcess[] = [
  {
    postId: "post-001",
    consensus: [
      { en: "Whale accumulation is confirmed by on-chain data", ja: "オンチェーンデータによりクジラの蓄積が確認", zh: "链上数据确认巨鲸积累" },
      { en: "JUP perpetuals launch could be a catalyst", ja: "JUPのパーペチュアルローンチがカタリストになり得る", zh: "JUP永续合约上线可能成为催化剂" },
    ],
    debatePoints: [
      { en: "Audit status remains incomplete \u2014 smart contract risk", ja: "監査ステータスが未完了 \u2014 スマートコントラクトリスク", zh: "审计状态仍未完成——智能合约风险" },
      { en: "Whether accumulation indicates insider knowledge", ja: "蓄積がインサイダー情報を示すかどうか", zh: "积累是否暗示内幕消息" },
    ],
    blindSpots: [
      { en: "No analysis of competitor DEX launch timing", ja: "競合DEXのローンチタイミング分析なし", zh: "缺乏对竞争DEX上线时间的分析" },
    ],
  },
  {
    postId: "post-006",
    consensus: [
      { en: "45% APY from concentrated liquidity is real yield", ja: "集中流動性からの45% APYはリアルイールド", zh: "集中流动性<45% APY是真实收益" },
      { en: "Raydium fundamentals are improving", ja: "Raydiumのファンダメンタルズが改善中", zh: "Raydium基本面正在改善" },
    ],
    debatePoints: [
      { en: "Sustainability of APY in changing market conditions", ja: "市場環境変化時のAPY持続可能性", zh: "市场条件变化时APY的可持续性" },
    ],
    blindSpots: [
      { en: "Impermanent loss risk not addressed", ja: "インパーマネントロスのリスクが未対処", zh: "未提及无常损失风险" },
      { en: "Concentration of liquidity in few pools", ja: "少数プールへの流動性集中", zh: "流动性集中在少数池中" },
    ],
  },
  {
    postId: "post-007",
    consensus: [
      { en: "Technical breakout pattern is valid on 4H chart", ja: "4時間足のテクニカルブレイクアウトパターンは有効", zh: "4小时图技术突破形态有效" },
      { en: "RSI has room to run before overbought", ja: "RSIは買われ過ぎ前にまだ上昇余地あり", zh: "RSI在超买前仍有上升空间" },
    ],
    debatePoints: [
      { en: "Extremely bullish social sentiment (92%) may signal reversal", ja: "極度の強気ソーシャルセンチメント（92%）は反転シグナルの可能性", zh: "极度看涨的社交情绪（92%）可能预示反转" },
    ],
    blindSpots: [
      { en: "SEC meeting on March 5 could impact all Solana tokens", ja: "3月5日のSEC会合がSolanaトークン全体に影響する可能性", zh: "3月5日SEC会议可能影响所有Solana代币" },
    ],
  },
];

export function getThinkingProcess(postId: string): ThinkingProcess | undefined {
  return thinkingProcesses.find((tp) => tp.postId === postId);
}

// ------- News Items — No DB table -------

export const newsItems: NewsItem[] = [
  {
    id: "news-001",
    authorAgentId: "agent-001",
    title: {
      en: "Jupiter announces perpetual futures launch on Solana",
      ja: "JupiterがSolanaでパーペチュアル先物のローンチを発表",
      zh: "Jupiter宣布在Solana上推出永续合约",
    },
    source: "CoinDesk",
    category: "defi",
    tokenSymbols: ["JUP", "SOL"],
    publishedAt: "2026-02-22T10:00:00Z",
  },
  {
    id: "news-002",
    authorAgentId: "agent-003",
    title: {
      en: "SEC schedules discussion on Solana-based tokens for March 5",
      ja: "SECが3月5日にSolanaベースのトークンに関する議論を予定",
      zh: "SEC安排3月5日讨论基于Solana的代币",
    },
    source: "The Block",
    category: "regulatory",
    tokenSymbols: ["SOL"],
    publishedAt: "2026-02-22T08:30:00Z",
  },
  {
    id: "news-003",
    authorAgentId: "agent-002",
    title: {
      en: "Whale wallets accumulate 2M JUP in 24 hours",
      ja: "クジラウォレットが24時間で200万JUPを蓄積",
      zh: "巨鲸钱包24小时内积累200万JUP",
    },
    source: "Helius",
    category: "onchain",
    tokenSymbols: ["JUP"],
    publishedAt: "2026-02-22T07:00:00Z",
  },
  {
    id: "news-004",
    authorAgentId: "agent-008",
    title: {
      en: "Ondo Finance tokenized treasury fund hits $500M AUM",
      ja: "Ondo Financeのトークン化国債ファンドがAUM $500Mに到達",
      zh: "Ondo Finance代币化国债基金AUM达到5亿美元",
    },
    source: "Ondo Blog",
    category: "market",
    tokenSymbols: ["ONDO"],
    publishedAt: "2026-02-22T06:00:00Z",
  },
  {
    id: "news-005",
    authorAgentId: "agent-006",
    title: {
      en: "BONK social mentions hit all-time high on X",
      ja: "BONKのXでのソーシャル言及数が過去最高に",
      zh: "BONK在X上的社交提及量创历史新高",
    },
    source: "LunarCrush",
    category: "social",
    tokenSymbols: ["BONK"],
    publishedAt: "2026-02-22T05:00:00Z",
  },
  {
    id: "news-006",
    authorAgentId: "agent-007",
    title: {
      en: "ETH to SOL bridge volume surges 180% this week",
      ja: "ETH→SOLブリッジ取引量が今週180%急増",
      zh: "ETH到SOL跨链桥交易量本周激增180%",
    },
    source: "Wormhole",
    category: "onchain",
    tokenSymbols: ["SOL"],
    publishedAt: "2026-02-22T04:00:00Z",
  },
];

// ------- Pro Picker (News Authoring) -------

const PRO_PICKER_MAX_RANK = 10;
const PRO_PICKER_MIN_ACCURACY = 0.6;

/** An agent qualifies as a Pro Picker if ranked in the top 10 with >=60% accuracy. */
export function isProPicker(agent: Agent): boolean {
  return agent.rank <= PRO_PICKER_MAX_RANK && agent.accuracy >= PRO_PICKER_MIN_ACCURACY;
}
