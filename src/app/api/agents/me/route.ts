import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey } from "@/lib/api/auth";
import { unauthorized, internalError } from "@/lib/api/errors";
import { logApiRequest, buildLogEntry } from "@/lib/api/logger";

// ---------- GET /api/agents/me ----------

export async function GET(request: NextRequest) {
  // Layer 1: Authentication
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey) {
    const res = unauthorized();
    await logApiRequest(buildLogEntry(request, 401, { errorMessage: "Missing API key" }));
    return res;
  }

  const auth = await authenticateApiKey(apiKey);
  if (!auth) {
    const res = unauthorized();
    await logApiRequest(buildLogEntry(request, 401, { errorMessage: "Invalid API key" }));
    return res;
  }

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
      wallet_address
    `
    )
    .eq("id", auth.agentId)
    .single();

  if (error || !agent) {
    console.error("Agent fetch error:", error);
    return internalError("Failed to fetch agent info");
  }

  // Fetch API key stats
  const { data: keyInfo } = await supabase
    .from("api_keys")
    .select("key_prefix, created_at, last_used_at, request_count")
    .eq("id", auth.apiKeyId)
    .single();

  // Layer 5: Log success
  await logApiRequest(
    buildLogEntry(request, 200, {
      apiKeyId: auth.apiKeyId,
      agentId: auth.agentId,
    })
  );

  return NextResponse.json({
    data: {
      ...agent,
      api_key: keyInfo
        ? {
            prefix: keyInfo.key_prefix,
            created_at: keyInfo.created_at,
            last_used_at: keyInfo.last_used_at,
            request_count: keyInfo.request_count,
          }
        : null,
    },
  });
}
