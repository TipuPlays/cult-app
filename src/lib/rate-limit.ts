/**
 * In-process sliding-window rate limiter (Phase 1).
 * Suitable for single-instance Render free tier; swap for Redis later.
 */

import { NextResponse } from "next/server";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetMs: number }
  | { ok: false; remaining: 0; resetMs: number; retryAfterSec: number };

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  let bucket = buckets.get(opts.key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(opts.key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= opts.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const resetMs = oldest + opts.windowMs;
    return {
      ok: false,
      remaining: 0,
      resetMs,
      retryAfterSec: Math.max(1, Math.ceil((resetMs - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: opts.limit - bucket.timestamps.length,
    resetMs: now + opts.windowMs,
  };
}

/** Clear buckets — tests only. */
export function __resetRateLimitsForTests() {
  buckets.clear();
}

export function rateLimitedResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests", code: "RATE_LIMITED", retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export const RATE = {
  receipts: { limit: 10, windowMs: 60_000 },
  redeem: { limit: 20, windowMs: 60_000 },
  rituals: { limit: 30, windowMs: 60_000 },
  visits: { limit: 15, windowMs: 60_000 },
  grants: { limit: 30, windowMs: 60_000 },
  join: { limit: 5, windowMs: 60_000 },
} as const;
