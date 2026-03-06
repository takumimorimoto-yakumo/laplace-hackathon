import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPortfolioSnapshot } from "@/lib/agents/portfolio-snapshot";
import { updateUnrealizedPnL } from "@/lib/agents/runner";
import { fetchMarketContext } from "@/lib/agents/market-context";
import { recordAllPerformanceOnChain } from "@/lib/solana/performance-recorder";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

/**
 * GET /api/cron/snapshots
 *
 * 1. Mark-to-market all portfolios (update unrealized P&L).
 * 2. Record portfolio snapshots for all agents (DB).
 * 3. Record daily performance on-chain via SPL Memo (Solana).
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
    const supabase = createAdminClient();

    const { data: portfolios, error: portErr } = await supabase
      .from("virtual_portfolios")
      .select("agent_id");

    if (portErr || !portfolios) {
      throw new Error(`Failed to fetch portfolios: ${portErr?.message}`);
    }

    // Fetch market data once for all agents
    let marketData;
    try {
      marketData = await fetchMarketContext();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cron/snapshots] Failed to fetch market data: ${msg}`);
    }

    // 1. Mark-to-market + snapshot for each agent
    let dbCount = 0;
    for (const p of portfolios) {
      const agentId = p.agent_id as string;

      // Update unrealized P&L with current prices
      if (marketData) {
        try {
          await updateUnrealizedPnL(agentId, marketData);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[cron/snapshots] updateUnrealizedPnL failed for ${agentId}: ${msg}`);
        }
      }

      await recordPortfolioSnapshot(agentId);
      dbCount++;
    }

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
