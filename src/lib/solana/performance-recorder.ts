// ============================================================
// Performance Recorder — Record agent performance on-chain
// ============================================================
//
// Records daily agent performance snapshots to Solana via SPL Memo.
// Each memo contains a compact JSON payload with trade stats, accuracy,
// and portfolio metrics. Daily records enable analysis across any timeframe
// (weekly, monthly, quarterly, semi-annual, annual) by aggregation.

import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import { getSignerKeypair, ensureFunded } from "./prediction-recorder";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

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

export function buildPerformanceMemo(data: AgentPerformanceData): PerformanceMemo {
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

export function serializePerformanceMemo(memo: PerformanceMemo): string {
  const json = JSON.stringify(memo);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > 566) {
    throw new Error(`Performance memo too large: ${byteLength} bytes (max 566)`);
  }
  return json;
}

// ---------- Data Fetcher ----------

/**
 * Gather performance data for a single agent from the DB.
 * Queries virtual_trades, predictions, virtual_portfolios, and agents.
 */
export async function gatherAgentPerformance(
  agentId: string,
  date: string
): Promise<AgentPerformanceData | null> {
  const supabase = createAdminClient();

  // Fetch agent info
  const { data: agent } = await supabase
    .from("agents")
    .select("name, accuracy_score, leaderboard_rank, total_predictions")
    .eq("id", agentId)
    .single();

  if (!agent) return null;

  // Fetch portfolio
  const { data: portfolio } = await supabase
    .from("virtual_portfolios")
    .select("total_value, total_pnl, total_pnl_pct")
    .eq("agent_id", agentId)
    .single();

  // Fetch all closed trades for this agent
  const { data: trades } = await supabase
    .from("virtual_trades")
    .select("realized_pnl")
    .eq("agent_id", agentId)
    .eq("action", "close");

  const totalTrades = trades?.length ?? 0;
  const wins = trades?.filter((t) => Number(t.realized_pnl) > 0).length ?? 0;
  const losses = trades?.filter((t) => Number(t.realized_pnl) < 0).length ?? 0;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;

  // Fetch resolved predictions (direction + outcome to determine correctness)
  const { data: resolvedPreds } = await supabase
    .from("predictions")
    .select("direction, outcome")
    .eq("agent_id", agentId)
    .eq("resolved", true);

  const totalPredictions = resolvedPreds?.length ?? 0;
  const correctCount = resolvedPreds?.filter(
    (p) => (p.outcome as string) === "correct"
  ).length ?? 0;

  // Daily P&L: difference between today's snapshot and yesterday's
  const yesterday = new Date(new Date(date).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: todaySnap } = await supabase
    .from("portfolio_snapshots")
    .select("total_pnl")
    .eq("agent_id", agentId)
    .eq("snapshot_date", date)
    .single();

  const { data: yesterdaySnap } = await supabase
    .from("portfolio_snapshots")
    .select("total_pnl")
    .eq("agent_id", agentId)
    .eq("snapshot_date", yesterday)
    .single();

  const todayPnl = Number(todaySnap?.total_pnl ?? portfolio?.total_pnl ?? 0);
  const yesterdayPnl = Number(yesterdaySnap?.total_pnl ?? 0);
  const dailyPnl = todayPnl - yesterdayPnl;

  return {
    agentId,
    agentName: agent.name as string,
    date,
    totalTrades,
    wins,
    losses,
    winRate,
    portfolioValue: Number(portfolio?.total_value ?? 10000),
    returnPct: Number(portfolio?.total_pnl_pct ?? 0),
    dailyPnl,
    totalPredictions: Number(agent.total_predictions ?? totalPredictions),
    correctPredictions: correctCount,
    accuracy: Number(agent.accuracy_score ?? 0), // DB stores 0-1, memo stores 0-1
    rank: Number(agent.leaderboard_rank ?? 999),
  };
}

// ---------- On-Chain Recording ----------

/**
 * Record a single agent's daily performance on-chain via SPL Memo.
 * Returns the transaction signature, or null on failure.
 */
export async function recordPerformanceOnChain(
  data: AgentPerformanceData
): Promise<string | null> {
  try {
    const signer = getSignerKeypair();
    await ensureFunded(signer);

    const memo = buildPerformanceMemo(data);
    const memoString = serializePerformanceMemo(memo);

    const connection = getConnection();
    const instruction = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(memoString, "utf-8"),
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = signer.publicKey;

    transaction.sign(signer);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    console.log(
      `[perf] Agent ${data.agentName} performance recorded on-chain: ${signature}`
    );
    return signature;
  } catch (err) {
    console.warn(
      `[perf] Failed to record performance for ${data.agentId} on-chain:`,
      err
    );
    return null;
  }
}

/**
 * Record daily performance snapshots for all agents on-chain.
 * Should be called once daily after portfolio snapshots are recorded.
 * Returns a map of agentId -> txSignature for successful recordings.
 */
export async function recordAllPerformanceOnChain(): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (!process.env.SOLANA_SIGNER_PRIVATE_KEY) {
    console.warn("[perf] SOLANA_SIGNER_PRIVATE_KEY not set, skipping on-chain recording");
    return results;
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all agents with portfolios
  const { data: portfolios, error } = await supabase
    .from("virtual_portfolios")
    .select("agent_id");

  if (error || !portfolios) {
    console.error("[perf] Failed to fetch portfolios:", error?.message);
    return results;
  }

  for (const p of portfolios) {
    const agentId = p.agent_id as string;
    const data = await gatherAgentPerformance(agentId, today);
    if (!data) continue;

    const signature = await recordPerformanceOnChain(data);
    if (signature) {
      results.set(agentId, signature);
    }
  }

  console.log(`[perf] Recorded ${results.size}/${portfolios.length} agent performances on-chain`);
  return results;
}
