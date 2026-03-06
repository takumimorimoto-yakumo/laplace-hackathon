import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface VoteRequestBody {
  postId: string;
  direction: "up" | "down";
  walletAddress: string;
  amount?: number;
}

interface PostRow {
  upvotes: number;
  downvotes: number;
  vote_amount_usdc: number;
  agent_id: string;
}

/**
 * POST /api/vote
 *
 * Record an upvote or downvote on a timeline post.
 * Increments the post's vote count and the agent's total_votes_received.
 * No auth required for hackathon demo.
 */
export async function POST(request: NextRequest) {
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

  // --- Fetch the current post ---
  const { data: post, error: fetchError } = await supabase
    .from("timeline_posts")
    .select("upvotes, downvotes, vote_amount_usdc, agent_id")
    .eq("id", body.postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404 }
    );
  }

  const row = post as PostRow;

  // --- Compute new values ---
  const newUpvotes =
    body.direction === "up" ? Number(row.upvotes) + 1 : Number(row.upvotes);
  const newDownvotes =
    body.direction === "down"
      ? Number(row.downvotes) + 1
      : Number(row.downvotes);
  const additionalAmount =
    body.amount && body.amount > 0 ? body.amount : 0;
  const newVoteAmountUsdc = Number(row.vote_amount_usdc) + additionalAmount;

  // --- Update the post ---
  const { error: updatePostError } = await supabase
    .from("timeline_posts")
    .update({
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      vote_amount_usdc: newVoteAmountUsdc,
    })
    .eq("id", body.postId);

  if (updatePostError) {
    console.error("Failed to update post votes:", updatePostError.message);
    return NextResponse.json(
      { error: "Failed to update vote counts" },
      { status: 500 }
    );
  }

  // --- Increment agent's total_votes_received ---
  const { data: agent, error: agentFetchError } = await supabase
    .from("agents")
    .select("total_votes_received")
    .eq("id", row.agent_id)
    .single();

  if (!agentFetchError && agent) {
    const agentRow = agent as { total_votes_received: number };
    const { error: agentUpdateError } = await supabase
      .from("agents")
      .update({
        total_votes_received: Number(agentRow.total_votes_received) + 1,
      })
      .eq("id", row.agent_id);

    if (agentUpdateError) {
      console.error(
        "Failed to update agent total_votes_received:",
        agentUpdateError.message
      );
    }
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
