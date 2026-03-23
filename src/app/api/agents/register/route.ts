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
import { generateAgentWallet } from "@/lib/solana/agent-wallet";
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

  const { name, style, bio, wallet_address, owner_wallet } = parsed.data;
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
  // Only include columns from the base schema + widely-deployed migrations.
  // Optional columns (outlook, wallet_address) use DB defaults when omitted,
  // keeping the insert safe even if later migrations haven't been applied.
  const insertRow: Record<string, unknown> = {
    name,
    style,
    bio,
    outlook: "neutral", // Always start neutral — outlook evolves from prediction performance
    modules: [],
    personality: `External agent: ${name}`,
    llm_model: "external",
    voice_style: "analytical",
    is_system: false,
    tier: "external",
  };
  if (owner_wallet) {
    insertRow.owner_wallet = owner_wallet;
  }
  if (wallet_address) {
    // Client provided their own wallet address (externally managed key)
    insertRow.wallet_address = wallet_address;
  } else {
    // Auto-generate a Solana wallet for the agent
    try {
      const wallet = generateAgentWallet();
      insertRow.wallet_address = wallet.publicKey;
      insertRow.wallet_encrypted_key = wallet.encryptedPrivateKey;
    } catch (e) {
      console.error("Agent wallet generation failed:", e);
      const res = internalError("Failed to generate agent wallet. Check AGENT_KEY_ENCRYPTION_SECRET.");
      await logApiRequest(
        buildLogEntry(request, 500, { errorMessage: String(e) })
      );
      return res;
    }
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert(insertRow)
    .select("id")
    .single();

  if (agentError || !agent) {
    console.error("Agent creation error:", agentError);
    const detail = agentError?.message ?? "Unknown database error";
    const res = internalError(`Failed to create agent: ${detail}`);
    await logApiRequest(
      buildLogEntry(request, 500, { errorMessage: agentError?.message })
    );
    return res;
  }

  // Create virtual portfolio (zero-start)
  const { error: portfolioError } = await supabase
    .from("virtual_portfolios")
    .insert({
      agent_id: agent.id,
      initial_balance: 10000,
      cash_balance: 10000,
      total_value: 10000,
      total_pnl: 0,
      total_pnl_pct: 0,
    });

  if (portfolioError) {
    console.error("Virtual portfolio creation error:", portfolioError);
    // Rollback: delete the agent
    await supabase.from("agents").delete().eq("id", agent.id);
    const detail = portfolioError.message ?? "Unknown database error";
    const res = internalError(`Failed to create virtual portfolio: ${detail}`);
    await logApiRequest(
      buildLogEntry(request, 500, { errorMessage: portfolioError.message })
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
    const detail = keyError.message ?? "Unknown database error";
    const res = internalError(`Failed to generate API key: ${detail}`);
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
    wallet_address: (insertRow.wallet_address as string) ?? undefined,
    owner_wallet: (insertRow.owner_wallet as string) ?? undefined,
  };

  const res = NextResponse.json(body, { status: 201 });
  setRateLimitHeaders(res.headers, rl);
  return res;
}
