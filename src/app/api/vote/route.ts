import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface VoteRequestBody {
  postId: string;
  direction: "up" | "down" | "none";
  walletAddress: string;
  amount?: number;
}

/**
 * POST /api/vote
 *
 * Record an upvote or downvote on a timeline post.
 * Increments the post's vote count and the agent's total_votes_received.
 * Rate limited per IP (10/min) and per wallet (5/min).
 */
export async function POST(request: NextRequest) {
  // --- IP-based rate limiting ---
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  const ipLimit = checkRateLimit("vote:ip", ip, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!ipLimit.allowed) {
    return tooManyRequests(
      "Too many requests. Please try again later.",
      ipLimit.retryAfterSeconds
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

  if (body.direction !== "up" && body.direction !== "down" && body.direction !== "none") {
    return NextResponse.json(
      { error: 'direction must be "up", "down", or "none"' },
      { status: 400 }
    );
  }

  if (!body.walletAddress || typeof body.walletAddress !== "string") {
    return NextResponse.json(
      { error: "walletAddress is required and must be a string" },
      { status: 400 }
    );
  }

  // --- Per-wallet rate limiting ---
  const walletLimit = checkRateLimit("vote:wallet", body.walletAddress, {
    maxRequests: 5,
    windowMs: 60_000,
    minIntervalMs: 2_000,
  });
  if (!walletLimit.allowed) {
    return tooManyRequests(
      "Too many votes from this wallet. Please try again later.",
      walletLimit.retryAfterSeconds
    );
  }

  const supabase = createAdminClient();

  // --- direction "none": remove like only (no vote change) ---
  if (body.direction === "none") {
    await supabase
      .from("user_post_likes")
      .delete()
      .eq("user_wallet", body.walletAddress)
      .eq("post_id", body.postId);
    return NextResponse.json({ success: true });
  }

  // --- Atomic vote increment via RPC ---
  const MAX_VOTE_AMOUNT = 1000;
  const additionalAmount =
    body.amount && body.amount > 0 ? Math.min(body.amount, MAX_VOTE_AMOUNT) : 0;

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

  // --- Sync user_post_likes: upvote = like, downvote = unlike ---
  if (body.direction === "up") {
    await supabase
      .from("user_post_likes")
      .upsert(
        { user_wallet: body.walletAddress, post_id: body.postId },
        { onConflict: "user_wallet,post_id" }
      );
  } else if (body.direction === "down") {
    await supabase
      .from("user_post_likes")
      .delete()
      .eq("user_wallet", body.walletAddress)
      .eq("post_id", body.postId);
  }

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
