/**
 * K3 — the ambient traffic, on the cheap path.
 *
 * 🔴 First, a correction to the plan, because acting on it would have wasted a
 * session. §J warns that K3 "touches the same file as K1a" and to watch for a
 * rebase conflict. Measured: `hooks/useTourRoomChannel.ts` last changed
 * 2026-07-20; K1a landed 2026-07-28 and touched the events route, `access.ts`,
 * and two new files. There is no shared file and no hazard.
 *
 * What K3 is actually about: `/typing` and `/read` fire on a CADENCE, not on an
 * action — typing every 2.5s while a thumb moves, read on every feed change.
 * Each was doing the full cold-start work (resolve the actor, which looks the
 * booking up; then `ensureRoom`, which looks the room up and writes when
 * absent) for a ping that changes one column.
 *
 * K1a had already built the fix for this exact shape, and only the SSE route
 * used it.
 *
 * These are source assertions. The saving is a query count inside a serverless
 * invocation, which no unit test observes; what a test CAN hold is that the
 * cheap path is the one wired up, and that the authorisation is still done per
 * request rather than cached along with the rows.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const routes = {
  typing: 'app/api/tour-rooms/[bookingId]/typing/route.ts',
  read: 'app/api/tour-rooms/[bookingId]/read/route.ts',
  events: 'app/api/tour-rooms/[bookingId]/events/route.ts',
} as const;

const src = Object.fromEntries(
  Object.entries(routes).map(([k, p]) => [k, readFileSync(path.join(process.cwd(), p), 'utf8')]),
) as Record<keyof typeof routes, string>;

describe('cadence routes use the memoised rows', () => {
  it.each(['typing', 'read'] as const)('%s resolves the booking through the cache', (name) => {
    expect(src[name]).toContain('cachedBookingForRoom(supabase, bookingId)');
    // `?? undefined` and not `?? null`: null reads as "not supplied" and sends
    // resolveRoomActor to look the booking up a second time on the 404 path.
    // The events route records this trap; repeating the bug here would undo the
    // saving and cost an extra query on exactly the failure case.
    expect(src[name]).toContain('?? undefined');
  });

  it.each(['typing', 'read'] as const)('%s ensures the room through the cache', (name) => {
    expect(src[name]).toContain('cachedEnsureRoom(');
    expect(src[name]).not.toMatch(/\bawait ensureRoom\(/);
  });

  it('🔴 the authorisation itself is still done every request', () => {
    // The cache holds ROWS, never the decision. A cached authorisation would
    // mean a revoked token kept working for fifteen seconds.
    for (const name of ['typing', 'read'] as const) {
      expect(src[name]).toContain('resolveRoomActor(req, bookingId');
    }
  });
});

describe('both cadence routes have a ceiling', () => {
  it('🔴 /read has one now — it writes, and it had none', () => {
    expect(src.read).toContain("namespace: 'tour_room_read'");
  });

  it('/typing keeps the one it had', () => {
    expect(src.typing).toContain("namespace: 'tour_room_typing'");
  });

  it('neither answers 429 on the cadence path', () => {
    // A read cursor is bookkeeping. A guest whose checkmark is a few seconds
    // stale has lost nothing, and a 429 would surface as an error they cannot
    // act on. Same reasoning as K1b's throttle on the SSE route.
    const over = src.read.slice(src.read.indexOf("namespace: 'tour_room_read'"));
    expect(over.slice(0, 500)).toContain('status: 200');
  });

  it('the read ceiling sits above a healthy client', () => {
    // The client throttles reads to one per 3s = 20/min. 60 is a wide margin
    // over that and still bounded for a client that is not healthy.
    const perMinute = Number(
      /namespace: 'tour_room_read'[\s\S]{0,200}?perMinute:\s*(\d+)/.exec(src.read)?.[1],
    );
    const HEALTHY_PER_MINUTE = 60_000 / 3_000;
    expect(perMinute).toBeGreaterThan(HEALTHY_PER_MINUTE * 2);
  });
});

describe('the plan claim this corrects', () => {
  it('K1a did not touch the channel hook', () => {
    // Asserted so the correction survives in a place someone runs, not only in
    // a comment. If a future change DOES make the hook part of this area, this
    // test failing is the right way to find out.
    const hook = readFileSync(path.join(process.cwd(), 'hooks/useTourRoomChannel.ts'), 'utf8');
    expect(hook).not.toContain('reconnectCache');
    expect(hook).not.toContain('SSE_STREAM_BUDGET_MS');
  });

  it('the events route is where K1a landed', () => {
    expect(src.events).toContain('cachedEnsureRoom(');
    expect(src.events).toContain('SSE_STREAM_BUDGET_MS');
  });
});
