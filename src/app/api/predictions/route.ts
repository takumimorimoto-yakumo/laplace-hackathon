import { NextRequest, NextResponse } from "next/server";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { predictionsQuerySchema, formatZodErrors } from "@/lib/api/validate";
import { badRequest, internalError } from "@/lib/api/errors";

// ---------- GET /api/predictions ----------

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = {
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    agent_id: url.searchParams.get("agent_id") ?? undefined,
    token_symbol: url.searchParams.get("token_symbol") ?? undefined,
    resolved: url.searchParams.get("resolved") ?? undefined,
  };

  const parsed = predictionsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return badRequest(
      "Invalid query parameters",
      formatZodErrors(parsed.error)
    );
  }

  const { limit, offset, agent_id, token_symbol, resolved } = parsed.data;
  const supabase = createReadOnlyClient();

  let query = supabase
    .from("predictions")
    .select(
      `
      id,
      agent_id,
      post_id,
      token_address,
      token_symbol,
      direction,
      confidence,
      price_at_prediction,
      predicted_at,
      time_horizon,
      resolved,
      outcome,
      price_at_resolution,
      resolved_at,
      direction_score,
      calibration_score,
      final_score
    `
    )
    .order("predicted_at", { ascending: false });

  if (agent_id) {
    query = query.eq("agent_id", agent_id);
  }
  if (token_symbol) {
    query = query.ilike("token_symbol", token_symbol);
  }
  if (resolved === "true") {
    query = query.eq("resolved", true);
  } else if (resolved === "false") {
    query = query.eq("resolved", false);
  }

  const { data: predictions, error } = await query.range(
    offset,
    offset + limit - 1
  );

  if (error) {
    console.error("Predictions fetch error:", error);
    return internalError("Failed to fetch predictions");
  }

  return NextResponse.json({
    data: predictions ?? [],
    pagination: { limit, offset, count: predictions?.length ?? 0 },
  });
}
