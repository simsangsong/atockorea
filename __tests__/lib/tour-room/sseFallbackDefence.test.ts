/**
 * K1a — the SSE fallback's defences, asserted where they are cheap to assert.
 *
 * Part K's finding, restated: a ceiling on realtime concurrency was being
 * converted into UNBOUNDED load of two other kinds. Every client that got pushed
 * off realtime opened a serverless function that polled the database twice a
 * second, and because the platform killed that function on its default duration,
 * `EventSource` reconnected and re-ran the whole authorisation path — so the
 * per-guest cost was "a query every 2s PLUS a set of auth queries per function
 * lifetime". None of that needs 100 rooms; one realtime wobble starts it.
 *
 * These tests pin the three things K1a changed. They do not simulate a
 * 55-second stream: the substance is the backoff curve, the declared duration
 * and what the cache will and will not hold, and asserting those directly is
 * more honest than asserting them through a mocked clock.
 */
import { readFileSync } from 'fs';
import path from 'path';
import {
  nextPollInterval,
  nextReconnectDelay,
  SSE_CLIENT_RETRY_MAX_MS,
  SSE_CLIENT_RETRY_MIN_MS,
  SSE_MAX_DURATION_S,
  SSE_POLL_MAX_MS,
  SSE_POLL_MIN_MS,
  SSE_RECONNECT_HINT_MS,
  SSE_STARTS_PER_HOUR,
  SSE_STARTS_PER_MINUTE,
  SSE_STREAM_BUDGET_MS,
  SSE_THROTTLED_RETRY_MS,
} from '@/lib/tour-room/sseFallback';
import {
  cachedBookingForRoom,
  cachedEnsureRoom,
  __resetReconnectCache,
  RECONNECT_CACHE_TTL_MS,
} from '@/lib/tour-room/reconnectCache';

describe('K1a — poll backoff', () => {
  it('starts fast', () => {
    expect(SSE_POLL_MIN_MS).toBe(2_000);
  });

  it('backs off while the room is quiet, and stops at a ceiling', () => {
    const seen: number[] = [];
    let interval = SSE_POLL_MIN_MS;
    for (let i = 0; i < 8; i += 1) {
      interval = nextPollInterval(interval, 0);
      seen.push(interval);
    }
    expect(seen[0]).toBeGreaterThan(SSE_POLL_MIN_MS);
    expect(Math.max(...seen)).toBe(SSE_POLL_MAX_MS);
    // Monotonic — a backoff that oscillates is a backoff nobody can reason about.
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it('🔴 snaps back to the fast interval the moment a message arrives', () => {
    // Conversation is bursty. Easing back down would mean the second message of
    // an exchange waits longer than the first, which is the opposite of useful.
    expect(nextPollInterval(SSE_POLL_MAX_MS, 1)).toBe(SSE_POLL_MIN_MS);
  });

  it('an idle stream costs a fraction of what it used to', () => {
    // Old behaviour: a fixed 2s poll, so 55s of stream = 27 queries.
    const before = Math.floor(SSE_STREAM_BUDGET_MS / 2_000);
    let elapsed = 0;
    let interval = SSE_POLL_MIN_MS;
    let polls = 0;
    while (elapsed < SSE_STREAM_BUDGET_MS) {
      polls += 1;
      interval = nextPollInterval(interval, 0);
      elapsed += interval;
    }
    expect(polls).toBeLessThan(before / 2);
  });
});

/**
 * K1a, the client half. The server was shaped so it never answers a non-200 —
 * that is why the K1b ceiling throttles with a 200 — but it cannot promise the
 * same for a cold-start 500, an edge 502, a captive portal, or the PA-4 429
 * that deliberately stays. Any of those closes `EventSource` permanently, and
 * with realtime already down there is no third transport behind it.
 *
 * Measured in a real browser (`scripts/qa-sse-reconnect.ts`), realtime blocked:
 * a transport abort retried 9 times in 26s; one 500 produced 1 attempt and
 * 0 retries in the same window, with the header still reading "Reconnecting…".
 */
describe('K1a — the client-owned reopen', () => {
  it('🔴 first retry waits at least as long as the hint the server hands out', () => {
    // Coming back sooner than our own advice would be arguing with it.
    expect(nextReconnectDelay(null, 0)).toBe(SSE_RECONNECT_HINT_MS);
    expect(SSE_CLIENT_RETRY_MIN_MS).toBe(SSE_RECONNECT_HINT_MS);
  });

  it('backs off and stops at the steady state K1b already calls acceptable', () => {
    let delay: number | null = null;
    const seen: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      delay = nextReconnectDelay(delay, 0);
      seen.push(delay);
    }
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(Math.max(...seen)).toBe(SSE_CLIENT_RETRY_MAX_MS);
    expect(SSE_CLIENT_RETRY_MAX_MS).toBe(SSE_THROTTLED_RETRY_MS);
  });

  it('jitter only ever adds, so the floor stays a floor', () => {
    // A fleet of guests comes off one outage together; spreading them matters.
    // Spreading them EARLIER would undo the floor, so the jitter is one-sided.
    for (const r of [0, 0.5, 1]) {
      expect(nextReconnectDelay(null, r)).toBeGreaterThanOrEqual(SSE_CLIENT_RETRY_MIN_MS);
    }
    expect(nextReconnectDelay(null, 1)).toBeGreaterThan(nextReconnectDelay(null, 0));
  });

  it('a good connection retires the curve rather than inheriting it', () => {
    // `previous === null` is what the open handler restores. Without it a room
    // that recovered at noon and failed again at five would start at the ceiling.
    expect(nextReconnectDelay(SSE_CLIENT_RETRY_MAX_MS, 0)).toBe(SSE_CLIENT_RETRY_MAX_MS);
    expect(nextReconnectDelay(null, 0)).toBe(SSE_CLIENT_RETRY_MIN_MS);
  });

  it('recovers slower than a browser would, so recovery is not the new load', () => {
    // Chromium retries a transport failure about every 3s. Ours is deliberately
    // the slower of the two: this path exists for a server that is already hurt.
    expect(SSE_CLIENT_RETRY_MIN_MS).toBeGreaterThan(3_000);
  });
});

describe('K1a — function lifetime', () => {
  it('declares a duration instead of letting the platform pick one', () => {
    expect(SSE_MAX_DURATION_S).toBe(60);
  });

  it('ends the loop before the platform would, so the function exits normally', () => {
    expect(SSE_STREAM_BUDGET_MS).toBeLessThan(SSE_MAX_DURATION_S * 1000);
  });

  it('tells the browser to wait longer than its default before reconnecting', () => {
    // The default is ~3s. When realtime fails for everyone at once, every client
    // comes back at once; the hint is what keeps that from being a stampede.
    expect(SSE_RECONNECT_HINT_MS).toBeGreaterThan(3_000);
  });
});

describe('K1a — reconnect cache', () => {
  const booking = { id: 'b1', tour_id: 't1', tour_date: '2026-07-28' };

  beforeEach(() => __resetReconnectCache());

  function bookingClient(calls: { n: number }) {
    return {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => {
                    calls.n += 1;
                    return { data: booking, error: null };
                  },
                };
              },
            };
          },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it('serves a reconnect from memory instead of the database', async () => {
    const calls = { n: 0 };
    const client = bookingClient(calls);
    await cachedBookingForRoom(client, 'b1');
    await cachedBookingForRoom(client, 'b1');
    await cachedBookingForRoom(client, 'b1');
    expect(calls.n).toBe(1);
  });

  it('expires, so an ops date change lands within seconds', async () => {
    const calls = { n: 0 };
    const client = bookingClient(calls);
    const t0 = 1_000_000;
    await cachedBookingForRoom(client, 'b1', t0);
    await cachedBookingForRoom(client, 'b1', t0 + RECONNECT_CACHE_TTL_MS + 1);
    expect(calls.n).toBe(2);
  });

  it('does not cache a miss — a booking that does not exist yet may appear', async () => {
    const calls = { n: 0 };
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              calls.n += 1;
              return { data: null, error: { message: 'nope' } };
            },
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await cachedBookingForRoom(client, 'ghost');
    await cachedBookingForRoom(client, 'ghost');
    expect(calls.n).toBe(2);
  });

  it('🔴 keys the room by the booking fields it denormalises', async () => {
    // ensureRoom repairs the room when tour_id/tour_date drift. If the cache key
    // ignored those, a moved booking would keep serving the pre-move room for
    // the life of the entry — i.e. the cache would defeat the repair.
    const calls = { n: 0 };
    const stored = { id: 'r1', booking_id: 'b1', tour_id: 't1', tour_date: '2026-07-28' };
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              calls.n += 1;
              return { data: stored, error: null };
            },
          }),
        }),
        // The drift-repair path ensureRoom takes when the booking has moved.
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: { ...stored, ...patch }, error: null }),
            }),
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await cachedEnsureRoom(client, booking);
    await cachedEnsureRoom(client, booking);
    expect(calls.n).toBe(1);
    await cachedEnsureRoom(client, { ...booking, tour_date: '2026-07-29' });
    expect(calls.n).toBe(2);
  });
});

describe('K1a — the declared duration is a literal in the route', () => {
  it('🔴 route and lib agree, and the route says a number out loud', () => {
    // Next.js parses segment config statically, so `export const maxDuration =
    // SSE_MAX_DURATION_S` is not a runtime concern — it fails the build with
    // "Unknown identifier … at maxDuration", which is how it broke the
    // production deploy on 2026-07-28. The literal is therefore duplicated on
    // purpose, and this is what keeps the duplicate honest.
    const source = readFileSync(
      path.join(process.cwd(), 'app', 'api', 'tour-rooms', '[bookingId]', 'events', 'route.ts'),
      'utf8',
    );
    const declared = /export const maxDuration = (\d+);/.exec(source);
    expect(declared).not.toBeNull();
    expect(Number(declared![1])).toBe(SSE_MAX_DURATION_S);
    // And no identifier form sneaks back in. Only lines that are actually code
    // are considered: the doc comment above the export quotes the broken form
    // on purpose, and a check that cannot tell code from prose fails on its own
    // explanation — which is exactly what the first version of this line did.
    const codeLines = source
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');
    expect(codeLines).not.toMatch(/export const maxDuration = [A-Za-z_]/);
  });
});

/**
 * K1b — the ceiling on stream starts.
 *
 * K1a taught OUR client to reconnect politely. It could do nothing about a
 * client we do not control, and the server had no ceiling at all: the PA-4 gate
 * fires only on the guest email/name path, so every token-bearing guest — which
 * is every invite link — reached the stream with nothing counting.
 *
 * 🔴 The design constraint that shaped this, and the one worth remembering:
 * `EventSource` cannot see a 429. A non-200 response fails the connection
 * PERMANENTLY per spec — readyState goes to CLOSED and the browser never
 * retries. `useTourRoomChannel` has exactly two transports, Realtime and SSE,
 * with no polling client behind them, so rejecting the request does not degrade
 * the room. It silences it, with no way back short of a reload the guest has no
 * reason to perform.
 */
describe('K1b — the stream-start ceiling throttles rather than blocks', () => {
  const routeSrc = readFileSync(
    path.join(process.cwd(), 'app/api/tour-rooms/[bookingId]/events/route.ts'),
    'utf8',
  );

  it('🔴 the ceiling itself never answers a non-200', () => {
    // The whole point. A status here is a dead room, not a slower one.
    const block = routeSrc.slice(
      routeSrc.indexOf("namespace: 'tour_room_sse_start'"),
      routeSrc.indexOf('cachedEnsureRoom('),
    );
    expect(block).not.toMatch(/status:\s*\d/);
    // It is a normal event-stream, so the browser keeps its reconnect behaviour
    // instead of giving up.
    expect(block).toContain("'Content-Type': 'text/event-stream; charset=utf-8'");
  });

  it('leaves exactly one 429 behind, on the path that is not a stream yet', () => {
    // PA-4's 429 predates this and stays: it fires before any stream exists,
    // on an unauthenticated email/name guess. Killing EventSource there is the
    // correct outcome — that request should not become a stream at all.
    //
    // Asserted as a count so a future 429 added INSIDE the streaming path shows
    // up here rather than as a room that quietly stops updating.
    expect(routeSrc.match(/status:\s*429/g) ?? []).toHaveLength(1);
    const at = routeSrc.indexOf('status: 429');
    expect(at).toBeLessThan(routeSrc.indexOf("namespace: 'tour_room_sse_start'"));
  });

  it('sends the long retry hint before anything else', () => {
    // A hint that arrives after the close is a hint nobody read.
    expect(routeSrc).toContain('retry: ${SSE_THROTTLED_RETRY_MS}');
    const hintAt = routeSrc.indexOf('retry: ${SSE_THROTTLED_RETRY_MS}');
    expect(routeSrc.slice(hintAt, hintAt + 60)).toContain(': throttled');
  });

  it('collapses a two-second loop to one connection a minute', () => {
    // The failure this exists for, in numbers rather than adjectives.
    const loopStartsPerMinute = 60 / 2;
    expect(loopStartsPerMinute).toBeGreaterThan(SSE_STARTS_PER_MINUTE);
    const throttledStartsPerMinute = 60_000 / SSE_THROTTLED_RETRY_MS;
    expect(throttledStartsPerMinute).toBe(1);
  });

  it('leaves a healthy client, and a household of them, well clear', () => {
    // One start per stream budget per device. Four devices on one booking is a
    // family sharing a link, not an attack.
    const startsPerMinutePerDevice = 60_000 / SSE_STREAM_BUDGET_MS;
    expect(startsPerMinutePerDevice * 4).toBeLessThan(SSE_STARTS_PER_MINUTE);
  });

  it('gives an hour of healthy use room too', () => {
    const startsPerHourPerDevice = 3_600_000 / SSE_STREAM_BUDGET_MS;
    expect(startsPerHourPerDevice).toBeLessThan(SSE_STARTS_PER_HOUR);
  });

  it('counts per booking AND per client, not per client alone', () => {
    // A coach with twelve guests behind one hotel NAT is not a loop.
    expect(routeSrc).toMatch(/key: `\$\{bookingId\}:\$\{clientIpKey\(req\.headers\)\}`/);
  });

  it('applies to every actor, unlike the PA-4 gate it sits beside', () => {
    // PA-4 is passed as a callback into resolveRoomActor and only fires on the
    // guest email path. This one is called directly, after resolution, so no
    // credential can skip it.
    const gateAt = routeSrc.indexOf("namespace: 'tour_room_sse_start'");
    const resolveAt = routeSrc.indexOf('resolveRoomActor(');
    expect(gateAt).toBeGreaterThan(resolveAt);
  });

  it('throttles before doing the expensive work', () => {
    // Ahead of ensureRoom, which is a write path. A throttled request must not
    // pay for what it is being throttled out of.
    const gateAt = routeSrc.indexOf("namespace: 'tour_room_sse_start'");
    const ensureAt = routeSrc.indexOf('cachedEnsureRoom(');
    expect(gateAt).toBeLessThan(ensureAt);
  });
});
