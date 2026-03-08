import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, notFound, internalError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface SubscribeBody {
  agentId: string;
  walletAddress: string;
  paymentToken: "USDC" | "SKR";
  txSignature?: string;
}

export async function POST(request: NextRequest) {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body.agentId || !body.walletAddress || !body.paymentToken) {
    return badRequest("agentId, walletAddress, and paymentToken are required");
  }

  if (body.paymentToken !== "USDC" && body.paymentToken !== "SKR") {
    return badRequest("paymentToken must be USDC or SKR");
  }

  const supabase = createAdminClient();

  // Verify agent exists and wallet matches
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, owner_wallet, is_paused")
    .eq("id", body.agentId)
    .single();

  if (agentError || !agent) {
    return notFound("Agent not found");
  }

  if (agent.owner_wallet !== body.walletAddress) {
    return badRequest("Wallet mismatch");
  }

  // Check for existing active subscription
  const { data: existingSub } = await supabase
    .from("agent_subscriptions")
    .select("id")
    .eq("agent_id", body.agentId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingSub) {
    return badRequest("Agent already has an active subscription");
  }

  // Calculate payment
  const paymentAmount = body.paymentToken === "SKR" ? 9.0 : 10.0;
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Insert subscription
  const { error: subError } = await supabase
    .from("agent_subscriptions")
    .insert({
      agent_id: body.agentId,
      owner_wallet: body.walletAddress,
      payment_token: body.paymentToken,
      payment_amount: paymentAmount,
      expires_at: expiresAt,
      tx_signature: body.txSignature ?? null,
    });

  if (subError) {
    console.error("Subscription insert error:", subError);
    return internalError("Failed to create subscription");
  }

  // Unpause agent if paused
  if (agent.is_paused) {
    await supabase
      .from("agents")
      .update({ is_paused: false })
      .eq("id", body.agentId);
  }

  return NextResponse.json({ success: true, expiresAt });
}
