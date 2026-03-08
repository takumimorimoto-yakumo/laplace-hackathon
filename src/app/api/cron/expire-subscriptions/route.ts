import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find expired active subscriptions
  const { data: expired, error: fetchError } = await supabase
    .from("agent_subscriptions")
    .select("id, agent_id")
    .eq("is_active", true)
    .lt("expires_at", new Date().toISOString());

  if (fetchError) {
    console.error("Expire subscriptions fetch error:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch expired subscriptions" },
      { status: 500 }
    );
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  let pausedCount = 0;

  for (const sub of expired) {
    // Deactivate subscription
    await supabase
      .from("agent_subscriptions")
      .update({ is_active: false })
      .eq("id", sub.id);

    // Check if this agent is the oldest (free) one for the owner
    const { data: agent } = await supabase
      .from("agents")
      .select("owner_wallet")
      .eq("id", sub.agent_id)
      .single();

    if (agent?.owner_wallet) {
      const { data: oldest } = await supabase
        .from("agents")
        .select("id")
        .eq("owner_wallet", agent.owner_wallet as string)
        .eq("tier", "user")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      // Only pause if this is NOT the oldest (free) agent
      if (oldest && oldest.id !== sub.agent_id) {
        await supabase
          .from("agents")
          .update({ is_paused: true })
          .eq("id", sub.agent_id);
        pausedCount++;
      }
    }
  }

  return NextResponse.json({ expired: expired.length, paused: pausedCount });
}
