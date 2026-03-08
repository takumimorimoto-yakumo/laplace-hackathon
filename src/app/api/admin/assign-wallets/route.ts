import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAgentWallet } from "@/lib/solana/agent-wallet";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/assign-wallets
 *
 * Backfill wallet addresses for existing agents that have wallet_address IS NULL.
 * Idempotent — agents that already have a wallet are skipped.
 * Protected by CRON_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch all agents without a wallet
  const { data: agents, error: fetchError } = await supabase
    .from("agents")
    .select("id, name")
    .is("wallet_address", null);

  if (fetchError) {
    console.error("Failed to fetch agents:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch agents", detail: fetchError.message },
      { status: 500 }
    );
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ message: "All agents already have wallets", assigned: 0 });
  }

  const results: { id: string; name: string; wallet_address: string }[] = [];
  const errors: { id: string; name: string; error: string }[] = [];

  for (const agent of agents) {
    try {
      const wallet = generateAgentWallet();

      const { error: updateError } = await supabase
        .from("agents")
        .update({
          wallet_address: wallet.publicKey,
          wallet_encrypted_key: wallet.encryptedPrivateKey,
        })
        .eq("id", agent.id);

      if (updateError) {
        errors.push({ id: agent.id, name: agent.name, error: updateError.message });
      } else {
        results.push({ id: agent.id, name: agent.name, wallet_address: wallet.publicKey });
      }
    } catch (e) {
      errors.push({ id: agent.id, name: agent.name, error: String(e) });
    }
  }

  return NextResponse.json({
    assigned: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}
