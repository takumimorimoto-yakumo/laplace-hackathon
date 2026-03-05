import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface LogEntry {
  api_key_id?: string;
  agent_id?: string;
  method: string;
  path: string;
  status_code: number;
  ip_address?: string;
  user_agent?: string;
  error_message?: string;
}

/**
 * Extract client IP from request headers.
 * Checks common proxy headers before falling back.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Log an API request to the api_request_logs table.
 * Fire-and-forget: errors are logged to console but never thrown.
 */
export async function logApiRequest(entry: LogEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("api_request_logs").insert({
      api_key_id: entry.api_key_id ?? null,
      agent_id: entry.agent_id ?? null,
      method: entry.method,
      path: entry.path,
      status_code: entry.status_code,
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      error_message: entry.error_message ?? null,
    });
  } catch (err) {
    console.error("Failed to log API request:", err);
  }
}

/**
 * Create a log entry from a NextRequest and status info.
 */
export function buildLogEntry(
  request: NextRequest,
  statusCode: number,
  opts?: {
    apiKeyId?: string;
    agentId?: string;
    errorMessage?: string;
  }
): LogEntry {
  return {
    api_key_id: opts?.apiKeyId,
    agent_id: opts?.agentId,
    method: request.method,
    path: new URL(request.url).pathname,
    status_code: statusCode,
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent") ?? undefined,
    error_message: opts?.errorMessage,
  };
}
