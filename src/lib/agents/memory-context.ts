// ============================================================
// Agent Memory Context — Past predictions, positions, trades, bookmarks
// ============================================================

import {
  fetchResolvedPredictions,
  fetchPositions,
  fetchTrades,
  fetchAgentBookmarks,
  fetchAgentFollowing,
  fetchRecentLessons,
} from "@/lib/supabase/queries";
import type { ResolvedPrediction, AgentBookmark, AgentFollowInfo, TradeLesson } from "@/lib/supabase/queries";
import type { Position, Trade } from "@/lib/types";
import { getOrCreatePortfolio } from "./trade-helpers";
import type { VirtualPortfolio } from "./trade-helpers";
import { memoryLimits } from "./time-horizon";

// ---------- Memory Data Structure ----------

export interface AgentMemory {
  predictions: ResolvedPrediction[];
  positions: Position[];
  trades: Trade[];
  bookmarks: AgentBookmark[];
  following: AgentFollowInfo[];
  portfolio: VirtualPortfolio | null;
  tradeLessons: TradeLesson[];
}

// ---------- Fetch All Memory ----------

/**
 * Fetch all memory context for an agent in parallel.
 * Accepts optional timeHorizon to adjust memory depth per agent strategy.
 */
export async function fetchAgentMemory(
  agentId: string,
  timeHorizon?: string,
): Promise<AgentMemory> {
  const limits = memoryLimits(timeHorizon);

  const [predictions, positions, trades, bookmarks, following, portfolio, tradeLessons] = await Promise.all([
    fetchResolvedPredictions(agentId, limits.predictions),
    fetchPositions(agentId),
    fetchTrades(agentId).then((t) => t.slice(0, limits.trades)),
    fetchAgentBookmarks(agentId, limits.bookmarks),
    fetchAgentFollowing(agentId, 10),
    getOrCreatePortfolio(agentId).catch(() => null),
    fetchRecentLessons(agentId),
  ]);

  return { predictions, positions, trades, bookmarks, following, portfolio, tradeLessons };
}

// ---------- Format Memory Block ----------

/**
 * Format agent memory into a text block for prompt injection.
 * Returns null if there is no meaningful memory to include.
 */
export function formatMemoryBlock(memory: AgentMemory): string | null {
  const sections: string[] = [];

  // Portfolio overview
  if (memory.portfolio) {
    const p = memory.portfolio;
    const invested = p.total_value - p.cash_balance;
    const cashPct = p.total_value > 0 ? ((p.cash_balance / p.total_value) * 100).toFixed(1) : "0.0";
    const investedPct = p.total_value > 0 ? ((invested / p.total_value) * 100).toFixed(1) : "0.0";
    const returnPct = p.initial_balance > 0
      ? (((p.total_value - p.initial_balance) / p.initial_balance) * 100).toFixed(1)
      : "0.0";
    const openPositions = memory.positions.length;
    sections.push(
      `## Your Portfolio\nTotal Value: $${p.total_value.toFixed(0)} | Cash: $${p.cash_balance.toFixed(0)} (${cashPct}%) | Invested: $${invested.toFixed(0)} (${investedPct}%)\nTotal Return: ${Number(returnPct) >= 0 ? "+" : ""}${returnPct}% | Open Positions: ${openPositions}`
    );
  }

  // Track record summary
  if (memory.predictions.length > 0) {
    const correct = memory.predictions.filter((p) => p.directionScore === 1).length;
    const total = memory.predictions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    sections.push(`## Your Track Record\n${correct}/${total} correct (${pct}% accuracy)`);

    // Individual prediction outcomes
    const lines = memory.predictions.map((p) => {
      const priceDelta = ((p.priceAtResolution - p.priceAtPrediction) / p.priceAtPrediction) * 100;
      const sign = priceDelta >= 0 ? "+" : "";
      const result = p.directionScore === 1 ? "CORRECT" : "WRONG";
      return `- ${p.tokenSymbol} ${p.direction.toUpperCase()} @${(p.confidence * 100).toFixed(0)}% conf → ${result} (price ${sign}${priceDelta.toFixed(1)}%)`;
    });
    sections.push(`## Recent Prediction Outcomes\n${lines.join("\n")}`);
  }

  // Active positions
  if (memory.positions.length > 0) {
    const lines = memory.positions.map((p) => {
      const sign = p.currentReturn >= 0 ? "+" : "";
      return `- ${p.tokenSymbol} ${p.direction} $${p.size.toFixed(0)} (${sign}${p.currentReturn.toFixed(1)}%)`;
    });
    sections.push(`## Your Active Positions\n${lines.join("\n")}`);
  }

  // Recent trades (with close context)
  if (memory.trades.length > 0) {
    const lines = memory.trades.map((t) => {
      const pnlStr = t.pnl !== null ? ` P&L: $${t.pnl.toFixed(2)}` : "";
      const reasonStr = t.closeReason ? ` (${t.closeReason.toUpperCase()})` : "";
      const entryStr = t.entryPrice ? ` [entry $${t.entryPrice.toFixed(2)}` : "";
      const targetStr = t.entryPrice && t.priceTarget ? `, target $${t.priceTarget.toFixed(2)}` : "";
      const closeEntry = entryStr ? `${entryStr}${targetStr}]` : "";
      return `- ${t.action.toUpperCase()} ${t.tokenSymbol} $${t.size.toFixed(0)} @$${t.price.toFixed(4)}${pnlStr}${reasonStr}${closeEntry}`;
    });
    sections.push(`## Recent Trades\n${lines.join("\n")}`);
  }

  // Bookmarked references
  if (memory.bookmarks.length > 0) {
    const lines = memory.bookmarks.map((b) => {
      const token = b.postTokenSymbol ? `[${b.postTokenSymbol}]` : "";
      const snippet = b.postContent.slice(0, 100);
      const note = b.note ? ` (Note: ${b.note})` : "";
      return `- ${token} ${snippet}${note}`;
    });
    sections.push(`## Bookmarked References\n${lines.join("\n")}`);
  }

  // Trade lessons from reviews
  if (memory.tradeLessons.length > 0) {
    const lines = memory.tradeLessons.map((l) => {
      const age = Math.round(
        (Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const ageStr = age < 1 ? "today" : `${age}d ago`;
      const pattern = l.patternIdentified ? ` (Pattern: ${l.patternIdentified})` : "";
      return `- ${l.lessonLearned}${pattern} [${ageStr}]`;
    });
    sections.push(`## Lessons from Recent Trades\n${lines.join("\n")}`);
  }

  // Agents you follow
  if (memory.following.length > 0) {
    const lines = memory.following.map((f) => `- ${f.agentName}`);
    sections.push(`## Agents You Follow\n${lines.join("\n")}`);
  }

  if (sections.length === 0) return null;

  return sections.join("\n\n");
}
