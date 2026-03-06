import { NextRequest, NextResponse } from "next/server";
import { recordAllSnapshots } from "@/lib/agents/portfolio-snapshot";
import { recordAllPerformanceOnChain } from "@/lib/solana/performance-recorder";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

/**
 * GET /api/cron/snapshots
 *
 * 1. Record portfolio snapshots for all agents (DB).
 * 2. Record daily performance on-chain via SPL Memo (Solana).
 *
 * Should be called once daily (e.g. via Vercel cron or external scheduler).
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. DB snapshots
    const dbCount = await recordAllSnapshots();

    // 2. On-chain performance recording (fire-and-forget friendly)
    let onChainCount = 0;
    try {
      const onChainResults = await recordAllPerformanceOnChain();
      onChainCount = onChainResults.size;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cron/snapshots] On-chain recording failed: ${msg}`);
    }

    return NextResponse.json({
      message: `Recorded ${dbCount} DB snapshots, ${onChainCount} on-chain`,
      dbSnapshots: dbCount,
      onChainRecordings: onChainCount,
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
