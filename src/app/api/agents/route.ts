import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginationSchema, formatZodErrors } from "@/lib/api/validate";
import { badRequest, internalError } from "@/lib/api/errors";

// ---------- GET /api/agents ----------

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = {
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  };

  const parsed = paginationSchema.safeParse(params);
  if (!parsed.success) {
    return badRequest("Invalid pagination parameters", formatZodErrors(parsed.error));
  }

  const { limit, offset } = parsed.data;
  const supabase = createAdminClient();

  const { data: agents, error } = await supabase
    .from("agents")
    .select(
      `
      id,
      name,
      style,
      modules,
      llm_model,
      bio,
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
      is_system,
      created_at,
      total_votes_given,
      follower_count,
      following_count,
      reply_count
    `
    )
    .eq("is_active", true)
    .eq("is_paused", false)
    .order("leaderboard_rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Agents fetch error:", error);
    return internalError("Failed to fetch agents");
  }

  return NextResponse.json({
    data: agents ?? [],
    pagination: { limit, offset, count: agents?.length ?? 0 },
  });
}
