import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, internalError } from "@/lib/api/errors";
import { verifyAgentOwnership } from "@/lib/api/verify-ownership";
import { deriveTemperature, deriveCycleInterval, reasoningToLegacyStyle } from "@/lib/agents/templates";
import {
  VALID_TIME_HORIZONS,
  VALID_REASONING_STYLES,
  VALID_RISK_TOLERANCES,
  VALID_ASSET_FOCUSES,
  VALID_VOICE_STYLES,
  VALID_MODULES,
} from "@/lib/agents/validation";
import type {
  InvestmentOutlook,
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
  VoiceStyle,
  AnalysisModule,
} from "@/lib/types";

// ---------- Validation ----------

const VALID_OUTLOOKS: InvestmentOutlook[] = [
  "ultra_bullish",
  "bullish",
  "bearish",
  "ultra_bearish",
];

interface UpdateUserAgentBody {
  wallet_address: string;
  directives?: string;
  watchlist?: string[];
  alpha?: string;
  outlook?: InvestmentOutlook;
  time_horizon?: AgentTimeHorizon;
  reasoning_style?: ReasoningStyle;
  risk_tolerance?: RiskTolerance;
  asset_focus?: AssetFocus;
  voice_style?: VoiceStyle;
  modules?: AnalysisModule[];
  message?: string;
  signature?: string;
}

function validateUpdateBody(
  body: unknown
): { data: UpdateUserAgentBody; errors: null } | { data: null; errors: string[] } {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { data: null, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  // wallet_address: required for backwards compatibility
  if (typeof b.wallet_address !== "string" || b.wallet_address.length === 0) {
    errors.push("wallet_address is required");
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

  // message: optional string (for wallet signature auth)
  if (b.message !== undefined && typeof b.message !== "string") {
    errors.push("message must be a string");
  }

  // signature: optional string (for wallet signature auth)
  if (b.signature !== undefined && typeof b.signature !== "string") {
    errors.push("signature must be a string");
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      wallet_address: b.wallet_address as string,
      directives: b.directives as string | undefined,
      watchlist: b.watchlist as string[] | undefined,
      alpha: b.alpha as string | undefined,
      outlook: b.outlook as InvestmentOutlook | undefined,
      time_horizon: b.time_horizon as AgentTimeHorizon | undefined,
      reasoning_style: b.reasoning_style as ReasoningStyle | undefined,
      risk_tolerance: b.risk_tolerance as RiskTolerance | undefined,
      asset_focus: b.asset_focus as AssetFocus | undefined,
      voice_style: b.voice_style as VoiceStyle | undefined,
      modules: b.modules as AnalysisModule[] | undefined,
      message: b.message as string | undefined,
      signature: b.signature as string | undefined,
    },
    errors: null,
  };
}

// ---------- PATCH Handler ----------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  // Validate
  const validation = validateUpdateBody(rawBody);
  if (validation.errors) {
    return badRequest("Validation failed", validation.errors);
  }

  // Verify wallet ownership via signature
  const { error: authError } = await verifyAgentOwnership(
    id,
    "update",
    validation.data.message,
    validation.data.signature
  );
  if (authError) return authError;

  const {
    directives,
    watchlist,
    alpha,
    outlook,
    time_horizon,
    reasoning_style,
    risk_tolerance,
    asset_focus,
    voice_style,
    modules,
  } = validation.data;

  // Build update object with only provided fields
  const updateRow: Record<string, unknown> = {};
  if (directives !== undefined) {
    updateRow.user_directives = directives;
  }
  if (watchlist !== undefined) {
    updateRow.custom_watchlist = watchlist;
  }
  if (alpha !== undefined) {
    updateRow.user_alpha = alpha;
  }
  if (outlook !== undefined) {
    updateRow.outlook = outlook;
  }
  if (time_horizon !== undefined) {
    updateRow.time_horizon = time_horizon;
    updateRow.cycle_interval_minutes = deriveCycleInterval(time_horizon);
  }
  if (reasoning_style !== undefined) {
    updateRow.reasoning_style = reasoning_style;
  }
  if (risk_tolerance !== undefined) {
    updateRow.risk_tolerance = risk_tolerance;
  }
  if (asset_focus !== undefined) {
    updateRow.asset_focus = asset_focus;
  }
  if (voice_style !== undefined) {
    updateRow.voice_style = voice_style;
  }
  if (modules !== undefined) {
    updateRow.modules = modules;
  }

  // Auto-derive temperature and legacy style when reasoning/risk change.
  // We need current values for any axis not being updated, so fetch them.
  if (reasoning_style !== undefined || risk_tolerance !== undefined) {
    const supabaseForRead = createAdminClient();
    const { data: current } = await supabaseForRead
      .from("agents")
      .select("reasoning_style, risk_tolerance")
      .eq("id", id)
      .single();

    const effectiveReasoning = reasoning_style ?? (current?.reasoning_style as ReasoningStyle | null);
    const effectiveRisk = risk_tolerance ?? (current?.risk_tolerance as RiskTolerance | null);

    if (effectiveReasoning && effectiveRisk) {
      updateRow.temperature = deriveTemperature(effectiveRisk, effectiveReasoning);
      updateRow.style = reasoningToLegacyStyle(effectiveReasoning, effectiveRisk);
    }
  }

  if (Object.keys(updateRow).length === 0) {
    return badRequest("No fields to update");
  }

  const supabase = createAdminClient();

  const { data: updated, error: updateError } = await supabase
    .from("agents")
    .update(updateRow)
    .eq("id", id)
    .select("id, name, user_directives, custom_watchlist, user_alpha, outlook, time_horizon, reasoning_style, risk_tolerance, asset_focus, voice_style, modules")
    .single();

  if (updateError || !updated) {
    console.error("User agent update error:", updateError);
    return internalError("Failed to update agent");
  }

  return NextResponse.json(updated);
}

// ---------- DELETE Handler ----------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get wallet_address, message, and signature from query params or body
  let walletAddress: string | null = null;
  let message: string | undefined;
  let signature: string | undefined;

  // Try query params first
  const url = new URL(request.url);
  walletAddress = url.searchParams.get("wallet_address");

  // Try body if not in query params
  if (!walletAddress) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.wallet_address === "string") {
        walletAddress = body.wallet_address;
      }
      if (typeof body.message === "string") {
        message = body.message;
      }
      if (typeof body.signature === "string") {
        signature = body.signature;
      }
    } catch {
      // No body — that's fine if wallet_address was in query params
    }
  }

  if (!walletAddress) {
    return badRequest("wallet_address is required");
  }

  // Verify wallet ownership via signature
  const { error: authError } = await verifyAgentOwnership(
    id,
    "delete",
    message,
    signature
  );
  if (authError) return authError;

  const supabase = createAdminClient();

  // Hard delete: remove agent and all related data (FK CASCADE)
  const { error: deleteError } = await supabase
    .from("agents")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("User agent delete error:", deleteError);
    return internalError("Failed to delete agent");
  }

  return NextResponse.json({ message: "Agent deleted successfully" });
}
