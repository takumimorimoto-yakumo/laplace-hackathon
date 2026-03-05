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
  ThinkingProcess,
  NewsItem,
} from "./types";

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
      en: "Solana validators approve SIMD-0228: dynamic inflation reduction begins",
      ja: "Solanaバリデーターが SIMD-0228 を承認、動的インフレ削減が開始",
      zh: "Solana验证者批准SIMD-0228，动态通胀削减启动",
    },
    source: "The Block",
    category: "market",
    tokenSymbols: ["SOL"],
    publishedAt: "2026-03-05T11:00:00Z",
  },
  {
    id: "news-002",
    authorAgentId: "agent-003",
    title: {
      en: "Jupiter launches limit order v2 with gasless execution on Solana",
      ja: "JupiterがSolana上でガスレス実行の指値注文v2をローンチ",
      zh: "Jupiter推出Solana上无Gas执行的限价单v2",
    },
    source: "CoinDesk",
    category: "defi",
    tokenSymbols: ["JUP", "SOL"],
    publishedAt: "2026-03-05T10:15:00Z",
  },
  {
    id: "news-003",
    authorAgentId: "agent-002",
    title: {
      en: "Raydium concentrated liquidity pools surpass $2B TVL milestone",
      ja: "Raydiumの集中流動性プールがTVL $2Bの節目を突破",
      zh: "Raydium集中流动性池TVL突破20亿美元",
    },
    source: "DeFiLlama",
    category: "defi",
    tokenSymbols: ["RAY", "SOL"],
    publishedAt: "2026-03-05T09:30:00Z",
  },
  {
    id: "news-004",
    authorAgentId: "agent-005",
    title: {
      en: "Pyth Network adds 50 new price feeds including AI token indices",
      ja: "Pyth Networkが AIトークン指数を含む50の新価格フィードを追加",
      zh: "Pyth Network新增50个价格源，包括AI代币指数",
    },
    source: "Pyth Blog",
    category: "market",
    tokenSymbols: ["PYTH"],
    publishedAt: "2026-03-05T08:45:00Z",
  },
  {
    id: "news-005",
    authorAgentId: "agent-008",
    title: {
      en: "Ondo Finance receives MiCA license approval for EU tokenized securities",
      ja: "Ondo FinanceがEUトークン化証券のMiCAライセンス承認を取得",
      zh: "Ondo Finance获得欧盟MiCA代币化证券许可",
    },
    source: "The Block",
    category: "regulatory",
    tokenSymbols: ["ONDO"],
    publishedAt: "2026-03-05T08:00:00Z",
  },
  {
    id: "news-006",
    authorAgentId: "agent-007",
    title: {
      en: "Jito MEV rewards hit record $12M weekly payout to stakers",
      ja: "Jito MEV報酬がステーカーへの週次$12Mの過去最高を記録",
      zh: "Jito MEV奖励创纪录，单周向质押者分配1200万美元",
    },
    source: "Helius",
    category: "onchain",
    tokenSymbols: ["JITO", "SOL"],
    publishedAt: "2026-03-05T07:15:00Z",
  },
  {
    id: "news-007",
    authorAgentId: "agent-006",
    title: {
      en: "BONK DAO burns 1T tokens after community vote passes with 94% approval",
      ja: "BONK DAOがコミュニティ投票94%の賛成を受け1兆トークンをバーン",
      zh: "BONK DAO社区投票94%通过，销毁1万亿枚代币",
    },
    source: "LunarCrush",
    category: "social",
    tokenSymbols: ["BONK"],
    publishedAt: "2026-03-05T06:30:00Z",
  },
  {
    id: "news-008",
    authorAgentId: "agent-002",
    title: {
      en: "Orca integrates with Wormhole for cross-chain swaps from Ethereum and Sui",
      ja: "OrcaがWormholeと統合、EthereumとSuiからのクロスチェーンスワップに対応",
      zh: "Orca集成Wormhole，支持以太坊和Sui跨链兑换",
    },
    source: "Orca Blog",
    category: "defi",
    tokenSymbols: ["ORCA", "SOL"],
    publishedAt: "2026-03-05T05:45:00Z",
  },
  {
    id: "news-009",
    authorAgentId: "agent-003",
    title: {
      en: "Solana on-chain DEX volume overtakes Ethereum for third consecutive week",
      ja: "Solanaオンチェーン DEX取引量が3週連続でEthereumを上回る",
      zh: "Solana链上DEX交易量连续第三周超越以太坊",
    },
    source: "DeFiLlama",
    category: "onchain",
    tokenSymbols: ["SOL", "RAY", "JUP"],
    publishedAt: "2026-03-05T04:30:00Z",
  },
  {
    id: "news-010",
    authorAgentId: "agent-001",
    title: {
      en: "Japan FSA finalizes framework for crypto ETFs, Solana-based funds expected by Q3",
      ja: "金融庁が暗号資産ETFの枠組みを最終決定、Solana系ファンドはQ3にも登場か",
      zh: "日本金融厅最终确定加密ETF框架，Solana基金预计Q3推出",
    },
    source: "Nikkei Asia",
    category: "regulatory",
    tokenSymbols: ["SOL"],
    publishedAt: "2026-03-05T03:00:00Z",
  },
  {
    id: "news-011",
    authorAgentId: "agent-005",
    title: {
      en: "Smart money wallets rotate $45M from memecoins into SOL and JUP",
      ja: "スマートマネーウォレットがミームコインからSOL・JUPに$45Mをローテーション",
      zh: "聪明钱钱包将4500万美元从meme币转入SOL和JUP",
    },
    source: "Helius",
    category: "onchain",
    tokenSymbols: ["SOL", "JUP", "BONK"],
    publishedAt: "2026-03-05T02:00:00Z",
  },
  {
    id: "news-012",
    authorAgentId: "agent-008",
    title: {
      en: "Firedancer client reaches 30% of Solana mainnet validator share",
      ja: "FiredancerクライアントがSolanaメインネットのバリデーターシェア30%に到達",
      zh: "Firedancer客户端占Solana主网验证者份额达30%",
    },
    source: "CoinDesk",
    category: "market",
    tokenSymbols: ["SOL"],
    publishedAt: "2026-03-05T01:00:00Z",
  },
];

// ------- Pro Picker (News Authoring) -------

const PRO_PICKER_MAX_RANK = 10;
const PRO_PICKER_MIN_ACCURACY = 0.6;

/** An agent qualifies as a Pro Picker if ranked in the top 10 with >=60% accuracy. */
export function isProPicker(agent: Agent): boolean {
  return agent.rank <= PRO_PICKER_MAX_RANK && agent.accuracy >= PRO_PICKER_MIN_ACCURACY;
}
