import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, conflict, internalError } from "@/lib/api/errors";
import { getTemplateConfig, AVAILABLE_LLMS } from "@/lib/agents/templates";
import { generateAgentWallet } from "@/lib/solana/agent-wallet";
import type {
  AgentTemplate,
  InvestmentOutlook,
  LLMModel,
} from "@/lib/types";

// ---------- Validation Helpers ----------

const VALID_TEMPLATES: AgentTemplate[] = [
  "day_trader",
  "swing_trader",
  "mid_term_investor",
  "macro_strategist",
  "meme_hunter",
  "risk_analyst",
  "defi_specialist",
  "contrarian",
];

const VALID_OUTLOOKS: InvestmentOutlook[] = [
  "ultra_bullish",
  "bullish",
  "bearish",
  "ultra_bearish",
];

const VALID_PAYMENT_TOKENS = ["USDC", "SKR"] as const;

interface CreateUserAgentBody {
  name: string;
  template: AgentTemplate;
  wallet_address: string;
  llm_model?: LLMModel;
  outlook?: InvestmentOutlook;
  directives?: string;
  watchlist?: string[];
  alpha?: string;
  tx_signature?: string;
  payment_token?: "USDC" | "SKR";
}

function validateBody(
  body: unknown
): { data: CreateUserAgentBody; errors: null } | { data: null; errors: string[] } {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { data: null, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  // name: required, 2-30 chars
  if (typeof b.name !== "string" || b.name.length < 2 || b.name.length > 30) {
    errors.push("name must be a string between 2 and 30 characters");
  }

  // template: required, one of 8 valid templates
  if (
    typeof b.template !== "string" ||
    !VALID_TEMPLATES.includes(b.template as AgentTemplate)
  ) {
    errors.push(
      `template must be one of: ${VALID_TEMPLATES.join(", ")}`
    );
  }

  // wallet_address: required string
  if (typeof b.wallet_address !== "string" || b.wallet_address.length === 0) {
    errors.push("wallet_address is required");
  }

  // llm_model: optional, from AVAILABLE_LLMS
  if (
    b.llm_model !== undefined &&
    (typeof b.llm_model !== "string" ||
      !AVAILABLE_LLMS.includes(b.llm_model as LLMModel))
  ) {
    errors.push(
      `llm_model must be one of: ${AVAILABLE_LLMS.join(", ")}`
    );
  }

  // outlook: optional InvestmentOutlook
  if (
    b.outlook !== undefined &&
    (typeof b.outlook !== "string" ||
      !VALID_OUTLOOKS.includes(b.outlook as InvestmentOutlook))
  ) {
    errors.push(
      `outlook must be one of: ${VALID_OUTLOOKS.join(", ")}`
    );
  }

  // directives: optional string, max 500
  if (b.directives !== undefined) {
    if (typeof b.directives !== "string" || b.directives.length > 500) {
      errors.push("directives must be a string with max 500 characters");
    }
  }

  // watchlist: optional string[], max 10 items
  if (b.watchlist !== undefined) {
    if (
      !Array.isArray(b.watchlist) ||
      b.watchlist.length > 10 ||
      !b.watchlist.every((item: unknown) => typeof item === "string")
    ) {
      errors.push("watchlist must be an array of strings with max 10 items");
    }
  }

  // alpha: optional string, max 500
  if (b.alpha !== undefined) {
    if (typeof b.alpha !== "string" || b.alpha.length > 500) {
      errors.push("alpha must be a string with max 500 characters");
    }
  }

  // payment_token: optional, "USDC" or "SKR"
  if (
    b.payment_token !== undefined &&
    (typeof b.payment_token !== "string" ||
      !VALID_PAYMENT_TOKENS.includes(b.payment_token as "USDC" | "SKR"))
  ) {
    errors.push(`payment_token must be one of: ${VALID_PAYMENT_TOKENS.join(", ")}`);
  }

  // tx_signature: optional string
  if (b.tx_signature !== undefined && typeof b.tx_signature !== "string") {
    errors.push("tx_signature must be a string");
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      name: b.name as string,
      template: b.template as AgentTemplate,
      wallet_address: b.wallet_address as string,
      llm_model: b.llm_model as LLMModel | undefined,
      outlook: b.outlook as InvestmentOutlook | undefined,
      directives: b.directives as string | undefined,
      watchlist: b.watchlist as string[] | undefined,
      alpha: b.alpha as string | undefined,
      tx_signature: b.tx_signature as string | undefined,
      payment_token: b.payment_token as "USDC" | "SKR" | undefined,
    },
    errors: null,
  };
}

// ---------- POST Handler ----------

export async function POST(request: NextRequest) {
  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  // Validate
  const validation = validateBody(rawBody);
  if (validation.errors) {
    return badRequest("Validation failed", validation.errors);
  }

  const {
    name,
    template,
    wallet_address,
    llm_model,
    outlook,
    directives,
    watchlist,
    alpha,
  } = validation.data;

  // Look up template config
  const templateConfig = getTemplateConfig(template);
  if (!templateConfig) {
    return badRequest(`Unknown template: ${template}`);
  }

  const supabase = createAdminClient();

  // Check name uniqueness (case-insensitive)
  const { data: existingAgent } = await supabase
    .from("agents")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existingAgent) {
    return conflict(`Agent name "${name}" is already taken`);
  }

  // Check how many user agents this wallet already has
  const { count: activeAgentCount, error: countError } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("owner_wallet", wallet_address)
    .eq("tier", "user");

  if (countError) {
    console.error("Agent count error:", countError);
    return internalError("Failed to check agent count");
  }

  const isLocal = request.headers.get("host")?.startsWith("localhost") ?? false;
  const isFree = !isLocal && (activeAgentCount ?? 0) === 0;

  if (!isFree) {
    if (!validation.data.payment_token || !validation.data.tx_signature) {
      return badRequest(
        "payment_token and tx_signature are required for additional agents"
      );
    }
  }

  // Build insert row
  const insertRow: Record<string, unknown> = {
    name,
    style: templateConfig.style,
    modules: templateConfig.modules,
    personality: templateConfig.personality,
    bio: templateConfig.bio,
    voice_style: templateConfig.voiceStyle,
    temperature: templateConfig.temperature,
    llm_model: llm_model ?? templateConfig.defaultLlm,
    outlook: outlook ?? templateConfig.defaultOutlook,
    tier: "user",
    is_system: false,
    owner_wallet: wallet_address,
    template,
  };

  if (directives !== undefined) {
    insertRow.user_directives = directives;
  }
  if (watchlist !== undefined) {
    insertRow.custom_watchlist = watchlist;
  }
  if (alpha !== undefined) {
    insertRow.user_alpha = alpha;
  }

  // Generate a Solana wallet for the agent
  try {
    const wallet = generateAgentWallet();
    insertRow.wallet_address = wallet.publicKey;
    insertRow.wallet_encrypted_key = wallet.encryptedPrivateKey;
  } catch (e) {
    console.error("Agent wallet generation failed:", e);
    return internalError("Failed to generate agent wallet. Check AGENT_KEY_ENCRYPTION_SECRET.");
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert(insertRow)
    .select("id, name")
    .single();

  if (agentError || !agent) {
    console.error("User agent creation error:", agentError);
    const detail = agentError?.message ?? "Unknown database error";
    return internalError(`Failed to create agent: ${detail}`);
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
    return internalError(`Failed to create virtual portfolio: ${detail}`);
  }

  // Create subscription record for non-free agents
  if (!isFree && validation.data.payment_token && validation.data.tx_signature) {
    const paymentAmount = validation.data.payment_token === "SKR" ? 9.0 : 10.0;
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: subError } = await supabase
      .from("agent_subscriptions")
      .insert({
        agent_id: agent.id,
        owner_wallet: wallet_address,
        payment_token: validation.data.payment_token,
        payment_amount: paymentAmount,
        expires_at: expiresAt,
        tx_signature: validation.data.tx_signature,
      });

    if (subError) {
      console.error("Subscription creation error:", subError);
    }
  }

  return NextResponse.json(
    { id: agent.id, name: agent.name, isFree },
    { status: 201 }
  );
}
