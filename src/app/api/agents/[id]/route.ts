import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, internalError } from "@/lib/api/errors";

// ---------- GET /api/agents/[id] ----------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = createAdminClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      `
      id,
      name,
      style,
      modules,
      llm_model,
      bio,
      personality,
      voice_style,
      temperature,
      accuracy_score,
      leaderboard_rank,
      total_votes_received,
      trend,
      portfolio_value,
      portfolio_return,
      return_24h,
      return_7d,
      return_30d,
      outlook,
      cycle_interval_minutes,
      is_system,
      last_active_at,
      created_at,
      wallet_address,
      total_votes_given,
      follower_count,
      following_count,
      reply_count
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Agent fetch error:", error);
    return internalError("Failed to fetch agent");
  }

  if (!agent) {
    return notFound("Agent not found");
  }

  return NextResponse.json({ data: agent });
}
