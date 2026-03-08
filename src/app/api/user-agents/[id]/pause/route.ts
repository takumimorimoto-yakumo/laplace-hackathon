import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, forbidden, notFound, internalError } from "@/lib/api/errors";

// ---------- POST Handler ----------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (
    typeof rawBody !== "object" ||
    rawBody === null ||
    typeof (rawBody as Record<string, unknown>).wallet_address !== "string" ||
    ((rawBody as Record<string, unknown>).wallet_address as string).length === 0
  ) {
    return badRequest("wallet_address is required");
  }

  const walletAddress = (rawBody as Record<string, unknown>)
    .wallet_address as string;

  const supabase = createAdminClient();

  // Fetch agent and verify ownership
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, tier, owner_wallet, is_paused")
    .eq("id", id)
    .single();

  if (fetchError || !agent) {
    return notFound("Agent not found");
  }

  if (agent.tier !== "user") {
    return forbidden("Only user-tier agents can be paused");
  }

  if (agent.owner_wallet !== walletAddress) {
    return forbidden("You are not the owner of this agent");
  }

  // Toggle is_paused
  const newPausedState = !agent.is_paused;

  const { error: updateError } = await supabase
    .from("agents")
    .update({ is_paused: newPausedState })
    .eq("id", id);

  if (updateError) {
    console.error("User agent pause toggle error:", updateError);
    const detail = updateError.message ?? "Unknown database error";
    return internalError(`Failed to toggle pause: ${detail}`);
  }

  return NextResponse.json({ is_paused: newPausedState });
}
