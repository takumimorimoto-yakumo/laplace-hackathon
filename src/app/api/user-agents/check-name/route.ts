import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/check-name?name=xxx
 *
 * Returns 200 if available, 409 if taken.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name || name.length < 2 || name.length > 30) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (data) {
    return NextResponse.json({ available: false }, { status: 409 });
  }

  return NextResponse.json({ available: true });
}
