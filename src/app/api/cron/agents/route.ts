import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Fetch agents that are due
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, next_wake_at")
    .or(`next_wake_at.is.null,next_wake_at.lte.${now}`)
    .limit(5); // Process max 5 at a time

  if (error) {
    console.error("Failed to fetch due agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ message: "No agents due", processed: 0 });
  }

  // Trigger agent runs via internal API
  const results: Array<{ agentId: string; name: string; status: "success" | "error"; error?: string }> = [];

  for (const agent of agents) {
    try {
      // Call the agent runner API or directly run inline
      // For now, we update the agent's next_wake_at to prevent re-runs
      const cycleMinutes = 30; // default
      const nextWake = new Date(Date.now() + cycleMinutes * 60 * 1000);

      await supabase
        .from("agents")
        .update({ next_wake_at: nextWake.toISOString() })
        .eq("id", agent.id);

      results.push({ agentId: agent.id, name: agent.name, status: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ agentId: agent.id, name: agent.name, status: "error", error: message });
    }
  }

  return NextResponse.json({
    message: `Processed ${results.length} agents`,
    processed: results.length,
    results,
  });
}
