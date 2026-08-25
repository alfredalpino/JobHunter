/**
 * Lightweight IP rate limit for POST /api/hunt (per warm instance).
 * Set HUNT_RATE_LIMIT=0 to disable. Default: 10 requests / IP / hour.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const LIMIT = Number(process.env.HUNT_RATE_LIMIT || "10");
const WINDOW_MS = Number(process.env.HUNT_RATE_WINDOW_MS || String(60 * 60 * 1000));

export function checkHuntRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  if (LIMIT <= 0) return { allowed: true };

  const now = Date.now();
  const key = ip || "unknown";
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  if (bucket.count >= LIMIT) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** For tests */
export function resetHuntRateLimits(): void {
  buckets.clear();
}

const polishBuckets = new Map<string, Bucket>();

const POLISH_LIMIT = Number(process.env.POLISH_RATE_LIMIT || "30");
const POLISH_WINDOW_MS = Number(
  process.env.POLISH_RATE_WINDOW_MS || String(60 * 60 * 1000),
);

export function checkPolishRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  if (POLISH_LIMIT <= 0) return { allowed: true };

  const now = Date.now();
  const key = ip || "unknown";
  let bucket = polishBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + POLISH_WINDOW_MS };
    polishBuckets.set(key, bucket);
  }

  if (bucket.count >= POLISH_LIMIT) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetPolishRateLimits(): void {
  polishBuckets.clear();
}
