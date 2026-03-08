import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";
import { verifyAgentOwnership } from "@/lib/api/verify-ownership";

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

  const body = rawBody as Record<string, unknown>;
  const message =
    typeof body.message === "string" ? body.message : undefined;
  const signature =
    typeof body.signature === "string" ? body.signature : undefined;

  // Verify wallet ownership via signature
  const { error: authError } = await verifyAgentOwnership(
    id,
    "pause",
    message,
    signature
  );
  if (authError) return authError;

  // Fetch current pause state
  const supabase = createAdminClient();
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("is_paused")
    .eq("id", id)
    .single();

  if (fetchError || !agent) {
    return internalError("Failed to fetch agent state");
  }

  // Toggle is_paused
  const newPausedState = !agent.is_paused;

  const { error: updateError } = await supabase
    .from("agents")
    .update({ is_paused: newPausedState })
    .eq("id", id);

  if (updateError) {
    console.error("User agent pause toggle error:", updateError);
    return internalError("Failed to toggle pause");
  }

  return NextResponse.json({ is_paused: newPausedState });
}
