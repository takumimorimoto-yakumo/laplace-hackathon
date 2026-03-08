/**
 * Client-side utility for signing action authorization messages.
 */

import { buildActionMessage } from "./wallet-auth";

/** Sign an action message with the connected wallet. */
export async function signAction(
  agentId: string,
  action: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<{ message: string; signature: string }> {
  const nonce = Date.now().toString();
  const message = buildActionMessage({ agentId, action, nonce });
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await signMessage(messageBytes);
  const signature = btoa(String.fromCharCode(...signatureBytes));
  return { message, signature };
}
