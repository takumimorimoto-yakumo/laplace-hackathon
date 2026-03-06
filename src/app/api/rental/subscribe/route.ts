import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRentalPlan } from "@/lib/agent-stats";
import type { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Shape of the DB row returned by the agents table. */
interface DbAgentRow {
  id: string;
  name: string;
  style: string;
  modules: string[];
  llm: string;
  accuracy: number;
  leaderboard_rank: number;
  total_votes: number;
  performance_trend: string;
  portfolio_value: number;
  portfolio_return: number;
  bio: string;
  personality: string;
  outlook: string;
  voice_style: string;
  temperature: number;
  cycle_interval_minutes: number;
  is_system: boolean;
}

/** Shape of the request body for subscribing to a rental. */
interface SubscribeBody {
  agentId: string;
  walletAddress: string;
  paymentToken: "USDC" | "SKR";
  txSignature?: string;
}

/** Shape of an agent_rentals row returned after insert. */
interface RentalRow {
  id: string;
  user_wallet: string;
  agent_id: string;
  payment_token: string;
  payment_amount: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  tx_signature: string | null;
  created_at: string;
}

/** Validate the incoming request body. */
function isValidBody(body: unknown): body is SubscribeBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.agentId !== "string" || b.agentId.length === 0) return false;
  if (typeof b.walletAddress !== "string" || b.walletAddress.length === 0) return false;
  if (b.paymentToken !== "USDC" && b.paymentToken !== "SKR") return false;
  if (b.txSignature !== undefined && typeof b.txSignature !== "string") return false;
  return true;
}

/** Map a DB agent row to the Agent type needed by computeRentalPlan. */
function dbRowToAgent(row: DbAgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    style: row.style as Agent["style"],
    modules: row.modules as Agent["modules"],
    llm: row.llm as Agent["llm"],
    accuracy: row.accuracy,
    rank: row.leaderboard_rank,
    totalVotes: row.total_votes,
    trend: row.performance_trend as Agent["trend"],
    portfolioValue: row.portfolio_value,
    portfolioReturn: row.portfolio_return,
    bio: row.bio,
    personality: row.personality,
    outlook: (row.outlook ?? "bullish") as Agent["outlook"],
    voiceStyle: row.voice_style as Agent["voiceStyle"],
    temperature: row.temperature,
    cycleIntervalMinutes: row.cycle_interval_minutes,
    isSystem: row.is_system,
    totalVotesGiven: 0,
    followerCount: 0,
    followingCount: 0,
    replyCount: 0,
  };
}

/**
 * POST /api/rental/subscribe
 *
 * Subscribe to an agent's rental plan. Creates a 30-day rental record.
 *
 * Body:
 * - agentId: string (required)
 * - walletAddress: string (required)
 * - paymentToken: "USDC" | "SKR" (required)
 * - txSignature?: string (optional on-chain transaction signature)
 *
 * Returns the created rental record on success.
 */
export async function POST(request: NextRequest) {
  // --- Parse & validate body ---
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
          "Invalid request body. agentId (string), walletAddress (string), and paymentToken ('USDC' | 'SKR') are required.",
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // --- Verify agent exists ---
  const { data: agentRow, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", body.agentId)
    .single();

  if (agentError || !agentRow) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = dbRowToAgent(agentRow as DbAgentRow);

  // --- Compute pricing ---
  const plan = computeRentalPlan(agent);
  const paymentAmount =
    body.paymentToken === "SKR"
      ? plan.monthlyPriceUsdc * (1 - plan.skrDiscountPercent / 100)
      : plan.monthlyPriceUsdc;

  // --- Check for existing active rental ---
  const { data: existingRentals, error: existingError } = await supabase
    .from("agent_rentals")
    .select("id, expires_at, is_active")
    .eq("user_wallet", body.walletAddress)
    .eq("agent_id", body.agentId)
    .eq("is_active", true)
    .order("expires_at", { ascending: false })
    .limit(1);

  if (existingError) {
    console.error("Failed to check existing rentals:", existingError);
    return NextResponse.json(
      { error: "Failed to check existing rentals" },
      { status: 500 },
    );
  }

  if (existingRentals && existingRentals.length > 0) {
    const existing = existingRentals[0];
    const expiresAt = new Date(existing.expires_at as string);

    if (expiresAt > new Date()) {
      // Still active — reject duplicate subscription
      return NextResponse.json(
        { error: "Already subscribed to this agent" },
        { status: 409 },
      );
    }

    // Expired — deactivate old rental
    await supabase
      .from("agent_rentals")
      .update({ is_active: false })
      .eq("id", existing.id as string);
  }

  // --- Insert new rental ---
  const { data: rental, error: insertError } = await supabase
    .from("agent_rentals")
    .insert({
      user_wallet: body.walletAddress,
      agent_id: body.agentId,
      payment_token: body.paymentToken,
      payment_amount: paymentAmount,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tx_signature: body.txSignature ?? null,
    })
    .select("*")
    .single();

  if (insertError || !rental) {
    console.error("agent_rentals insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to create rental subscription" },
      { status: 500 },
    );
  }

  const row = rental as RentalRow;

  return NextResponse.json(
    {
      success: true,
      rental: {
        id: row.id,
        agentId: row.agent_id,
        walletAddress: row.user_wallet,
        paymentToken: row.payment_token,
        paymentAmount: row.payment_amount,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        txSignature: row.tx_signature,
      },
    },
    { status: 201 },
  );
}
