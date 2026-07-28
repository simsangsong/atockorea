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
  SSE_MAX_DURATION_S,
  SSE_POLL_MAX_MS,
  SSE_POLL_MIN_MS,
  SSE_RECONNECT_HINT_MS,
  SSE_STREAM_BUDGET_MS,
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
