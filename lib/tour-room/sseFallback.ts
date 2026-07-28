/**
 * K1a — the SSE fallback's cadence, kept out of the route file.
 *
 * Next.js allows only its own recognised exports from a route module, so the
 * numbers that decide how expensive the fallback is live here where a test can
 * read them. They are the substance of K1a: Part K showed that a ceiling on
 * realtime concurrency was being converted into unbounded database and function
 * load, and these constants are what bounds it.
 */

/**
 * Vercel's maximum on the Hobby plan and well inside Pro's, so it is safe before
 * K2 establishes which plan we are actually on. The point is not the length —
 * it is that the platform no longer picks it. Its default (10-15s) meant the
 * function was killed mid-loop several times a minute, and each kill costs a
 * full `EventSource` reconnect, which is far more expensive than the polling.
 */
export const SSE_MAX_DURATION_S = 60;

/** Ends the loop with room to spare, so the function exits instead of dying. */
export const SSE_STREAM_BUDGET_MS = 55_000;

export const SSE_POLL_MIN_MS = 2_000;
export const SSE_POLL_MAX_MS = 8_000;
const SSE_POLL_GROWTH = 1.5;

/**
 * Reconnect delay handed to the browser. Longer than its ~3s default on
 * purpose: when realtime fails, it fails for everyone at once, so every client
 * comes back at once — and the default turns one outage into a stampede against
 * the auth path each reconnect has to pay for.
 */
export const SSE_RECONNECT_HINT_MS = 5_000;

/**
 * Fast while the conversation is live, patient when it is not.
 *
 * Activity resets straight to the floor rather than easing down, because
 * conversation is bursty: one message almost always means another is coming, and
 * a gradual return would make the second message of an exchange arrive slower
 * than the first.
 */
export function nextPollInterval(current: number, receivedCount: number): number {
  if (receivedCount > 0) return SSE_POLL_MIN_MS;
  return Math.min(SSE_POLL_MAX_MS, Math.round(current * SSE_POLL_GROWTH));
}
