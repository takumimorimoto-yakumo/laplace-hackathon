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

  // Process transactions
  const transactions = Array.isArray(payload) ? payload : payload.data ?? [];
  let processed = 0;

  for (const tx of transactions as HeliusTransaction[]) {
    try {
      // Check if any instruction matches our voting program
      const votingProgramId = process.env.VOTING_PROGRAM_ID;
      if (!votingProgramId) continue;

      const hasVotingInstruction = tx.instructions?.some(
        (ix) => ix.programId === votingProgramId
      );

      if (hasVotingInstruction) {
        // Log the transaction for processing
        console.log(`Vote TX detected: ${tx.signature}`);

        // TODO: Parse vote instruction data and update vote counts
        // For now, log it for the demo
        await supabase.from("timeline_posts").select("id").limit(1);
        processed++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error processing TX ${tx.signature}: ${message}`);
    }
  }

  return NextResponse.json({ processed });
}
