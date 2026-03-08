import { PublicKey } from "@solana/web3.js";
import {
  parseActionMessage,
  verifyWalletSignature,
  isValidNonce,
} from "@/lib/solana/wallet-auth";
import { badRequest, forbidden, notFound } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface VerifyResult {
  error: NextResponse | null;
  ownerWallet: string | null;
}

/**
 * Verify wallet ownership for a user-agent action.
 * Expects `message` and `signature` in the request body.
 */
export async function verifyAgentOwnership(
  agentId: string,
  expectedAction: string,
  message: string | undefined,
  signature: string | undefined
): Promise<VerifyResult> {
  if (!message || !signature) {
    return {
      error: badRequest(
        "message and signature are required for authentication"
      ),
      ownerWallet: null,
    };
  }

  const parsed = parseActionMessage(message);
  if (!parsed) {
    return { error: badRequest("Invalid message format"), ownerWallet: null };
  }

  if (parsed.agentId !== agentId) {
    return {
      error: badRequest("Agent ID in message does not match"),
      ownerWallet: null,
    };
  }

  if (parsed.action !== expectedAction) {
    return {
      error: badRequest("Action in message does not match"),
      ownerWallet: null,
    };
  }

  if (!isValidNonce(parsed.nonce)) {
    return {
      error: badRequest("Nonce expired. Please sign a new message."),
      ownerWallet: null,
    };
  }

  const supabase = createAdminClient();
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, tier, owner_wallet")
    .eq("id", agentId)
    .single();

  if (fetchError || !agent) {
    return { error: notFound("Agent not found"), ownerWallet: null };
  }

  if (agent.tier !== "user") {
    return {
      error: forbidden("Only user-tier agents can be modified"),
      ownerWallet: null,
    };
  }

  if (!agent.owner_wallet) {
    return { error: forbidden("Agent has no owner"), ownerWallet: null };
  }

  let publicKeyBytes: Uint8Array;
  try {
    const pubkey = new PublicKey(agent.owner_wallet as string);
    publicKeyBytes = pubkey.toBytes();
  } catch {
    return {
      error: forbidden("Invalid owner wallet on record"),
      ownerWallet: null,
    };
  }

  const signatureValid = verifyWalletSignature(
    message,
    signature,
    publicKeyBytes
  );
  if (!signatureValid) {
    return {
      error: forbidden("Invalid wallet signature"),
      ownerWallet: null,
    };
  }

  return { error: null, ownerWallet: agent.owner_wallet as string };
}

/**
 * Verify wallet ownership for agent creation (no existing agent).
 * Returns a NextResponse error if verification fails, or null on success.
 */
export function verifyWalletForCreation(
  walletAddress: string,
  message: string | undefined,
  signature: string | undefined
): NextResponse | null {
  if (!message || !signature) {
    return badRequest(
      "message and signature are required for authentication"
    );
  }

  const parsed = parseActionMessage(message);
  if (!parsed) {
    return badRequest("Invalid message format");
  }

  if (parsed.action !== "create") {
    return badRequest("Action in message does not match");
  }

  if (!isValidNonce(parsed.nonce)) {
    return badRequest("Nonce expired. Please sign a new message.");
  }

  if (parsed.agentId !== "new") {
    return badRequest("Agent ID in message must be 'new' for creation");
  }

  let publicKeyBytes: Uint8Array;
  try {
    const pubkey = new PublicKey(walletAddress);
    publicKeyBytes = pubkey.toBytes();
  } catch {
    return badRequest("Invalid wallet address");
  }

  const signatureValid = verifyWalletSignature(
    message,
    signature,
    publicKeyBytes
  );
  if (!signatureValid) {
    return forbidden("Invalid wallet signature");
  }

  return null;
}
