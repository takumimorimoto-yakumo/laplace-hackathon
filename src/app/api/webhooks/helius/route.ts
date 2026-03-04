import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface HeliusTransaction {
  signature: string;
  type: string;
  accountData: Array<{
    account: string;
    nativeBalanceChange: number;
  }>;
  instructions: Array<{
    programId: string;
    data: string;
  }>;
}

interface HeliusWebhookPayload {
  type: string;
  data: HeliusTransaction[];
}

interface ParsedVoteInstruction {
  agentId: string;
  postId: string;
  amount: bigint;
  direction: number;
}

/**
 * Parse vote instruction data from the on-chain voting program.
 *
 * Expected layout (matches the format from voting.ts):
 * - discriminator: 8 bytes
 * - agentId: borsh string (4-byte length prefix + UTF-8 bytes)
 * - postId: borsh string (4-byte length prefix + UTF-8 bytes)
 * - amount: u64 (8 bytes, little-endian)
 * - direction: u8 (1 byte; 0 = up, 1 = down)
 */
function parseVoteInstruction(
  data: string
): ParsedVoteInstruction | null {
  try {
    const buf = Buffer.from(data, "base64");

    // Minimum size: 8 (discriminator) + 4 (agentId len) + 0 + 4 (postId len) + 0 + 8 (amount) + 1 (direction)
    if (buf.length < 25) return null;

    // Skip 8-byte discriminator
    let offset = 8;

    // Read agentId (borsh string: u32 length + UTF-8 bytes)
    const agentIdLen = buf.readUInt32LE(offset);
    offset += 4;
    if (offset + agentIdLen > buf.length) return null;
    const agentId = buf.subarray(offset, offset + agentIdLen).toString("utf-8");
    offset += agentIdLen;

    // Read postId (borsh string: u32 length + UTF-8 bytes)
    if (offset + 4 > buf.length) return null;
    const postIdLen = buf.readUInt32LE(offset);
    offset += 4;
    if (offset + postIdLen > buf.length) return null;
    const postId = buf.subarray(offset, offset + postIdLen).toString("utf-8");
    offset += postIdLen;

    // Read amount (u64 little-endian)
    if (offset + 8 > buf.length) return null;
    const amount = buf.readBigUInt64LE(offset);
    offset += 8;

    // Read direction (u8)
    if (offset + 1 > buf.length) return null;
    const direction = buf.readUInt8(offset);

    return { agentId, postId, amount, direction };
  } catch {
    return null;
  }
}

/**
 * POST /api/webhooks/helius
 *
 * Process on-chain vote transactions from the Helius webhook.
 * Parses vote instruction data, updates post vote counts, and increments
 * the agent's total_votes_received in Supabase.
 * Falls back to logging if the instruction cannot be parsed.
 */
export async function POST(request: NextRequest) {
  // Verify webhook auth
  const authHeader = request.headers.get("authorization");
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: HeliusWebhookPayload;
  try {
    payload = (await request.json()) as HeliusWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Process transactions (Helius may send array directly or wrapped in { data })
  const transactions = Array.isArray(payload)
    ? (payload as HeliusTransaction[])
    : (payload.data ?? []);
  let processed = 0;

  for (const tx of transactions) {
    try {
      // Check if any instruction matches our voting program
      const votingProgramId = process.env.VOTING_PROGRAM_ID;
      if (!votingProgramId) continue;

      const votingInstructions = (tx.instructions ?? []).filter(
        (ix) => ix.programId === votingProgramId
      );

      if (votingInstructions.length === 0) continue;

      for (const ix of votingInstructions) {
        const parsed = parseVoteInstruction(ix.data);

        if (parsed) {
          console.log(
            `Vote TX ${tx.signature}: postId=${parsed.postId}, ` +
              `direction=${parsed.direction === 0 ? "up" : "down"}, ` +
              `amount=${parsed.amount}`
          );

          // Update post vote counts
          const voteDirection = parsed.direction === 0 ? "up" : "down";
          await processVote(supabase, parsed.postId, voteDirection, Number(parsed.amount));
          processed++;
        } else {
          // Fallback: log the transaction for debugging
          console.log(
            `Vote TX detected but could not parse instruction data: ${tx.signature}`
          );
          processed++;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error processing TX ${tx.signature}: ${message}`);
    }
  }

  return NextResponse.json({ processed });
}

/**
 * Update the post's vote counts and the associated agent's total_votes_received.
 */
async function processVote(
  supabase: ReturnType<typeof createAdminClient>,
  postId: string,
  direction: "up" | "down",
  amount: number
): Promise<void> {
  // Fetch current post data
  const { data: post, error: fetchError } = await supabase
    .from("timeline_posts")
    .select("upvotes, downvotes, vote_amount_usdc, agent_id")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    console.error(`Post ${postId} not found for vote processing`);
    return;
  }

  const row = post as {
    upvotes: number;
    downvotes: number;
    vote_amount_usdc: number;
    agent_id: string;
  };

  // Update vote counts
  const newUpvotes =
    direction === "up" ? Number(row.upvotes) + 1 : Number(row.upvotes);
  const newDownvotes =
    direction === "down" ? Number(row.downvotes) + 1 : Number(row.downvotes);
  const newVoteAmountUsdc = Number(row.vote_amount_usdc) + amount;

  const { error: updatePostError } = await supabase
    .from("timeline_posts")
    .update({
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      vote_amount_usdc: newVoteAmountUsdc,
    })
    .eq("id", postId);

  if (updatePostError) {
    console.error(
      `Failed to update post ${postId} votes:`,
      updatePostError.message
    );
    return;
  }

  // Increment agent's total_votes_received
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
        `Failed to update agent ${row.agent_id} total_votes_received:`,
        agentUpdateError.message
      );
    }
  }
}
