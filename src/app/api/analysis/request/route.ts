import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Shape of the POST request body */
interface AnalysisRequestBody {
  agentId: string;
  userWallet: string;
  tokenSymbol: string;
  tokenAddress?: string;
}

/** Validate the incoming request body */
function isValidBody(body: unknown): body is AnalysisRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.agentId !== "string" || b.agentId.length === 0) return false;
  if (typeof b.userWallet !== "string" || b.userWallet.length === 0) return false;
  if (typeof b.tokenSymbol !== "string" || b.tokenSymbol.length === 0) return false;
  if (b.tokenAddress !== undefined && typeof b.tokenAddress !== "string") return false;
  return true;
}

/**
 * POST /api/analysis/request
 *
 * Submit a custom analysis request from a renter.
 *
 * Body:
 * - agentId: string (required)
 * - userWallet: string (required)
 * - tokenSymbol: string (required)
 * - tokenAddress?: string (optional)
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. agentId, userWallet, and tokenSymbol are required.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Check rental is active
  const { data: rental, error: rentalError } = await supabase
    .from("agent_rentals")
    .select("id")
    .eq("user_wallet", body.userWallet)
    .eq("agent_id", body.agentId)
    .eq("is_active", true)
    .gte("expires_at", new Date().toISOString())
    .limit(1)
    .single();

  if (rentalError || !rental) {
    return NextResponse.json(
      { error: "Active rental not found for this agent" },
      { status: 403 }
    );
  }

  // Check for existing pending request (same agent + user + token)
  const { data: existing } = await supabase
    .from("analysis_requests")
    .select("id")
    .eq("agent_id", body.agentId)
    .eq("user_wallet", body.userWallet)
    .eq("token_symbol", body.tokenSymbol)
    .eq("status", "pending")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "A pending request for this token already exists" },
      { status: 409 }
    );
  }

  // Insert analysis request
  const { data: analysisRequest, error: insertError } = await supabase
    .from("analysis_requests")
    .insert({
      agent_id: body.agentId,
      user_wallet: body.userWallet,
      token_symbol: body.tokenSymbol,
      token_address: body.tokenAddress ?? null,
    })
    .select("*")
    .single();

  if (insertError || !analysisRequest) {
    console.error("analysis_requests insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to create analysis request" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      request: {
        id: analysisRequest.id as string,
        agentId: analysisRequest.agent_id as string,
        tokenSymbol: analysisRequest.token_symbol as string,
        status: analysisRequest.status as string,
        createdAt: analysisRequest.created_at as string,
      },
    },
    { status: 201 }
  );
}

/**
 * GET /api/analysis/request?wallet=...&agentId=...
 *
 * Fetch analysis requests for a wallet + agent combination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const agentId = searchParams.get("agentId");

  if (!wallet || !agentId) {
    return NextResponse.json(
      { error: "wallet and agentId query params are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("analysis_requests")
    .select("*")
    .eq("user_wallet", wallet)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("analysis_requests fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis requests" },
      { status: 500 }
    );
  }

  const requests = (data ?? []).map((row) => ({
    id: row.id as string,
    agentId: row.agent_id as string,
    tokenSymbol: row.token_symbol as string,
    status: row.status as string,
    resultPostId: (row.result_post_id as string) ?? null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? null,
  }));

  return NextResponse.json({ requests });
}
