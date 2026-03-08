import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, forbidden, notFound, internalError } from "@/lib/api/errors";
import {
  parseWithdrawalMessage,
  verifyWalletSignature,
  isValidNonce,
} from "@/lib/solana/wallet-auth";

export const dynamic = "force-dynamic";

interface WithdrawBody {
  amount: number;
  destination_wallet: string;
  message: string;
  signature: string;
}

function isValidBody(body: unknown): body is WithdrawBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.amount === "number" &&
    b.amount > 0 &&
    typeof b.destination_wallet === "string" &&
    b.destination_wallet.length >= 32 &&
    typeof b.message === "string" &&
    typeof b.signature === "string"
  );
}

/**
 * POST /api/user-agents/[id]/withdraw
 *
 * Request a withdrawal of earned funds.
 * Requires wallet signature for ownership verification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!isValidBody(body)) {
    return badRequest(
      "amount (number > 0), destination_wallet, message, and signature are required"
    );
  }

  // Parse & validate message
  const parsed = parseWithdrawalMessage(body.message);
  if (!parsed) {
    return badRequest("Invalid withdrawal message format");
  }

  if (parsed.agentId !== id) {
    return badRequest("Agent ID in message does not match URL");
  }

  if (parsed.amount !== body.amount) {
    return badRequest("Amount in message does not match request body");
  }

  if (!isValidNonce(parsed.nonce)) {
    return badRequest("Nonce expired. Please sign a new message.");
  }

  const supabase = createAdminClient();

  // Fetch agent and verify ownership
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, tier, owner_wallet")
    .eq("id", id)
    .single();

  if (agentError || !agent) {
    return notFound("Agent not found");
  }

  if (agent.tier !== "user" || !agent.owner_wallet) {
    return forbidden("Only user-tier agents with an owner can withdraw");
  }

  // Verify signature against owner_wallet
  let publicKeyBytes: Uint8Array;
  try {
    const pubkey = new PublicKey(agent.owner_wallet as string);
    publicKeyBytes = pubkey.toBytes();
  } catch {
    return internalError("Invalid owner wallet address on record");
  }

  const signatureValid = verifyWalletSignature(
    body.message,
    body.signature,
    publicKeyBytes
  );

  if (!signatureValid) {
    return forbidden("Invalid wallet signature");
  }

  // Check available balance
  const { data: earningsRows } = await supabase
    .from("agent_earnings")
    .select("net_amount")
    .eq("agent_id", id);

  const totalEarnings = (earningsRows ?? []).reduce(
    (sum, row) => sum + Number(row.net_amount),
    0
  );

  const { data: withdrawalRows } = await supabase
    .from("agent_withdrawals")
    .select("amount, status")
    .eq("agent_id", id);

  let totalWithdrawn = 0;
  let pendingWithdrawals = 0;
  for (const row of withdrawalRows ?? []) {
    const amt = Number(row.amount);
    if (row.status === "completed") {
      totalWithdrawn += amt;
    } else if (row.status === "pending" || row.status === "processing") {
      pendingWithdrawals += amt;
    }
  }

  const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

  if (body.amount > availableBalance) {
    return badRequest(
      `Insufficient balance. Available: ${availableBalance.toFixed(6)}`
    );
  }

  // --- Daily withdrawal limit (max 1000 USDC per day) ---
  const DAILY_LIMIT = 1000;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentWithdrawals } = await supabase
    .from("agent_withdrawals")
    .select("amount, created_at")
    .eq("agent_id", id)
    .gte("created_at", oneDayAgo);

  const dailyTotal = (recentWithdrawals ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  if (dailyTotal + body.amount > DAILY_LIMIT) {
    return badRequest(
      `Daily withdrawal limit exceeded. Remaining today: ${(DAILY_LIMIT - dailyTotal).toFixed(6)} USDC`
    );
  }

  // --- Withdrawal cooldown (minimum 10 minutes between withdrawals) ---
  const COOLDOWN_MS = 10 * 60 * 1000;
  if (recentWithdrawals && recentWithdrawals.length > 0) {
    const latest = recentWithdrawals.reduce((a, b) =>
      new Date(a.created_at as string) > new Date(b.created_at as string)
        ? a
        : b
    );
    const elapsed =
      Date.now() - new Date(latest.created_at as string).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60_000);
      return badRequest(
        `Please wait ${waitMinutes} minute(s) before making another withdrawal.`
      );
    }
  }

  // Insert withdrawal (MVP: immediate completion)
  const { data: withdrawal, error: insertError } = await supabase
    .from("agent_withdrawals")
    .insert({
      agent_id: id,
      owner_wallet: agent.owner_wallet,
      destination_wallet: body.destination_wallet,
      amount: body.amount,
      status: "completed",
    })
    .select("id, amount, status, created_at")
    .single();

  if (insertError || !withdrawal) {
    console.error("Withdrawal insert error:", insertError);
    return internalError("Failed to create withdrawal");
  }

  return NextResponse.json({ success: true, withdrawal }, { status: 201 });
}
