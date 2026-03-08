// ============================================================
// Wallet Signature Authentication (ed25519)
// ============================================================
// Stateless signature verification for withdrawal requests.
// Uses tweetnacl to verify Solana wallet signatures.

import nacl from "tweetnacl";

const NONCE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

/** Build the canonical message for a withdrawal request. */
export function buildWithdrawalMessage(params: {
  agentId: string;
  amount: number;
  nonce: string;
}): string {
  return [
    "Laplace Withdrawal Request",
    `Agent: ${params.agentId}`,
    `Amount: ${params.amount}`,
    `Nonce: ${params.nonce}`,
  ].join("\n");
}

/** Parse fields from a withdrawal message. Returns null if format is invalid. */
export function parseWithdrawalMessage(
  message: string
): { agentId: string; amount: number; nonce: string } | null {
  const lines = message.split("\n");
  if (lines.length < 4 || lines[0] !== "Laplace Withdrawal Request") {
    return null;
  }

  const agentId = lines[1]?.replace("Agent: ", "");
  const amountStr = lines[2]?.replace("Amount: ", "");
  const nonce = lines[3]?.replace("Nonce: ", "");

  if (!agentId || !amountStr || !nonce) return null;

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  return { agentId, amount, nonce };
}

/** Verify an ed25519 signature against a public key (base58-decoded). */
export function verifyWalletSignature(
  message: string,
  signatureBase64: string,
  publicKeyBytes: Uint8Array
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) =>
      c.charCodeAt(0)
    );
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/** Check if a timestamp-based nonce is still valid (within 5 minutes). */
export function isValidNonce(nonce: string): boolean {
  const ts = parseInt(nonce, 10);
  if (isNaN(ts)) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= NONCE_VALIDITY_MS;
}

/** Build a general action authorization message. */
export function buildActionMessage(params: {
  agentId: string;
  action: string;
  nonce: string;
}): string {
  return [
    "Laplace Action Authorization",
    `Agent: ${params.agentId}`,
    `Action: ${params.action}`,
    `Nonce: ${params.nonce}`,
  ].join("\n");
}

/** Parse fields from an action authorization message. Returns null if invalid. */
export function parseActionMessage(
  message: string
): { agentId: string; action: string; nonce: string } | null {
  const lines = message.split("\n");
  if (lines.length < 4 || lines[0] !== "Laplace Action Authorization") {
    return null;
  }

  const agentId = lines[1]?.replace("Agent: ", "");
  const action = lines[2]?.replace("Action: ", "");
  const nonce = lines[3]?.replace("Nonce: ", "");

  if (!agentId || !action || !nonce) return null;
  return { agentId, action, nonce };
}
