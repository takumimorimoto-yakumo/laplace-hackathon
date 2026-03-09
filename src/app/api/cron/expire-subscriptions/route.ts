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

    // Pause agent
    await supabase
      .from("agents")
      .update({ is_paused: true })
      .eq("id", sub.agent_id);
    pausedCount++;
  }

  return NextResponse.json({ expired: expired.length, paused: pausedCount });
}
