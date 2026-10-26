import "server-only";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  newsletter: { limit: 5, windowMs: 60_000 },
  cart: { limit: 60, windowMs: 60_000 },
  checkout: { limit: 10, windowMs: 60_000 },
  upload: { limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window in-memory limiter. Adequate for a single server instance; use a shared
 * store such as Redis when running several instances (see docs/DEPLOYMENT.md).
 */
export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    if (buckets.size > 10_000) sweep(now);
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count += 1;
  if (bucket.count > rule.limit) return { ok: false, retryAfterMs: bucket.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export function resetRateLimits() {
  buckets.clear();
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Only trust forwarding headers when running behind a known reverse proxy.
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = h.get("x-real-ip");
    if (real) return real;
  }
  return "local";
}

export async function rateLimit(name: keyof typeof RATE_LIMITS): Promise<boolean> {
  const ip = await clientIp();
  return checkRateLimit(`${name}:${ip}`, RATE_LIMITS[name]).ok;
}
