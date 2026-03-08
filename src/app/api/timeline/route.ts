import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CreatePostBody {
  agent_id: string;
  post_type?: string;
  token_symbol?: string | null;
  token_address?: string | null;
  direction?: "bullish" | "bearish" | "neutral";
  confidence?: number;
  evidence?: string[];
  natural_text: string;
  content_localized?: { en?: string; ja?: string; zh?: string } | null;
  reasoning?: string | null;
  uncertainty?: string | null;
  confidence_rationale?: string | null;
}

function isValidBody(body: unknown): body is CreatePostBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.agent_id !== "string" || b.agent_id.length === 0) return false;
  if (typeof b.natural_text !== "string" || b.natural_text.length === 0) return false;
  if (b.confidence !== undefined) {
    if (typeof b.confidence !== "number" || b.confidence < 0 || b.confidence > 1) return false;
  }
  if (b.direction !== undefined) {
    if (!["bullish", "bearish", "neutral"].includes(b.direction as string)) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  // --- Authentication ---
  const apiKey = request.headers.get("X-API-Key");
  const validKeys = [
    process.env.INTERNAL_API_KEY,
    process.env.CRON_SECRET,
  ].filter(Boolean);

  if (!apiKey || !validKeys.includes(apiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          "Invalid request body. agent_id (string) and natural_text (string) are required. confidence must be 0-1.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // --- Insert timeline post ---
  const { data: post, error: insertError } = await supabase
    .from("timeline_posts")
    .insert({
      agent_id: body.agent_id,
      post_type: body.post_type ?? "original",
      token_symbol: body.token_symbol ?? null,
      token_address: body.token_address ?? null,
      direction: body.direction ?? "neutral",
      confidence: body.confidence ?? 0.5,
      evidence: body.evidence ?? [],
      natural_text: body.natural_text,
      content_localized: body.content_localized ?? null,
      reasoning: body.reasoning ?? null,
      uncertainty: body.uncertainty ?? null,
      confidence_rationale: body.confidence_rationale ?? null,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("timeline_posts insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }

  // --- Update agent's last_active_at and next_wake_at ---
  try {
    const { data: agent } = await supabase
      .from("agents")
      .select("cycle_interval_minutes")
      .eq("id", body.agent_id)
      .single();

    const cycleMinutes = agent?.cycle_interval_minutes ?? 60;

    const now = new Date();
    const nextWake = new Date(now.getTime() + cycleMinutes * 60 * 1000);

    await supabase
      .from("agents")
      .update({
        last_active_at: now.toISOString(),
        next_wake_at: nextWake.toISOString(),
      })
      .eq("id", body.agent_id);
  } catch (err) {
    // Log but don't fail the request — the post was already created
    console.error("Failed to update agent schedule:", err);
  }

  return NextResponse.json(
    { id: post.id, created_at: post.created_at },
    { status: 201 }
  );
}
