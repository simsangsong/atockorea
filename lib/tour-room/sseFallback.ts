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
 * K1b — the ceiling on how often ONE room+client may start a stream.
 *
 * K1a fixed how our client reconnects. It could not fix a client we do not
 * control: a cached old bundle, a webview that ignores `retry:`, a tab left
 * open for a day. And the server had no ceiling at all — the PA-4 rate gate
 * fires only on the guest email/name path, so every token-bearing guest (which
 * is every invite link) reached the stream ungated.
 *
 * A healthy client starts one stream per stream budget, about 1.1 per minute
 * per device. Twelve leaves room for a four-device family plus reopened tabs
 * and still catches the failure this exists for, which runs at roughly thirty.
 */
export const SSE_STARTS_PER_MINUTE = 12;
export const SSE_STARTS_PER_HOUR = 120;

/**
 * 🔴 What happens at the ceiling, and why it is not a 429.
 *
 * `EventSource` cannot see a 429. Per spec a non-200 response fails the
 * connection permanently — `readyState` goes to CLOSED and the browser does not
 * reconnect. And this hook has exactly two transports, Realtime and SSE, with
 * no polling client behind them. So rejecting the request does not degrade the
 * room; it silences it, and the guest has no way back short of a reload they
 * have no reason to perform.
 *
 * So the ceiling throttles instead of blocking: still 200, still
 * `text/event-stream`, but the stream carries a long `retry:` and closes at
 * once. The browser is happy, it waits a minute, and a two-second loop becomes
 * one connection per minute — the cost collapses while the room stays alive and
 * Realtime keeps running underneath.
 */
export const SSE_THROTTLED_RETRY_MS = 60_000;

/**
 * 🔴 K1a, the client half — who reopens the stream when the browser will not.
 *
 * The server was shaped so that IT never answers a non-200: that is the whole
 * reason the K1b ceiling throttles with a 200 instead of a 429. What it cannot
 * promise is that nothing else does. A cold instance can 500, an edge can 502,
 * a captive portal can hand back a login page, and the PA-4 429 deliberately
 * stays. Per spec every one of those closes `EventSource` PERMANENTLY —
 * readyState CLOSED, no further attempts, ever.
 *
 * `useTourRoomChannel` has exactly two transports and no polling client behind
 * them, so with realtime already down (which is why SSE is running at all) that
 * is the end of the room. Measured in a real browser, blocking the realtime
 * socket and answering /events with one 500: **1 connection attempt, 0 retries
 * in 26 seconds**, with the header still reading "Reconnecting…". The same run
 * with a transport-level abort instead of a 500 retried 9 times — the browser
 * recovers from the failure it owns and cannot see the other one.
 *
 * So the client owns it, on a curve that stays inside the budgets K1a/K1b
 * already argued for:
 *   · floor  = SSE_RECONNECT_HINT_MS  — coming back sooner than the hint the
 *     server hands out would be arguing with our own advice;
 *   · ceiling = SSE_THROTTLED_RETRY_MS — one connection a minute is the steady
 *     state K1b already declares acceptable;
 *   · jitter adds only, so the floor stays a floor while a fleet of guests
 *     coming back from one outage does not come back in lockstep.
 */
export const SSE_CLIENT_RETRY_MIN_MS = SSE_RECONNECT_HINT_MS;
export const SSE_CLIENT_RETRY_MAX_MS = SSE_THROTTLED_RETRY_MS;
const SSE_CLIENT_RETRY_GROWTH = 2;
/** Up to +25%, never negative — see above. */
export const SSE_CLIENT_RETRY_JITTER = 0.25;

/**
 * Next client-owned reconnect delay. `previous` is null for the first attempt
 * after a good connection, so a room that recovers and fails again starts over
 * at the floor rather than inheriting an hour-old backoff.
 */
export function nextReconnectDelay(previous: number | null, random: number = Math.random()): number {
  const base =
    previous === null
      ? SSE_CLIENT_RETRY_MIN_MS
      : Math.min(SSE_CLIENT_RETRY_MAX_MS, previous * SSE_CLIENT_RETRY_GROWTH);
  return Math.round(base * (1 + random * SSE_CLIENT_RETRY_JITTER));
}

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
