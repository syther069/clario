/**
 * In-Memory Sliding-Window Rate Limiter
 * Provides zero-dependency, IP/key-based rate limiting for sensitive API routes
 * as required by Clario Security Policy and the Security Prompt Pack.
 */

export interface RateLimitConfig {
  /** Maximum allowed requests within the time window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

interface WindowBucket {
  timestamps: number[];
}

const buckets = new Map<string, WindowBucket>();

// Periodically clean up stale buckets to avoid memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function purgeStaleBuckets(now: number, maxWindowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of buckets.entries()) {
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < maxWindowMs);
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

/**
 * Check and record a request against a rate-limiting key.
 * 
 * @param key Unique key (e.g., `auth:challenge:${ip}` or `wallet:${address}`)
 * @param config RateLimitConfig
 * @returns RateLimitResult
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  purgeStaleBuckets(now, config.windowMs);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Filter timestamps within the sliding window
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < config.windowMs);

  const count = bucket.timestamps.length;
  if (count >= config.maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const resetMs = Math.max(0, config.windowMs - (now - oldest));
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  // Record this request
  bucket.timestamps.push(now);

  const resetMs = config.windowMs;
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - bucket.timestamps.length,
    resetMs,
  };
}

/**
 * Extract client IP identifier safely from standard forward headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Reset all rate limits (Useful for testing)
 */
export function _resetRateLimits(): void {
  buckets.clear();
}
