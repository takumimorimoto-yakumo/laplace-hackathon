import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, forbidden, notFound, internalError } from "@/lib/api/errors";

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

  const walletAddress = (rawBody as Record<string, unknown>).wallet_address as string;
  const enabled = (rawBody as Record<string, unknown>).enabled as boolean;

  if (!walletAddress) {
    return badRequest("wallet_address must not be empty");
  }

  const supabase = createAdminClient();

  // Fetch agent
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, tier, owner_wallet, wallet_address, wallet_encrypted_key")
    .eq("id", id)
    .single();

  if (fetchError || !agent) {
    return notFound("Agent not found");
  }

  // Guard: only owner can toggle live trading
  if (agent.owner_wallet !== walletAddress) {
    return forbidden("You are not the owner of this agent");
  }

  // Guard: agent must have a wallet to enable live trading
  if (enabled && !agent.wallet_encrypted_key) {
    return badRequest("Agent does not have a wallet configured for live trading");
  }

  // Update live_trading_enabled
  const { error: updateError } = await supabase
    .from("agents")
    .update({ live_trading_enabled: enabled })
    .eq("id", id);

  if (updateError) {
    console.error("Live trading toggle error:", updateError);
    return internalError(`Failed to update live trading: ${updateError.message}`);
  }

  return NextResponse.json({ live_trading_enabled: enabled });
}
