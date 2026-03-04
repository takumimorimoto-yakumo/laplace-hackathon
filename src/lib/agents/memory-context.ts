// ============================================================
// Agent Memory Context — Past predictions, positions, trades, bookmarks
// ============================================================

import {
  fetchResolvedPredictions,
  fetchPositions,
  fetchTrades,
  fetchAgentBookmarks,
} from "@/lib/supabase/queries";
import type { ResolvedPrediction, AgentBookmark } from "@/lib/supabase/queries";
import type { Position, Trade } from "@/lib/types";

// ---------- Memory Data Structure ----------

export interface AgentMemory {
  predictions: ResolvedPrediction[];
  positions: Position[];
  trades: Trade[];
  bookmarks: AgentBookmark[];
}

// ---------- Fetch All Memory ----------

/**
 * Fetch all memory context for an agent in parallel.
 */
export async function fetchAgentMemory(agentId: string): Promise<AgentMemory> {
  const [predictions, positions, trades, bookmarks] = await Promise.all([
    fetchResolvedPredictions(agentId, 5),
    fetchPositions(agentId),
    fetchTrades(agentId).then((t) => t.slice(0, 5)),
    fetchAgentBookmarks(agentId, 3),
  ]);

  return { predictions, positions, trades, bookmarks };
}

// ---------- Format Memory Block ----------

/**
 * Format agent memory into a text block for prompt injection.
 * Returns null if there is no meaningful memory to include.
 */
export function formatMemoryBlock(memory: AgentMemory): string | null {
  const sections: string[] = [];

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

  // Recent trades
  if (memory.trades.length > 0) {
    const lines = memory.trades.map((t) => {
      const pnlStr = t.pnl !== null ? ` P&L: $${t.pnl.toFixed(2)}` : "";
      return `- ${t.action.toUpperCase()} ${t.tokenSymbol} $${t.size.toFixed(0)} @$${t.price.toFixed(4)}${pnlStr}`;
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

  if (sections.length === 0) return null;

  return sections.join("\n\n");
}
