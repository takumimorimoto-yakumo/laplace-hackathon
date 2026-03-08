import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, forbidden, notFound, internalError } from "@/lib/api/errors";
import type { InvestmentOutlook } from "@/lib/types";

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
}

function validateUpdateBody(
  body: unknown
): { data: UpdateUserAgentBody; errors: null } | { data: null; errors: string[] } {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { data: null, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  // wallet_address: required for ownership check
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

  const { wallet_address, directives, watchlist, alpha, outlook } =
    validation.data;

  const supabase = createAdminClient();

  // Fetch agent and verify ownership
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, tier, owner_wallet")
    .eq("id", id)
    .single();

  if (fetchError || !agent) {
    return notFound("Agent not found");
  }

  if (agent.tier !== "user") {
    return forbidden("Only user-tier agents can be updated");
  }

  if (agent.owner_wallet !== wallet_address) {
    return forbidden("You are not the owner of this agent");
  }

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

  if (Object.keys(updateRow).length === 0) {
    return badRequest("No fields to update");
  }

  const { data: updated, error: updateError } = await supabase
    .from("agents")
    .update(updateRow)
    .eq("id", id)
    .select("id, name, user_directives, custom_watchlist, user_alpha, outlook")
    .single();

  if (updateError || !updated) {
    console.error("User agent update error:", updateError);
    const detail = updateError?.message ?? "Unknown database error";
    return internalError(`Failed to update agent: ${detail}`);
  }

  return NextResponse.json(updated);
}

// ---------- DELETE Handler ----------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get wallet_address from query params or body
  let walletAddress: string | null = null;

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
    } catch {
      // No body — that's fine if wallet_address was in query params
    }
  }

  if (!walletAddress) {
    return badRequest("wallet_address is required");
  }

  const supabase = createAdminClient();

  // Fetch agent and verify ownership
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, tier, owner_wallet")
    .eq("id", id)
    .single();

  if (fetchError || !agent) {
    return notFound("Agent not found");
  }

  if (agent.tier !== "user") {
    return forbidden("Only user-tier agents can be retired");
  }

  if (agent.owner_wallet !== walletAddress) {
    return forbidden("You are not the owner of this agent");
  }

  // Soft delete: set is_active = false
  const { error: updateError } = await supabase
    .from("agents")
    .update({ is_active: false })
    .eq("id", id);

  if (updateError) {
    console.error("User agent retire error:", updateError);
    const detail = updateError.message ?? "Unknown database error";
    return internalError(`Failed to retire agent: ${detail}`);
  }

  return NextResponse.json({ message: "Agent retired successfully" });
}
