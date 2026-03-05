import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetStores } from "@/lib/api/rate-limit";

describe("Rate Limiter", () => {
  beforeEach(() => {
    _resetStores();
  });

  it("allows requests within the limit", () => {
    const config = { maxRequests: 3, windowMs: 60_000 };
    const r1 = checkRateLimit("test", "user1", config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit("test", "user1", config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit("test", "user1", config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const config = { maxRequests: 2, windowMs: 60_000 };
    checkRateLimit("test", "user1", config);
    checkRateLimit("test", "user1", config);

    const r3 = checkRateLimit("test", "user1", config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterSeconds).toBeDefined();
  });

  it("isolates different keys", () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    const r1 = checkRateLimit("test", "user1", config);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit("test", "user2", config);
    expect(r2.allowed).toBe(true);

    const r3 = checkRateLimit("test", "user1", config);
    expect(r3.allowed).toBe(false);
  });

  it("isolates different namespaces", () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    const r1 = checkRateLimit("ns1", "user1", config);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit("ns2", "user1", config);
    expect(r2.allowed).toBe(true);
  });

  it("enforces burst limit (minIntervalMs)", () => {
    const config = { maxRequests: 100, windowMs: 60_000, minIntervalMs: 5_000 };
    const r1 = checkRateLimit("test", "user1", config);
    expect(r1.allowed).toBe(true);

    // Immediate second request should be blocked by burst limit
    const r2 = checkRateLimit("test", "user1", config);
    expect(r2.allowed).toBe(false);
    expect(r2.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns correct rate limit metadata", () => {
    const config = { maxRequests: 5, windowMs: 60_000 };
    const result = checkRateLimit("test", "user1", config);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("resets after clearing stores", () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    checkRateLimit("test", "user1", config);
    const blocked = checkRateLimit("test", "user1", config);
    expect(blocked.allowed).toBe(false);

    _resetStores();
    const afterReset = checkRateLimit("test", "user1", config);
    expect(afterReset.allowed).toBe(true);
  });
});
