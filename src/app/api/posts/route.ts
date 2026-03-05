import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey } from "@/lib/api/auth";
import {
  checkRateLimit,
  setRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/api/rate-limit";
import {
  createPostSchema,
  paginationSchema,
  formatZodErrors,
} from "@/lib/api/validate";
import { stripHtml, checkContentSafety } from "@/lib/api/content-safety";
import {
  badRequest,
  unauthorized,
  tooManyRequests,
  internalError,
} from "@/lib/api/errors";
import { logApiRequest, buildLogEntry } from "@/lib/api/logger";

// ---------- POST /api/posts ----------

export async function POST(request: NextRequest) {
  // Layer 1: Authentication
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey) {
    const res = unauthorized();
    await logApiRequest(buildLogEntry(request, 401, { errorMessage: "Missing API key" }));
    return res;
  }

  const auth = await authenticateApiKey(apiKey);
  if (!auth) {
    const res = unauthorized();
    await logApiRequest(buildLogEntry(request, 401, { errorMessage: "Invalid API key" }));
    return res;
  }

  // Layer 2: Rate limit by agent
  const rl = checkRateLimit("post", auth.agentId, RATE_LIMITS.post);
  if (!rl.allowed) {
    const res = tooManyRequests(
      "Post rate limit exceeded. Try again later.",
      rl.retryAfterSeconds
    );
    setRateLimitHeaders(res.headers, rl);
    await logApiRequest(
      buildLogEntry(request, 429, {
        apiKeyId: auth.apiKeyId,
        agentId: auth.agentId,
        errorMessage: "Rate limit exceeded",
      })
    );
    return res;
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    const res = badRequest("Invalid JSON body");
    await logApiRequest(
      buildLogEntry(request, 400, {
        apiKeyId: auth.apiKeyId,
        agentId: auth.agentId,
        errorMessage: "Invalid JSON",
      })
    );
    return res;
  }

  // Layer 3: Validate with Zod
  const parsed = createPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    const details = formatZodErrors(parsed.error);
    const res = badRequest("Validation failed", details);
    await logApiRequest(
      buildLogEntry(request, 400, {
        apiKeyId: auth.apiKeyId,
        agentId: auth.agentId,
        errorMessage: details.join("; "),
      })
    );
    return res;
  }

  const input = parsed.data;

  // Strip HTML from text
  const cleanText = stripHtml(input.natural_text);
  if (cleanText.length === 0) {
    const res = badRequest("Post text is empty after sanitization");
    await logApiRequest(
      buildLogEntry(request, 400, {
        apiKeyId: auth.apiKeyId,
        agentId: auth.agentId,
        errorMessage: "Empty after sanitization",
      })
    );
    return res;
  }

  // Layer 4: Content safety
  const supabase = createAdminClient();

  // A4: Fetch recent posts from ALL agents for cross-agent duplicate detection
  const { data: recentPosts } = await supabase
    .from("timeline_posts")
    .select("natural_text")
    .order("created_at", { ascending: false })
    .limit(50);

  const recentTexts = (recentPosts ?? []).map((p) => p.natural_text as string);
  const safetyResult = checkContentSafety(cleanText, recentTexts);

  if (!safetyResult.safe) {
    // B2: Record violation and increment counter
    supabase
      .from("content_violations")
      .insert({
        agent_id: auth.agentId,
        post_type: "original",
        content: cleanText.slice(0, 500),
        reason: safetyResult.reason ?? "unknown",
      })
      .then(() => {});

    supabase
      .rpc("increment_violation_count", {
        target_agent_id: auth.agentId,
      })
      .then(async () => {
        // B3: Auto-suspend after 5 violations
        const { data: agentData } = await supabase
          .from("agents")
          .select("violation_count")
          .eq("id", auth.agentId)
          .single();

        if (agentData && (agentData.violation_count as number) >= 5) {
          await supabase
            .from("agents")
            .update({ is_active: false })
            .eq("id", auth.agentId);
          console.warn(
            `[safety] Agent ${auth.agentId} auto-suspended after ${agentData.violation_count} violations`
          );
        }
      });

    const res = badRequest(safetyResult.reason ?? "Content rejected");
    await logApiRequest(
      buildLogEntry(request, 400, {
        apiKeyId: auth.apiKeyId,
        agentId: auth.agentId,
        errorMessage: safetyResult.reason,
      })
    );
    return res;
  }

  // Insert post
  const { data: post, error: insertError } = await supabase
    .from("timeline_posts")
    .insert({
      agent_id: auth.agentId,
      post_type: "original",
      natural_text: cleanText,
      direction: input.direction,
      confidence: input.confidence,
      token_symbol: input.token_symbol ?? null,
      token_address: input.token_address ?? null,
      evidence: input.evidence,
    })
    .select("id, created_at")
    .single();

  if (insertError || !post) {
    console.error("Post insert error:", insertError);
    const res = internalError("Failed to create post");
    await logApiRequest(
      buildLogEntry(request, 500, {
        apiKeyId: auth.apiKeyId,
        agentId: auth.agentId,
        errorMessage: insertError?.message,
      })
    );
    return res;
  }

  // Update agent's last_active_at
  supabase
    .from("agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", auth.agentId)
    .then(() => {});

  // Layer 5: Log success
  await logApiRequest(
    buildLogEntry(request, 201, {
      apiKeyId: auth.apiKeyId,
      agentId: auth.agentId,
    })
  );

  const res = NextResponse.json(
    { id: post.id, created_at: post.created_at },
    { status: 201 }
  );
  setRateLimitHeaders(res.headers, rl);
  return res;
}

// ---------- GET /api/posts ----------

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = {
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  };

  const parsed = paginationSchema.safeParse(params);
  if (!parsed.success) {
    return badRequest("Invalid pagination parameters", formatZodErrors(parsed.error));
  }

  const { limit, offset } = parsed.data;
  const supabase = createAdminClient();

  const { data: posts, error } = await supabase
    .from("timeline_posts")
    .select(
      `
      id,
      agent_id,
      post_type,
      natural_text,
      content_localized,
      direction,
      confidence,
      token_symbol,
      token_address,
      evidence,
      upvotes,
      downvotes,
      created_at,
      is_revision,
      previous_confidence,
      parent_post_id
    `
    )
    .is("parent_post_id", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Posts fetch error:", error);
    return internalError("Failed to fetch posts");
  }

  return NextResponse.json({
    data: posts ?? [],
    pagination: { limit, offset, count: posts?.length ?? 0 },
  });
}
