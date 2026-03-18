// ============================================================
// Performance Recorder — DEPRECATED
// ============================================================
//
// On-chain performance recording has been disabled for strategic reasons.
// Recording agent accuracy, returns, and ranks publicly on-chain allows
// competitors to freely track and copy the strategies of top-performing agents.
// DB snapshots (portfolio_snapshots table) are sufficient for internal use.
//
// All exported functions are no-ops kept for import compatibility only.

// Solana imports retained to avoid breaking any external consumers that
// may import only the type definitions from this module.
// The runtime functions below are all no-ops.

// ---------- Types ----------

export interface AgentPerformanceData {
  agentId: string;
  agentName: string;
  date: string; // YYYY-MM-DD
  // Trade metrics
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0-1
  // Portfolio metrics
  portfolioValue: number;
  returnPct: number; // total return %
  dailyPnl: number; // P&L for this day ($)
  // Prediction metrics
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number; // 0-1
  // Ranking
  rank: number;
}

/** Compact on-chain memo format (< 300 bytes) */
interface PerformanceMemo {
  v: 1;
  type: "perf";
  aid: string; // agent ID (8 chars)
  name: string; // agent name (truncated)
  d: string; // date YYYY-MM-DD
  // Trades
  tt: number; // total trades
  w: number; // wins
  l: number; // losses
  wr: number; // win rate (2 decimals)
  // Portfolio
  pv: number; // portfolio value
  ret: number; // return % (2 decimals)
  dpnl: number; // daily P&L
  // Predictions
  tp: number; // total predictions
  cp: number; // correct predictions
  acc: number; // accuracy (2 decimals)
  // Meta
  rank: number;
  ts: number; // unix timestamp
}

// ---------- Memo Builder ----------

/**
 * @deprecated On-chain performance recording has been disabled for strategic reasons.
 * Returns a stub memo object without recording anything.
 */
export function buildPerformanceMemo(data: AgentPerformanceData): PerformanceMemo {
  console.warn("[perf] DEPRECATED: On-chain performance recording has been disabled for strategic reasons");
  return {
    v: 1,
    type: "perf",
    aid: data.agentId.slice(0, 8),
    name: data.agentName.slice(0, 16),
    d: data.date,
    tt: data.totalTrades,
    w: data.wins,
    l: data.losses,
    wr: Number(data.winRate.toFixed(2)),
    pv: Number(data.portfolioValue.toFixed(2)),
    ret: Number(data.returnPct.toFixed(2)),
    dpnl: Number(data.dailyPnl.toFixed(2)),
    tp: data.totalPredictions,
    cp: data.correctPredictions,
    acc: Number(data.accuracy.toFixed(2)),
    rank: data.rank,
    ts: Math.floor(Date.now() / 1000),
  };
}

/**
 * @deprecated On-chain performance recording has been disabled for strategic reasons.
 * Returns the serialized memo string without sending any transaction.
 */
export function serializePerformanceMemo(memo: PerformanceMemo): string {
  console.warn("[perf] DEPRECATED: On-chain performance recording has been disabled for strategic reasons");
  return JSON.stringify(memo);
}

// ---------- Data Fetcher ----------

/**
 * @deprecated On-chain performance recording has been disabled for strategic reasons.
 * Always returns null.
 */
export async function gatherAgentPerformance(
  _agentId: string,
  _date: string
): Promise<AgentPerformanceData | null> {
  console.warn("[perf] DEPRECATED: On-chain performance recording has been disabled for strategic reasons");
  return null;
}

// ---------- On-Chain Recording ----------

/**
 * @deprecated On-chain performance recording has been disabled for strategic reasons.
 * Always returns null without sending any transaction.
 */
export async function recordPerformanceOnChain(
  _data: AgentPerformanceData
): Promise<string | null> {
  console.warn("[perf] DEPRECATED: On-chain performance recording has been disabled for strategic reasons");
  return null;
}

/**
 * @deprecated On-chain performance recording has been disabled for strategic reasons.
 * Always returns an empty map without sending any transactions.
 */
export async function recordAllPerformanceOnChain(): Promise<Map<string, string>> {
  console.warn("[perf] DEPRECATED: On-chain performance recording has been disabled for strategic reasons");
  return new Map<string, string>();
}
