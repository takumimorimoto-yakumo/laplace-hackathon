import { PublicKey } from "@solana/web3.js";
import {
  parseActionMessage,
  verifyWalletSignature,
  isValidNonce,
} from "@/lib/solana/wallet-auth";
import { badRequest, forbidden, notFound } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const adminWallets = (process.env.ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

interface VerifyResult {
  error: NextResponse | null;
  ownerWallet: string | null;
}

/**
 * Verify wallet ownership for a user-agent action.
 * Expects `message` and `signature` in the request body.
 *
 * Admin wallets (ADMIN_WALLETS env) can modify any agent including system agents.
 * For non-admin wallets, only user-tier agents owned by the signer are allowed.
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

  // Determine the signer's wallet from the message to check admin status.
  // We need to verify signature against whichever wallet is the signer.
  // For owner: verify against agent.owner_wallet
  // For admin: verify against the admin's own wallet (parsed from the request)

  // First, try to verify as owner (if agent has one)
  const agentOwner = agent.owner_wallet as string | null;

  // Check if the signer is an admin by trying each admin wallet
  let isAdmin = false;
  let signerWallet: string | null = null;

  // Try verifying signature with owner wallet first
  if (agentOwner) {
    try {
      const ownerPubkey = new PublicKey(agentOwner);
      const ownerBytes = ownerPubkey.toBytes();
      const ownerValid = verifyWalletSignature(message, signature, ownerBytes);
      if (ownerValid) {
        signerWallet = agentOwner;
      }
    } catch {
      // Invalid owner wallet, continue to admin check
    }
  }

  // If not verified as owner, try admin wallets
  if (!signerWallet) {
    for (const adminAddr of adminWallets) {
      try {
        const adminPubkey = new PublicKey(adminAddr);
        const adminBytes = adminPubkey.toBytes();
        const adminValid = verifyWalletSignature(message, signature, adminBytes);
        if (adminValid) {
          signerWallet = adminAddr;
          isAdmin = true;
          break;
        }
      } catch {
        // Invalid admin wallet address, skip
      }
    }
  }

  if (!signerWallet) {
    return {
      error: forbidden("Invalid wallet signature"),
      ownerWallet: null,
    };
  }

  // Non-admin: enforce tier and ownership restrictions
  if (!isAdmin) {
    if (agent.tier !== "user") {
      return {
        error: forbidden("Only user-tier agents can be modified"),
        ownerWallet: null,
      };
    }

    if (!agentOwner) {
      return { error: forbidden("Agent has no owner"), ownerWallet: null };
    }

    if (signerWallet !== agentOwner) {
      return {
        error: forbidden("You do not own this agent"),
        ownerWallet: null,
      };
    }
  }

  return { error: null, ownerWallet: signerWallet };
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
