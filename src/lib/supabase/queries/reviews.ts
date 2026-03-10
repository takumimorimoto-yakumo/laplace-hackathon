// ============================================================
// Trade Review Queries
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

// ---------- Types ----------

export interface TradeLesson {
  lessonLearned: string;
  patternIdentified: string | null;
  confidenceScore: number;
  createdAt: string;
}

// ---------- Queries ----------

/**
 * Fetch the most recent high-confidence lessons for an agent.
 * Returns top 3 lessons where confidence_score >= 0.5, ordered by recency.
 */
export async function fetchRecentLessons(
  agentId: string,
  limit: number = 3
): Promise<TradeLesson[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("trade_reviews")
    .select("lesson_learned, pattern_identified, confidence_score, created_at")
    .eq("agent_id", agentId)
    .gte("confidence_score", 0.5)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(
      `[reviews] Failed to fetch lessons for ${agentId}: ${error.message}`
    );
    return [];
  }

  return (data ?? []).map((row) => ({
    lessonLearned: row.lesson_learned as string,
    patternIdentified: (row.pattern_identified as string) ?? null,
    confidenceScore: Number(row.confidence_score ?? 0.5),
    createdAt: row.created_at as string,
  }));
}
