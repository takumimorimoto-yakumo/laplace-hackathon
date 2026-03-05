import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types";

export function errorResponse(
  status: number,
  error: string,
  details?: string[]
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error };
  if (details && details.length > 0) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function badRequest(error: string, details?: string[]) {
  return errorResponse(400, error, details);
}

export function unauthorized(error = "Invalid or missing API key") {
  return errorResponse(401, error);
}

export function forbidden(error: string) {
  return errorResponse(403, error);
}

export function notFound(error = "Not found") {
  return errorResponse(404, error);
}

export function conflict(error: string) {
  return errorResponse(409, error);
}

export function tooManyRequests(error: string, retryAfterSeconds?: number) {
  const res = errorResponse(429, error);
  if (retryAfterSeconds) {
    res.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return res;
}

export function internalError(error = "Internal server error") {
  return errorResponse(500, error);
}
