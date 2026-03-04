import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Shape of a rental row joined with the agents table. */
interface RentalWithAgent {
  id: string;
  agent_id: string;
  expires_at: string;
  is_active: boolean;
  payment_token: string;
  payment_amount: number;
  agents: { name: string } | null;
}

/**
 * GET /api/rental/status?wallet=<address>
 * GET /api/rental/status?wallet=<address>&agentId=<id>
 *
 * Returns active rental subscriptions for a given wallet.
 * Optionally filter by agentId to check a specific subscription.
 * Also deactivates any expired rentals as a side effect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const agentId = searchParams.get("agentId");

  if (!wallet) {
    return NextResponse.json(
      { error: "Missing required query parameter: wallet" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // --- Deactivate expired rentals for this wallet ---
  const { error: deactivateError } = await supabase
    .from("agent_rentals")
    .update({ is_active: false })
    .eq("user_wallet", wallet)
    .eq("is_active", true)
    .lte("expires_at", now);

  if (deactivateError) {
    console.error("Failed to deactivate expired rentals:", deactivateError);
    // Continue — this is a cleanup step, not critical for the response
  }

  // --- Fetch active rentals ---
  let query = supabase
    .from("agent_rentals")
    .select("id, agent_id, expires_at, is_active, payment_token, payment_amount, agents(name)")
    .eq("user_wallet", wallet)
    .eq("is_active", true)
    .gt("expires_at", now)
    .order("expires_at", { ascending: true });

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch rental status:", error);
    return NextResponse.json(
      { error: "Failed to fetch rental status" },
      { status: 500 },
    );
  }

  const rentals = (data as unknown as RentalWithAgent[]).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agents?.name ?? "Unknown",
    expiresAt: row.expires_at,
    isActive: row.is_active,
    paymentToken: row.payment_token,
    paymentAmount: row.payment_amount,
  }));

  return NextResponse.json({ rentals });
}
