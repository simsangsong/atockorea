// In-memory guard against booking-lookup credential enumeration.
//
// Per (session token + ip) key we cap lookup attempts (5/min, 20/hour) and lock
// the key for 1 hour after 5 failed verifications. This is a best-effort abuse
// brake layered on top of the identical-failure-message policy — not a hard
// security boundary. It is in-memory, so it does not survive a deploy or hold
// across serverless instances; swap in a shared store (Redis) if this surface
// ever needs durable limits.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const BOOKING_LOOKUP_LIMITS = {
  perMinute: 5,
  perHour: 20,
  maxFailures: 5,
  lockMs: HOUR_MS,
} as const;

type Bucket = { attempts: number[]; failures: number; lockUntil: number };

const store = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { attempts: [], failures: 0, lockUntil: 0 };
    store.set(key, bucket);
  }
  return bucket;
}

export type BookingLookupGate =
  | { allowed: true }
  | { allowed: false; reason: "locked" | "rate_limited"; retryAfterMs: number };

/** Check whether a lookup may proceed for this key. Does NOT record an attempt. */
export function checkBookingLookupAllowed(key: string, now: number = Date.now()): BookingLookupGate {
  const bucket = getBucket(key);
  if (bucket.lockUntil > now) {
    return { allowed: false, reason: "locked", retryAfterMs: bucket.lockUntil - now };
  }
  bucket.attempts = bucket.attempts.filter((t) => now - t < HOUR_MS);
  const perMinute = bucket.attempts.filter((t) => now - t < MINUTE_MS).length;
  if (perMinute >= BOOKING_LOOKUP_LIMITS.perMinute) {
    return { allowed: false, reason: "rate_limited", retryAfterMs: MINUTE_MS };
  }
  if (bucket.attempts.length >= BOOKING_LOOKUP_LIMITS.perHour) {
    return { allowed: false, reason: "rate_limited", retryAfterMs: HOUR_MS };
  }
  return { allowed: true };
}

/** Record that a verification lookup was performed (counts toward the rate cap). */
export function recordBookingLookupAttempt(key: string, now: number = Date.now()): void {
  getBucket(key).attempts.push(now);
}

/** Record a failed verification. Returns true if this failure tripped the lock. */
export function recordBookingLookupFailure(key: string, now: number = Date.now()): boolean {
  const bucket = getBucket(key);
  bucket.failures += 1;
  if (bucket.failures >= BOOKING_LOOKUP_LIMITS.maxFailures) {
    bucket.lockUntil = now + BOOKING_LOOKUP_LIMITS.lockMs;
    return true;
  }
  return false;
}

/** Record a successful verification — clears the failure counter and any lock. */
export function recordBookingLookupSuccess(key: string): void {
  const bucket = getBucket(key);
  bucket.failures = 0;
  bucket.lockUntil = 0;
}

/** Test helper — clears all rate-limit state. */
export function __resetBookingLookupRateLimit(): void {
  store.clear();
}
