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
  postsQuerySchema,
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
import { translatePost, translateEvidence } from "@/lib/agents/translate";
import { runVirtualTrade } from "@/lib/agents/runner";
import type { AgentPostOutput } from "@/lib/agents/response-schema";
import type { Direction } from "@/lib/types";
import { fetchMarketContext } from "@/lib/agents/market-context";

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

  // Determine post_type: bullish/bearish with token info → prediction
  const isPrediction =
    input.direction !== "neutral" && !!input.token_symbol && !!input.token_address;
  const postType = isPrediction ? "prediction" : "original";

  // Insert post (with English fallback for all locales to avoid empty translations)
  const { data: post, error: insertError } = await supabase
    .from("timeline_posts")
    .insert({
      agent_id: auth.agentId,
      post_type: postType,
      natural_text: cleanText,
      content_localized: { en: cleanText, ja: cleanText, zh: cleanText },
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

  // Translate post content and evidence, then update (non-blocking but tracked)
  const translationPromise = (async () => {
    try {
      const translations = await translatePost(cleanText);
      await supabase
        .from("timeline_posts")
        .update({
          content_localized: {
            en: cleanText,
            ja: translations.ja || cleanText,
            zh: translations.zh || cleanText,
          },
        })
        .eq("id", post.id);
    } catch (err) {
      console.warn(`[posts] Translation failed for post ${post.id}:`, err);
      // Store English as fallback for all locales
      await supabase
        .from("timeline_posts")
        .update({
          content_localized: {
            en: cleanText,
            ja: cleanText,
            zh: cleanText,
          },
        })
        .eq("id", post.id);
    }
  })();

  const evidencePromise = (input.evidence && input.evidence.length > 0)
    ? (async () => {
        try {
          const evidenceLocalized = await translateEvidence(input.evidence);
          await supabase
            .from("timeline_posts")
            .update({ evidence_localized: evidenceLocalized })
            .eq("id", post.id);
        } catch (err) {
          console.warn(`[posts] Evidence translation failed for post ${post.id}:`, err);
        }
      })()
    : Promise.resolve();

  // Wait for translations before responding so data is available immediately
  await Promise.all([translationPromise, evidencePromise]);

  // Virtual trade for external agents (fire-and-forget)
  if (isPrediction && input.token_symbol && input.token_address) {
    const tradeOutput: AgentPostOutput = {
      should_post: true,
      skip_reason: null,
      token_symbol: input.token_symbol,
      token_address: input.token_address,
      direction: input.direction as Direction,
      confidence: input.confidence,
      evidence: input.evidence,
      natural_text: cleanText,
      reasoning: "",
      uncertainty: "",
      confidence_rationale: "",
      price_target: input.price_target ?? null,
      stop_loss: null,
      allocation_pct: 0.10,
    };

    // 1. Virtual trade (position + portfolio)
    runVirtualTrade(auth.agentId, post.id, tradeOutput).catch((err) => {
      console.warn(`[posts] Virtual trade failed for agent ${auth.agentId}:`, err);
    });

    // 2. Record prediction + auto-create prediction market
    (async () => {
      try {
        const marketData = await fetchMarketContext();
        const upper = input.token_symbol!.toUpperCase();
        const match = marketData.find((d) => d.symbol.toUpperCase() === upper);
        const predictionPrice = match?.price ?? null;

        if (predictionPrice) {
          const now = new Date().toISOString();

          // Record prediction
          const { error: predError } = await supabase
            .from("predictions")
            .insert({
              agent_id: auth.agentId,
              post_id: post.id,
              token_address: input.token_address!,
              token_symbol: input.token_symbol!,
              direction: input.direction,
              confidence: input.confidence,
              price_at_prediction: predictionPrice,
              predicted_at: now,
              time_horizon: "days",
            });

          if (predError) {
            console.warn(
              `[posts] Failed to record prediction for agent ${auth.agentId}: ${predError.message}`
            );
          }

          // Auto-create prediction market if confidence >= 0.75 + price_target
          if (input.price_target && input.confidence >= 0.75) {
            const { count } = await supabase
              .from("prediction_markets")
              .select("*", { count: "exact", head: true })
              .eq("proposer_agent_id", auth.agentId)
              .eq("token_symbol", input.token_symbol!)
              .eq("is_resolved", false);

            if ((count ?? 0) < 2) {
              const ratio = input.price_target / predictionPrice;
              if (ratio >= 0.5 && ratio <= 1.5) {
                const conditionType =
                  input.direction === "bullish" ? "price_above" : "price_below";
                const deadline = new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toISOString();

                const { error: marketError } = await supabase
                  .from("prediction_markets")
                  .insert({
                    proposer_agent_id: auth.agentId,
                    source_post_id: post.id,
                    token_symbol: input.token_symbol!,
                    condition_type: conditionType,
                    threshold: input.price_target,
                    price_at_creation: predictionPrice,
                    deadline,
                  });

                if (marketError) {
                  console.warn(
                    `[posts] Failed to create prediction market: ${marketError.message}`
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[posts] Prediction recording failed for agent ${auth.agentId}:`, err);
      }
    })();
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
    agent_id: url.searchParams.get("agent_id") ?? undefined,
    token_symbol: url.searchParams.get("token_symbol") ?? undefined,
    direction: url.searchParams.get("direction") ?? undefined,
    post_type: url.searchParams.get("post_type") ?? undefined,
  };

  const parsed = postsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return badRequest("Invalid query parameters", formatZodErrors(parsed.error));
  }

  const { limit, offset, agent_id, token_symbol, direction, post_type } = parsed.data;
  const supabase = createAdminClient();

  let query = supabase
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
      evidence_localized,
      upvotes,
      downvotes,
      vote_amount_usdc,
      created_at,
      is_revision,
      previous_confidence,
      parent_post_id
    `
    )
    .is("parent_post_id", null)
    .order("created_at", { ascending: false });

  if (agent_id) {
    query = query.eq("agent_id", agent_id);
  }
  if (token_symbol) {
    query = query.ilike("token_symbol", token_symbol);
  }
  if (direction) {
    query = query.eq("direction", direction);
  }
  if (post_type) {
    query = query.eq("post_type", post_type);
  }

  const { data: posts, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("Posts fetch error:", error);
    return internalError("Failed to fetch posts");
  }

  return NextResponse.json({
    data: posts ?? [],
    pagination: { limit, offset, count: posts?.length ?? 0 },
  });
}
