import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, getKeyPrefix, hashApiKey } from "@/lib/api/auth";
import {
  checkRateLimit,
  setRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/api/rate-limit";
import {
  agentRegistrationSchema,
  formatZodErrors,
} from "@/lib/api/validate";
import { badRequest, conflict, tooManyRequests, internalError } from "@/lib/api/errors";
import { logApiRequest, buildLogEntry, getClientIp } from "@/lib/api/logger";
import type { AgentRegistrationResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Layer 2: Rate limit by IP
  const rl = checkRateLimit("register", ip, RATE_LIMITS.register);
  if (!rl.allowed) {
    const res = tooManyRequests(
      "Registration rate limit exceeded. Try again later.",
      rl.retryAfterSeconds
    );
    setRateLimitHeaders(res.headers, rl);
    await logApiRequest(
      buildLogEntry(request, 429, { errorMessage: "Rate limit exceeded" })
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
      buildLogEntry(request, 400, { errorMessage: "Invalid JSON" })
    );
    return res;
  }

  // Layer 3: Validate with Zod
  const parsed = agentRegistrationSchema.safeParse(rawBody);
  if (!parsed.success) {
    const details = formatZodErrors(parsed.error);
    const res = badRequest("Validation failed", details);
    await logApiRequest(
      buildLogEntry(request, 400, { errorMessage: details.join("; ") })
    );
    return res;
  }

  const { name, style, bio, wallet_address } = parsed.data;
  const supabase = createAdminClient();

  // Layer 4: Check name uniqueness (case-insensitive)
  const { data: existingAgent } = await supabase
    .from("agents")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existingAgent) {
    const res = conflict(`Agent name "${name}" is already taken`);
    await logApiRequest(
      buildLogEntry(request, 409, {
        errorMessage: `Name conflict: ${name}`,
      })
    );
    return res;
  }

  // Create agent
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      name,
      style,
      bio,
      modules: [],
      personality: `External agent: ${name}`,
      outlook: "bullish",
      llm_model: "external",
      voice_style: "analytical",
      is_system: false,
      wallet_address: wallet_address ?? null,
    })
    .select("id")
    .single();

  if (agentError || !agent) {
    console.error("Agent creation error:", agentError);
    const res = internalError("Failed to create agent");
    await logApiRequest(
      buildLogEntry(request, 500, { errorMessage: agentError?.message })
    );
    return res;
  }

  // Generate and store API key
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);
  const keyPrefix = getKeyPrefix(apiKey);

  const { error: keyError } = await supabase.from("api_keys").insert({
    agent_id: agent.id,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: `${name} API Key`,
  });

  if (keyError) {
    console.error("API key creation error:", keyError);
    // Rollback: delete the agent
    await supabase.from("agents").delete().eq("id", agent.id);
    const res = internalError("Failed to generate API key");
    await logApiRequest(
      buildLogEntry(request, 500, { errorMessage: keyError.message })
    );
    return res;
  }

  // Layer 5: Log success
  await logApiRequest(
    buildLogEntry(request, 201, { agentId: agent.id })
  );

  const body: AgentRegistrationResponse = {
    agent_id: agent.id,
    api_key: apiKey,
    key_prefix: keyPrefix,
    name,
    wallet_address: wallet_address ?? undefined,
  };

  const res = NextResponse.json(body, { status: 201 });
  setRateLimitHeaders(res.headers, rl);
  return res;
}
