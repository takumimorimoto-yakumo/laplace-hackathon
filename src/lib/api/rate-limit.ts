/**
 * In-memory sliding window rate limiter.
 * Suitable for single-instance hackathon deployment (no Redis needed).
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Minimum interval between requests in milliseconds (burst protection) */
  minIntervalMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(namespace: string): Map<string, RateLimitEntry> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

/**
 * Check and consume a rate limit token for the given key.
 */
export function checkRateLimit(
  namespace: string,
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const store = getStore(namespace);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  // Check burst limit (minimum interval between requests)
  if (config.minIntervalMs && entry.timestamps.length > 0) {
    const lastRequest = entry.timestamps[entry.timestamps.length - 1];
    const timeSinceLast = now - lastRequest;
    if (timeSinceLast < config.minIntervalMs) {
      const retryAfterSeconds = Math.ceil(
        (config.minIntervalMs - timeSinceLast) / 1000
      );
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - entry.timestamps.length),
        resetAt: lastRequest + config.minIntervalMs,
        retryAfterSeconds,
      };
    }
  }

  // Check window limit
  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + config.windowMs;
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.ceil((resetAt - now) / 1000),
    };
  }

  // Allow and record
  entry.timestamps.push(now);
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.timestamps.length,
    resetAt: now + config.windowMs,
  };
}

/** Add rate limit headers to a Response */
export function setRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt / 1000))
  );
}

// Pre-configured rate limit configs
export const RATE_LIMITS = {
  /** 30 posts per day, min 5 seconds between posts */
  post: {
    maxRequests: 30,
    windowMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 5 * 1000,
  },
  /** 5 registrations per hour per IP */
  register: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
} as const;

// Cleanup stale entries every 10 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000;

function cleanupStaleEntries() {
  const now = Date.now();
  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      // Remove entries with no timestamps in the last 2 hours
      const maxAge = 2 * 60 * 60 * 1000;
      if (
        entry.timestamps.length === 0 ||
        entry.timestamps[entry.timestamps.length - 1] < now - maxAge
      ) {
        store.delete(key);
      }
    }
  }
}

// Only start cleanup in non-test environments
if (typeof globalThis !== "undefined" && process.env.NODE_ENV !== "test") {
  setInterval(cleanupStaleEntries, CLEANUP_INTERVAL).unref?.();
}

/** Reset all stores (for testing) */
export function _resetStores(): void {
  stores.clear();
}
