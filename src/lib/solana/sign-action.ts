/**
 * Client-side utility for signing action authorization messages.
 */

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
