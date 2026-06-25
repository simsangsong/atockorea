/**
 * Durable (cross-instance) rate-limit backend — W9.11 / CB-2.
 *
 * The chatbot's in-memory limiters (`lib/chatbot/requestRateLimit.ts`,
 * `bookingLookupRateLimit.ts`) are per-process: each serverless instance keeps
 * its own Map, so under lambda fan-out the booking-lookup enumeration/PII brake
 * and the LLM-cost throttle can be bypassed. This module provides a shared
 * counter backed by Upstash Redis over its REST API.
 *
 * Deliberately dependency-free: it talks to Upstash via `fetch` rather than the
 * @upstash/* SDK, so it adds no package to the lockfile (this repo's admin
 * worktree shares node_modules with main via a junction). W9.11 is the one
 * place a durable store is allowed; this keeps it zero-install.
 *
 * Activation is purely env-driven — set `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` (Upstash Redis → REST API, or a Vercel Marketplace
 * Upstash integration). When unset, `isDurableRateLimitConfigured()` returns
 * false and callers fall back to the existing in-memory limiters, so behavior is
 * unchanged until the store is provisioned.
 */

export function isDurableRateLimitConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

type RedisCommand = (string | number)[];

/** Run a Redis command pipeline via the Upstash REST API. Returns each command's
 *  result in order. Throws on transport/Redis error so callers can fall back. */
async function upstashPipeline(commands: RedisCommand[]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash is not configured');

  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    // Never let a counter call cache.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Upstash pipeline HTTP ${res.status}`);

  const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  return data.map((entry) => {
    if (entry && typeof entry === 'object' && entry.error) {
      throw new Error(`Upstash error: ${entry.error}`);
    }
    return entry?.result ?? null;
  });
}

/** INCR a fixed-window counter, setting its TTL only on the first hit (EXPIRE
 *  NX), and return the post-increment count. */
export async function durableIncrWindow(key: string, windowSec: number): Promise<number> {
  const [count] = await upstashPipeline([
    ['INCR', key],
    ['EXPIRE', key, windowSec, 'NX'],
  ]);
  return toCount(count);
}

/** Read a counter's current value (0 when absent) without modifying it. */
export async function durableReadCount(key: string): Promise<number> {
  const [value] = await upstashPipeline([['GET', key]]);
  return toCount(value);
}

/** Read a key's value plus remaining TTL in ms (0 when absent / no TTL). */
export async function durableReadWithTtl(
  key: string,
): Promise<{ present: boolean; pttlMs: number }> {
  const [value, pttl] = await upstashPipeline([
    ['GET', key],
    ['PTTL', key],
  ]);
  const ttl = Number(pttl);
  return { present: value != null, pttlMs: Number.isFinite(ttl) && ttl > 0 ? ttl : 0 };
}

/** SET a key with a TTL (seconds). */
export async function durableSetWithTtl(key: string, value: string, ttlSec: number): Promise<void> {
  await upstashPipeline([['SET', key, value, 'EX', ttlSec]]);
}

/** DELETE one or more keys. */
export async function durableDelete(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await upstashPipeline([['DEL', ...keys]]);
}

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Pure decision helpers (no I/O — unit tested).
// ---------------------------------------------------------------------------

export type RateDecision = { allowed: boolean; retryAfterMs: number };

/**
 * Evaluate two fixed-window counts (minute + hour) against their caps, given the
 * count of prior attempts (i.e. BEFORE the current one is recorded — matching
 * the in-memory check/record split). Blocks when prior attempts already reached
 * a cap.
 */
export function evaluatePriorAttemptWindows(args: {
  priorMinute: number;
  priorHour: number;
  perMinute: number;
  perHour: number;
  minuteMs: number;
  hourMs: number;
}): RateDecision {
  const { priorMinute, priorHour, perMinute, perHour, minuteMs, hourMs } = args;
  if (priorMinute >= perMinute) return { allowed: false, retryAfterMs: minuteMs };
  if (priorHour >= perHour) return { allowed: false, retryAfterMs: hourMs };
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Evaluate a single consume-then-check fixed-window counter, given the
 * post-increment count (the value INCR returned). Allows up to `max` hits per
 * window; blocks once the count exceeds it.
 */
export function evaluatePostIncrementWindow(
  postIncrementCount: number,
  max: number,
  windowMs: number,
): RateDecision {
  if (postIncrementCount > max) return { allowed: false, retryAfterMs: windowMs };
  return { allowed: true, retryAfterMs: 0 };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Pure sliding-window evaluation used by the in-memory fallback. Given the prior
 * hit timestamps, decide whether a new hit (at `now`) is allowed and return the
 * timestamp list to persist (consuming a slot only when allowed).
 */
export function evaluateSlidingWindow(
  timestamps: number[],
  perMinute: number,
  perHour: number,
  now: number,
): { decision: RateDecision; kept: number[] } {
  const recent = timestamps.filter((t) => now - t < HOUR_MS);
  const lastMinute = recent.filter((t) => now - t < MINUTE_MS).length;
  if (lastMinute >= perMinute) return { decision: { allowed: false, retryAfterMs: MINUTE_MS }, kept: recent };
  if (recent.length >= perHour) return { decision: { allowed: false, retryAfterMs: HOUR_MS }, kept: recent };
  recent.push(now);
  return { decision: { allowed: true, retryAfterMs: 0 }, kept: recent };
}

// In-memory fallback store for the generic requestGate (per-process).
const memoryBuckets = new Map<string, number[]>();

function memoryGate(fullKey: string, perMinute: number, perHour: number, now: number): RateDecision {
  const ts = memoryBuckets.get(fullKey) ?? [];
  const { decision, kept } = evaluateSlidingWindow(ts, perMinute, perHour, now);
  memoryBuckets.set(fullKey, kept);
  return decision;
}

/**
 * Generic per-(namespace,key) request gate for non-chatbot routes (PA-4/5/6).
 * Consumes a slot in a shared minute + hour counter via Upstash when configured;
 * otherwise falls back to a per-process in-memory sliding window. Same fail-open
 * contract as the chatbot variants — a Redis error degrades to in-memory rather
 * than blocking the request.
 */
export async function requestGate(opts: {
  namespace: string;
  key: string;
  perMinute: number;
  perHour: number;
}): Promise<RateDecision> {
  const { namespace, key, perMinute, perHour } = opts;
  if (isDurableRateLimitConfigured()) {
    try {
      const [minuteCount, hourCount] = await Promise.all([
        durableIncrWindow(`rl:${namespace}:${key}:m`, 60),
        durableIncrWindow(`rl:${namespace}:${key}:h`, 3600),
      ]);
      const minute = evaluatePostIncrementWindow(minuteCount, perMinute, MINUTE_MS);
      if (!minute.allowed) return minute;
      return evaluatePostIncrementWindow(hourCount, perHour, HOUR_MS);
    } catch (err) {
      console.warn('[durable-rate-limit] requestGate durable path failed; in-memory fallback:', err);
    }
  }
  return memoryGate(`${namespace}:${key}`, perMinute, perHour, Date.now());
}

/** Derive a per-client rate-limit key from request headers (best-effort IP). */
export function clientIpKey(headers: Headers): string {
  const xff = headers.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

/** Test helper — clears the generic in-memory gate store. */
export function __resetRequestGateMemory(): void {
  memoryBuckets.clear();
}
