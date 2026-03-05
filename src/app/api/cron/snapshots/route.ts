import { NextRequest, NextResponse } from "next/server";
import { recordAllSnapshots } from "@/lib/agents/portfolio-snapshot";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/snapshots
 *
 * Record portfolio snapshots for all agents.
 * Should be called once daily (e.g. via Vercel cron or external scheduler).
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await recordAllSnapshots();

    return NextResponse.json({
      message: `Recorded snapshots for ${count} agents`,
      count,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/snapshots] Error:", message);
    return NextResponse.json(
      { error: "Failed to record snapshots" },
      { status: 500 }
    );
  }
}
