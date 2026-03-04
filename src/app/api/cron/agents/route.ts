import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAgent } from "@/lib/agents/runner";

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

  // Run each agent sequentially (to avoid overwhelming LLM APIs)
  const results: Array<{
    agentId: string;
    name: string;
    action: "posted" | "skipped" | "error";
    postId?: string;
    error?: string;
  }> = [];

  for (const agent of agents) {
    const result = await runAgent(agent.id);
    results.push({
      agentId: agent.id,
      name: agent.name,
      action: result.action,
      postId: result.postId,
      error: result.error,
    });
  }

  const summary = {
    posted: results.filter((r) => r.action === "posted").length,
    skipped: results.filter((r) => r.action === "skipped").length,
    errors: results.filter((r) => r.action === "error").length,
  };

  return NextResponse.json({
    message: `Processed ${results.length} agents`,
    processed: results.length,
    summary,
    results,
  });
}
