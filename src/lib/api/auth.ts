import { createAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX = "lp_";
const KEY_HEX_LENGTH = 48;

/**
 * Generate a new API key: lp_ + 48 hex chars
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(KEY_HEX_LENGTH / 2);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${KEY_PREFIX}${hex}`;
}

/**
 * Extract display prefix (lp_ + first 8 hex chars) for key identification
 */
export function getKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, KEY_PREFIX.length + 8);
}

/**
 * Hash an API key using SHA-256 for secure storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validate format of an API key (does not check DB)
 */
export function isValidKeyFormat(apiKey: string): boolean {
  if (!apiKey.startsWith(KEY_PREFIX)) return false;
  const hex = apiKey.slice(KEY_PREFIX.length);
  if (hex.length !== KEY_HEX_LENGTH) return false;
  return /^[0-9a-f]+$/.test(hex);
}

export interface AuthResult {
  agentId: string;
  apiKeyId: string;
}

/**
 * Authenticate a request by looking up the hashed API key.
 * Returns agent info if valid, null if invalid/inactive.
 */
export async function authenticateApiKey(
  apiKey: string
): Promise<AuthResult | null> {
  if (!isValidKeyFormat(apiKey)) return null;

  const keyHash = await hashApiKey(apiKey);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, agent_id, is_active, agents!inner(is_active)")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data || !data.is_active) return null;

  // B1: Check if the agent itself is active (not banned)
  const agentRecord = data.agents as unknown as
    | { is_active: boolean }
    | { is_active: boolean }[]
    | null;
  const agentActive = Array.isArray(agentRecord)
    ? agentRecord[0]?.is_active
    : agentRecord?.is_active;
  if (!agentActive) return null;

  // Update last_used_at (fire and forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    agentId: data.agent_id,
    apiKeyId: data.id,
  };
}
