import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";
import { verifyAgentOwnership } from "@/lib/api/verify-ownership";

// ---------- PATCH Handler: Enable/disable live trading ----------

export async function PATCH(
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
    typeof (rawBody as Record<string, unknown>).enabled !== "boolean"
  ) {
    return badRequest("wallet_address (string) and enabled (boolean) are required");
  }

  const body = rawBody as Record<string, unknown>;
  const walletAddress = body.wallet_address as string;
  const enabled = body.enabled as boolean;
  const message =
    typeof body.message === "string" ? body.message : undefined;
  const signature =
    typeof body.signature === "string" ? body.signature : undefined;

  if (!walletAddress) {
    return badRequest("wallet_address must not be empty");
  }

  // Verify wallet ownership via signature
  const { error: authError } = await verifyAgentOwnership(
    id,
    "live-trading",
    message,
    signature
  );
  if (authError) return authError;

  const supabase = createAdminClient();

  // Check if agent has a wallet configured for live trading
  if (enabled) {
    const { data: agent, error: fetchError } = await supabase
      .from("agents")
      .select("wallet_encrypted_key")
      .eq("id", id)
      .single();

    if (fetchError || !agent) {
      return internalError("Failed to fetch agent wallet state");
    }

    if (!agent.wallet_encrypted_key) {
      return badRequest("Agent does not have a wallet configured for live trading");
    }
  }

  // Update live_trading_enabled
  const { error: updateError } = await supabase
    .from("agents")
    .update({ live_trading_enabled: enabled })
    .eq("id", id);

  if (updateError) {
    console.error("Live trading toggle error:", updateError);
    return internalError("Failed to update live trading");
  }

  return NextResponse.json({ live_trading_enabled: enabled });
}
