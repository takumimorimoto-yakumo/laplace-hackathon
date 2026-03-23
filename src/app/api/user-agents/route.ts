import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, conflict, internalError } from "@/lib/api/errors";
import { verifyWalletForCreation } from "@/lib/api/verify-ownership";
import { getTemplateConfig, AVAILABLE_LLMS, deriveTemperature, deriveCycleInterval, reasoningToLegacyStyle } from "@/lib/agents/templates";
import { generateAgentWallet } from "@/lib/solana/agent-wallet";
import {
  VALID_TIME_HORIZONS,
  VALID_REASONING_STYLES,
  VALID_RISK_TOLERANCES,
  VALID_ASSET_FOCUSES,
  VALID_VOICE_STYLES,
  VALID_MODULES,
} from "@/lib/agents/validation";
import type {
  AgentTemplate,
  InvestmentOutlook,
  LLMModel,
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
  VoiceStyle,
  AnalysisModule,
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
  "neutral",
  "bearish",
  "ultra_bearish",
];

const VALID_PAYMENT_TOKENS = ["USDC", "SKR", "SOL"] as const;

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
  payment_token?: "USDC" | "SKR" | "SOL";
  message?: string;
  signature?: string;
  time_horizon?: AgentTimeHorizon;
  reasoning_style?: ReasoningStyle;
  risk_tolerance?: RiskTolerance;
  asset_focus?: AssetFocus;
  voice_style?: VoiceStyle;
  modules?: AnalysisModule[];
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
      !VALID_PAYMENT_TOKENS.includes(b.payment_token as "USDC" | "SKR" | "SOL"))
  ) {
    errors.push(`payment_token must be one of: ${VALID_PAYMENT_TOKENS.join(", ")}`);
  }

  // tx_signature: optional string
  if (b.tx_signature !== undefined && typeof b.tx_signature !== "string") {
    errors.push("tx_signature must be a string");
  }

  // message: optional string (for wallet signature auth)
  if (b.message !== undefined && typeof b.message !== "string") {
    errors.push("message must be a string");
  }

  // signature: optional string (for wallet signature auth)
  if (b.signature !== undefined && typeof b.signature !== "string") {
    errors.push("signature must be a string");
  }

  // time_horizon: optional AgentTimeHorizon
  if (b.time_horizon !== undefined && (typeof b.time_horizon !== "string" || !VALID_TIME_HORIZONS.includes(b.time_horizon as AgentTimeHorizon))) {
    errors.push(`time_horizon must be one of: ${VALID_TIME_HORIZONS.join(", ")}`);
  }

  // reasoning_style: optional ReasoningStyle
  if (b.reasoning_style !== undefined && (typeof b.reasoning_style !== "string" || !VALID_REASONING_STYLES.includes(b.reasoning_style as ReasoningStyle))) {
    errors.push(`reasoning_style must be one of: ${VALID_REASONING_STYLES.join(", ")}`);
  }

  // risk_tolerance: optional RiskTolerance
  if (b.risk_tolerance !== undefined && (typeof b.risk_tolerance !== "string" || !VALID_RISK_TOLERANCES.includes(b.risk_tolerance as RiskTolerance))) {
    errors.push(`risk_tolerance must be one of: ${VALID_RISK_TOLERANCES.join(", ")}`);
  }

  // asset_focus: optional AssetFocus
  if (b.asset_focus !== undefined && (typeof b.asset_focus !== "string" || !VALID_ASSET_FOCUSES.includes(b.asset_focus as AssetFocus))) {
    errors.push(`asset_focus must be one of: ${VALID_ASSET_FOCUSES.join(", ")}`);
  }

  // voice_style: optional VoiceStyle
  if (b.voice_style !== undefined && (typeof b.voice_style !== "string" || !VALID_VOICE_STYLES.includes(b.voice_style as VoiceStyle))) {
    errors.push(`voice_style must be one of: ${VALID_VOICE_STYLES.join(", ")}`);
  }

  // modules: optional AnalysisModule[], 1-3 items
  if (b.modules !== undefined) {
    if (
      !Array.isArray(b.modules) ||
      b.modules.length < 1 ||
      b.modules.length > 3 ||
      !b.modules.every((m: unknown) => typeof m === "string" && VALID_MODULES.includes(m as AnalysisModule))
    ) {
      errors.push(`modules must be an array of 1-3 items from: ${VALID_MODULES.join(", ")}`);
    }
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
      payment_token: b.payment_token as "USDC" | "SKR" | "SOL" | undefined,
      message: b.message as string | undefined,
      signature: b.signature as string | undefined,
      time_horizon: b.time_horizon as AgentTimeHorizon | undefined,
      reasoning_style: b.reasoning_style as ReasoningStyle | undefined,
      risk_tolerance: b.risk_tolerance as RiskTolerance | undefined,
      asset_focus: b.asset_focus as AssetFocus | undefined,
      voice_style: b.voice_style as VoiceStyle | undefined,
      modules: b.modules as AnalysisModule[] | undefined,
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

  // Verify wallet ownership via signature
  const creationError = verifyWalletForCreation(
    validation.data.wallet_address,
    validation.data.message,
    validation.data.signature
  );
  if (creationError) return creationError;

  const {
    name,
    template,
    wallet_address,
    llm_model,
    directives,
    watchlist,
    alpha,
    time_horizon,
    reasoning_style,
    risk_tolerance,
    asset_focus,
    voice_style,
    modules,
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

  const isLocal = process.env.NODE_ENV === "development";
  const isFirstAgent = !isLocal && (activeAgentCount ?? 0) === 0;

  if (!isFirstAgent) {
    if (!validation.data.payment_token || !validation.data.tx_signature) {
      return badRequest(
        "payment_token and tx_signature are required for additional agents"
      );
    }
  }

  // Verify tx_signature is not reused (for paid agents)
  if (!isFirstAgent && validation.data.tx_signature) {
    const { data: existingTx } = await supabase
      .from("agent_subscriptions")
      .select("id")
      .eq("tx_signature", validation.data.tx_signature)
      .maybeSingle();

    if (existingTx) {
      return conflict("Transaction signature has already been used");
    }
  }

  // Build insert row
  const insertRow: Record<string, unknown> = {
    name,
    modules: modules ?? templateConfig.modules,
    personality: templateConfig.personality,
    bio: templateConfig.bio,
    voice_style: voice_style ?? templateConfig.voiceStyle,
    llm_model: llm_model ?? templateConfig.defaultLlm,
    outlook: "neutral", // Always start neutral — outlook evolves from prediction performance
    tier: "user",
    is_system: false,
    owner_wallet: wallet_address,
    template,
  };

  // 7-axis config: use overrides or template defaults
  const timeHorizon = time_horizon ?? templateConfig.timeHorizon;
  const reasoningStyle = reasoning_style ?? templateConfig.reasoningStyle;
  const riskTolerance = risk_tolerance ?? templateConfig.riskTolerance;
  const assetFocus = asset_focus ?? templateConfig.assetFocus;

  insertRow.time_horizon = timeHorizon;
  insertRow.reasoning_style = reasoningStyle;
  insertRow.risk_tolerance = riskTolerance;
  insertRow.asset_focus = assetFocus;

  // Auto-derive temperature and cycle_interval from axes
  insertRow.temperature = deriveTemperature(riskTolerance, reasoningStyle);
  insertRow.cycle_interval_minutes = deriveCycleInterval(timeHorizon);

  // Auto-derive legacy style from new axes
  insertRow.style = reasoningToLegacyStyle(reasoningStyle, riskTolerance);

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
    return internalError("Failed to create agent");
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
    return internalError("Failed to create virtual portfolio");
  }

  // Create subscription record
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  if (isFirstAgent) {
    // First agent: create trial subscription (free, 30 days)
    const { error: subError } = await supabase
      .from("agent_subscriptions")
      .insert({
        agent_id: agent.id,
        owner_wallet: wallet_address,
        payment_token: "USDC",
        payment_amount: 0,
        expires_at: expiresAt,
        is_trial: true,
        tx_signature: null,
      });

    if (subError) {
      console.error("Trial subscription creation error:", subError);
    }
  } else if (validation.data.payment_token && validation.data.tx_signature) {
    // Paid agents
    const paymentAmount = validation.data.payment_token === "SKR" ? 9.0 : 10.0;
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
    { id: agent.id, name: agent.name, isFree: isFirstAgent },
    { status: 201 }
  );
}
