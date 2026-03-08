import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------- Simple in-memory rate limiter ----------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 votes per minute per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

interface VoteRequestBody {
  postId: string;
  direction: "up" | "down";
  walletAddress: string;
  amount?: number;
}


/**
 * POST /api/vote
 *
 * Record an upvote or downvote on a timeline post.
 * Increments the post's vote count and the agent's total_votes_received.
 * Rate limited to 10 votes/minute per IP.
 */
export async function POST(request: NextRequest) {
  // --- Rate limiting ---
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: VoteRequestBody;
  try {
    body = (await request.json()) as VoteRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // --- Validate required fields ---
  if (!body.postId || typeof body.postId !== "string") {
    return NextResponse.json(
      { error: "postId is required and must be a string" },
      { status: 400 }
    );
  }

  if (body.direction !== "up" && body.direction !== "down") {
    return NextResponse.json(
      { error: 'direction must be "up" or "down"' },
      { status: 400 }
    );
  }

  if (!body.walletAddress || typeof body.walletAddress !== "string") {
    return NextResponse.json(
      { error: "walletAddress is required and must be a string" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // --- Atomic vote increment via RPC ---
  const additionalAmount =
    body.amount && body.amount > 0 ? body.amount : 0;

  const { data: result, error: voteError } = await supabase.rpc(
    "increment_vote",
    {
      p_post_id: body.postId,
      p_direction: body.direction,
      p_amount: additionalAmount,
    }
  );

  if (voteError) {
    console.error("Failed to increment vote:", voteError.message);
    return NextResponse.json(
      { error: "Failed to update vote counts" },
      { status: 500 }
    );
  }

  const voteResult = Array.isArray(result) ? result[0] : result;
  if (!voteResult) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const newUpvotes = Number(voteResult.new_upvotes ?? 0);
  const newDownvotes = Number(voteResult.new_downvotes ?? 0);

  // --- Best-effort on-chain recording ---
  try {
    const { recordVoteOnChain } = await import("@/lib/solana/vote-recorder");
    await recordVoteOnChain({
      postId: body.postId,
      voterWallet: body.walletAddress,
      direction: body.direction,
    });
  } catch (err) {
    console.warn("On-chain vote recording failed:", err);
  }

  return NextResponse.json({
    success: true,
    upvotes: newUpvotes,
    downvotes: newDownvotes,
  });
}
