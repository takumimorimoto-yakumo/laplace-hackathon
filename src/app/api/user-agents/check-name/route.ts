import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-agents/check-name?name=xxx
 *
 * Returns 200 if available, 409 if taken.
 * Rate limited to 10 checks per minute per IP.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const limit = checkRateLimit("check-name", ip, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return tooManyRequests(
      "Too many requests. Please try again later.",
      limit.retryAfterSeconds
    );
  }

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
