import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgent } from "@/lib/supabase/queries";
import { chatCompletion } from "@/lib/agents/llm-client";
import { buildChatSystemPrompt } from "@/lib/agents/prompt-builder";
import type { ChatMessage } from "@/lib/agents/llm-client";

export const dynamic = "force-dynamic";

/** Max messages per hour per agent-user pair. */
const RATE_LIMIT_PER_HOUR = 20;

/** Shape of the POST request body. */
interface SendChatBody {
  agentId: string;
  userWallet: string;
  message: string;
}

/** Shape of a single message stored in the JSONB array. */
interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** Validate the incoming POST body. */
function isValidBody(body: unknown): body is SendChatBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.agentId !== "string" || b.agentId.length === 0) return false;
  if (typeof b.userWallet !== "string" || b.userWallet.length === 0) return false;
  if (typeof b.message !== "string" || b.message.trim().length === 0) return false;
  return true;
}

/**
 * GET /api/chat/send?agentId=xxx&wallet=yyy
 *
 * Returns existing chat messages for the given agent-user pair.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const wallet = searchParams.get("wallet");

  if (!agentId || !wallet) {
    return NextResponse.json(
      { error: "agentId and wallet query parameters are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("agent_chats")
    .select("messages")
    .eq("agent_id", agentId)
    .eq("user_wallet", wallet)
    .single();

  if (error) {
    // No chat found is not an error — return empty messages
    if (error.code === "PGRST116") {
      return NextResponse.json({ messages: [] });
    }
    console.error("Failed to fetch chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 },
    );
  }

  return NextResponse.json({ messages: data.messages as StoredMessage[] });
}

/**
 * POST /api/chat/send
 *
 * Send a message to an agent in a private chat. The agent will respond via LLM.
 *
 * Body:
 * - agentId: string (required)
 * - userWallet: string (required)
 * - message: string (required)
 *
 * Returns the assistant's response message.
 */
export async function POST(request: NextRequest) {
  // --- Parse & validate body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. agentId (string), userWallet (string), and message (string) are required.",
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // --- Check rental status ---
  const { data: rentalData, error: rentalError } = await supabase
    .from("agent_rentals")
    .select("id, expires_at, is_active")
    .eq("user_wallet", body.userWallet)
    .eq("agent_id", body.agentId)
    .eq("is_active", true)
    .gte("expires_at", new Date().toISOString())
    .limit(1);

  if (rentalError) {
    console.error("Failed to check rental:", rentalError);
    return NextResponse.json(
      { error: "Failed to verify rental status" },
      { status: 500 },
    );
  }

  if (!rentalData || rentalData.length === 0) {
    return NextResponse.json(
      { error: "You must rent this agent to chat" },
      { status: 403 },
    );
  }

  // --- Rate limiting ---
  const hourBucket = new Date();
  hourBucket.setMinutes(0, 0, 0);
  const hourBucketIso = hourBucket.toISOString();

  const { data: rateData, error: rateError } = await supabase
    .from("chat_rate_limits")
    .select("id, message_count")
    .eq("agent_id", body.agentId)
    .eq("user_wallet", body.userWallet)
    .eq("hour_bucket", hourBucketIso)
    .single();

  if (rateError && rateError.code !== "PGRST116") {
    console.error("Rate limit check failed:", rateError);
    return NextResponse.json(
      { error: "Rate limit check failed" },
      { status: 500 },
    );
  }

  const currentCount = (rateData?.message_count as number) ?? 0;

  if (currentCount >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 messages per hour." },
      { status: 429 },
    );
  }

  // --- Fetch agent ---
  const agent = await fetchAgent(body.agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // --- Get or create chat row ---
  const { data: existingChat } = await supabase
    .from("agent_chats")
    .select("id, messages")
    .eq("agent_id", body.agentId)
    .eq("user_wallet", body.userWallet)
    .single();

  const existingMessages: StoredMessage[] =
    (existingChat?.messages as StoredMessage[]) ?? [];

  // --- Build LLM messages ---
  const systemPrompt = buildChatSystemPrompt(agent);

  // Include recent chat history (last 20 messages for context window management)
  const recentHistory = existingMessages.slice(-20);
  const llmMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.message.trim() },
  ];

  // --- Call LLM ---
  let assistantResponse: string;
  try {
    assistantResponse = await chatCompletion(llmMessages, {
      llmModel: agent.llm,
      temperature: agent.temperature,
      maxTokens: 512,
    });
  } catch (err) {
    console.error("LLM chat error:", err);
    return NextResponse.json(
      { error: "Failed to get agent response" },
      { status: 500 },
    );
  }

  // --- Build new messages to append ---
  const now = new Date().toISOString();
  const userMsg: StoredMessage = {
    role: "user",
    content: body.message.trim(),
    timestamp: now,
  };
  const assistantMsg: StoredMessage = {
    role: "assistant",
    content: assistantResponse,
    timestamp: now,
  };

  const updatedMessages = [...existingMessages, userMsg, assistantMsg];

  // --- Upsert chat row ---
  if (existingChat) {
    const { error: updateError } = await supabase
      .from("agent_chats")
      .update({
        messages: updatedMessages,
        message_count: updatedMessages.length,
        updated_at: now,
      })
      .eq("id", existingChat.id as string);

    if (updateError) {
      console.error("Failed to update chat:", updateError);
      return NextResponse.json(
        { error: "Failed to save chat" },
        { status: 500 },
      );
    }
  } else {
    const { error: insertError } = await supabase
      .from("agent_chats")
      .insert({
        agent_id: body.agentId,
        user_wallet: body.userWallet,
        messages: updatedMessages,
        message_count: updatedMessages.length,
        updated_at: now,
      });

    if (insertError) {
      console.error("Failed to create chat:", insertError);
      return NextResponse.json(
        { error: "Failed to save chat" },
        { status: 500 },
      );
    }
  }

  // --- Update rate limit ---
  if (rateData) {
    await supabase
      .from("chat_rate_limits")
      .update({ message_count: currentCount + 1 })
      .eq("id", rateData.id as string);
  } else {
    await supabase.from("chat_rate_limits").insert({
      agent_id: body.agentId,
      user_wallet: body.userWallet,
      hour_bucket: hourBucketIso,
      message_count: 1,
    });
  }

  return NextResponse.json({
    message: assistantMsg,
  });
}
