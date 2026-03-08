import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/set-owner
 *
 * Set owner_wallet on all system agents that don't have one yet.
 * Protected by CRON_SECRET bearer token.
 *
 * Body: { owner_wallet: string }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { owner_wallet?: string };
  try {
    body = (await request.json()) as { owner_wallet?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.owner_wallet || body.owner_wallet.length < 32) {
    return NextResponse.json({ error: "owner_wallet is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("agents")
    .update({ owner_wallet: body.owner_wallet })
    .eq("tier", "system")
    .is("owner_wallet", null)
    .select("id, name");

  if (error) {
    console.error("Failed to set owner:", error);
    return NextResponse.json(
      { error: "Failed to update", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    updated: data?.length ?? 0,
    agents: (data ?? []).map((a) => ({ id: a.id, name: a.name })),
  });
}
