/**
 * @jest-environment node
 *
 * 🔴 FA-003 (full-app audit 2026-07-30) — the server ladder nothing measured.
 *
 * SG-2's completion ledger claims "서버 사다리 5단 게이트 ④ 유닛". The ladder is
 * real — 226 lines in `signals/route.ts` — and the 2nd audit raised the defect
 * it defends against (a client firing rally outcomes with no server check) to
 * P0. But the only rally assertion in `tour-rooms-signals.test.ts` was the
 * `rally_overdue` dedupe, and none of `rally_remind`, `reminder_window_passed`,
 * `outside_departed_window`, `manual_departed` or `rally_resolution` appeared
 * anywhere under `__tests__/`. The pure-function suite
 * (`rallyResolution.test.ts`) covers the promotion rules, not the route.
 *
 * So this drives POST /signals for every rung. What each case pins:
 *
 *   ① the notice id is a CLAIM — a wrong id, a backdated notice and a cancelled
 *      one are rejected before anything is written
 *   ② T-10 reminders cannot fire after the target has passed
 *   ③ all_aboard / extended are staff-only, and extended needs its successor
 *   ④ every outcome lands on ONE subject and ONE event type, because the UNIQUE
 *      index is (room, subject, type) — a second type would resurrect the TOCTOU
 *   ⑤ departed outside its window is refused, a superseded notice dissolves to
 *      204, and a manual declaration is staff-only but may still fire a capsule
 *      after a mistaken all_aboard (the capsule has its own subject)
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as signalsPOST } from '@/app/api/tour-rooms/[bookingId]/signals/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { RALLY_GRACE_MS, RALLY_FIRE_WINDOW_MS } from '@/lib/tour-room/notices';
import { RALLY_LATE_SLACK_MS } from '@/lib/tour-room/rallyCrossing';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/events', () => ({
  recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })),
}));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/guestPush', () => ({
  sendGuestRoomPush: jest.fn(async () => ({ sent: 0, pruned: 0 })),
  sendDriverRoomPush: jest.fn(async () => ({ sent: 0, pruned: 0 })),
}));
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(async (text: string) => ({
    source_locale: 'en',
    translations: { en: text, ko: `[ko] ${text}`, ja: `[ja] ${text}`, es: `[es] ${text}`, zh: `[zh] ${text}` },
  })),
}));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));
jest.mock('@/lib/tour-ops/push', () => ({
  sendOpsPush: jest.fn(async () => ({ sent: 0, pruned: 0 })),
  isGonePushStatus: jest.fn(() => false),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;

const TOUR_DATE = '2026-07-14';
/** 10:00 KST on the tour date — the meeting target every case is relative to. */
const TARGET_MS = Date.UTC(2026, 6, 14, 1, 0, 0);
const NOTICE_ID = 'notice-1';

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: TOUR_DATE,
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ko',
};

interface NoticeOptions {
  /** Absent row → the claimed notice does not exist. */
  missing?: boolean;
  cancelled?: boolean;
  /** Created AFTER its own target — the typo case. */
  backdated?: boolean;
  /** A newer notice exists, so this crossing is stale. */
  superseded?: boolean;
  kind?: string;
}

function fakeDb(opts: NoticeOptions = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const noticeRow = opts.missing
    ? null
    : {
        id: NOTICE_ID,
        created_at: new Date(opts.backdated ? TARGET_MS + 60_000 : TARGET_MS - 30 * 60_000).toISOString(),
        metadata: {
          kind: opts.kind ?? 'meeting_notice',
          meeting_time: '10:00',
          meeting_point: '주차장 입구',
          ...(opts.cancelled ? { cancelled: true } : {}),
        },
      };

  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      let isSupersedeQuery = false;
      for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      // `rallyNoticeSuperseded` is the only caller that uses .gt()/.in().
      chain.gt = jest.fn(() => {
        isSupersedeQuery = true;
        return chain;
      });
      chain.in = jest.fn(() => chain);
      chain.then = (res: (v: unknown) => unknown) => {
        const rows =
          isSupersedeQuery && opts.superseded
            ? [{ id: 'notice-2', created_at: new Date(TARGET_MS).toISOString(), metadata: { kind: 'meeting_notice' } }]
            : [];
        return Promise.resolve({ data: rows, error: null }).then(res);
      };
      const resolve = async () =>
        table === 'bookings'
          ? { data: { ...BOOKING }, error: null }
          : table === 'tours'
            ? { data: { price_type: 'private' }, error: null }
            : table === 'tour_room_messages'
              ? { data: noticeRow, error: null }
              : { data: null, error: null };
      chain.single = jest.fn(resolve);
      chain.maybeSingle = jest.fn(resolve);
      chain.upsert = jest.fn(() => ({
        select: () => ({
          single: async () => ({ data: { id: 'room-1', booking_id: 'booking-1', status: 'active' }, error: null }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-1`, ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(input?: { headers?: Record<string, string>; json?: unknown }) {
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
  } as never;
}

const routeParams = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });

const session = (role: 'customer' | 'driver' | 'guide', participantId = 'p-1') =>
  signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId, role, displayName: 'Alex' }).session;

/** Runs the route at a chosen wall clock. */
async function fire(
  body: Record<string, unknown>,
  opts: { role?: 'customer' | 'driver' | 'guide'; nowMs?: number; db?: ReturnType<typeof fakeDb> } = {},
) {
  const db = opts.db ?? fakeDb();
  createServerClientMock.mockReturnValue(db);
  const nowMs = opts.nowMs ?? TARGET_MS - 5 * 60_000;
  // ⚠ An undefined constant makes this NaN, every session then fails to verify,
  // and every case returns 403 "Access denied" — which reads like a permission
  // bug in the route. It happened while writing this suite: RALLY_GRACE_MS is
  // exported from `notices`, not `rallyCrossing`. Fail on the arithmetic, not
  // three screens later.
  if (!Number.isFinite(nowMs)) throw new Error(`test clock is not a number: ${nowMs}`);
  jest.spyOn(Date, 'now').mockReturnValue(nowMs);
  const res = await signalsPOST(
    fakeReq({ headers: { 'x-tour-room-auth': session(opts.role ?? 'customer') }, json: body }),
    routeParams(),
  );
  return { res, db };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore?.();
});

describe('FA-003 ①–③ — the claimed notice is re-derived, never trusted', () => {
  it('🔴 a noticeId is required at all', async () => {
    const { res } = await fire({ type: 'rally_remind' });
    expect(res.status).toBe(400);
    expect(recordRoomEventMock).not.toHaveBeenCalled();
  });

  it('🔴 an unknown notice id is refused (404) and writes nothing', async () => {
    const { res, db } = await fire(
      { type: 'rally_remind', noticeId: NOTICE_ID },
      { db: fakeDb({ missing: true }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'notice_not_found' });
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it('🔴 a backdated notice — created after its own target — is refused (422)', async () => {
    const { res } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID },
      { db: fakeDb({ backdated: true }), nowMs: TARGET_MS + RALLY_GRACE_MS + 1000 },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'notice_backdated' });
  });

  it('🔴 a cancelled notice is refused (409)', async () => {
    const { res } = await fire({ type: 'rally_remind', noticeId: NOTICE_ID }, { db: fakeDb({ cancelled: true }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'notice_cancelled' });
  });

  it('🔴 a message that is not a notice kind cannot be claimed as one', async () => {
    const { res } = await fire(
      { type: 'rally_remind', noticeId: NOTICE_ID },
      { db: fakeDb({ kind: 'guest_rest_stop' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('FA-003 ② — the T-10 reminder window', () => {
  it('🔴 fires before the target, on its own subject, exactly once', async () => {
    const { res } = await fire({ type: 'rally_remind', noticeId: NOTICE_ID });
    expect(res.status).toBe(201);
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rally_stage', subjectKey: `rally:${NOTICE_ID}:remind` }),
    );

    recordRoomEventMock.mockResolvedValueOnce({ inserted: false, event: null });
    const again = await fire({ type: 'rally_remind', noticeId: NOTICE_ID });
    expect(again.res.status).toBe(200);
    expect(await again.res.json()).toMatchObject({ deduped: true });
  });

  it('🔴 is refused once the target has passed (reminder_window_passed)', async () => {
    const { res } = await fire({ type: 'rally_remind', noticeId: NOTICE_ID }, { nowMs: TARGET_MS + 1000 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'reminder_window_passed' });
  });
});

describe('FA-003 ③④ — resolutions are staff-only and share ONE subject and type', () => {
  it('🔴 a guest cannot declare all aboard', async () => {
    const { res } = await fire({ type: 'rally_all_aboard', noticeId: NOTICE_ID }, { role: 'customer' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'staff_only' });
  });

  it.each(['driver', 'guide'] as const)('%s may, and it lands on the resolution subject', async (role) => {
    const { res } = await fire({ type: 'rally_all_aboard', noticeId: NOTICE_ID }, { role });
    expect(res.status).toBe(201);
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'rally_resolution',
        subjectKey: `rally:${NOTICE_ID}:resolution`,
        payload: expect.objectContaining({ outcome: 'all_aboard' }),
      }),
    );
  });

  it('🔴 extended requires its successor notice', async () => {
    const { res } = await fire({ type: 'rally_extended', noticeId: NOTICE_ID }, { role: 'guide' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'next_notice_id is required' });
  });

  it('🔴 extended carries the successor and uses the SAME type as all_aboard', async () => {
    const { res } = await fire(
      { type: 'rally_extended', noticeId: NOTICE_ID, next_notice_id: 'notice-2' },
      { role: 'guide' },
    );
    expect(res.status).toBe(201);
    const call = recordRoomEventMock.mock.calls.find(
      ([, arg]) => (arg as { subjectKey?: string }).subjectKey === `rally:${NOTICE_ID}:resolution`,
    );
    expect(call).toBeDefined();
    // The UNIQUE index is (room, subject, type). A different type per outcome
    // would let two outcomes both insert — the TOCTOU this design removed.
    expect((call![1] as { type: string }).type).toBe('rally_resolution');
    expect((call![1] as { payload: Record<string, unknown> }).payload).toMatchObject({
      outcome: 'extended',
      next_notice_id: 'notice-2',
    });
  });

  it('🔴 a resolution that lost the race produces no capsule', async () => {
    // departed arrives after all_aboard already claimed the resolution subject.
    recordRoomEventMock.mockResolvedValueOnce({ inserted: false, event: null });
    const { res, db } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID },
      { nowMs: TARGET_MS + RALLY_GRACE_MS + 1000 },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deduped: true });
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });
});

describe('FA-003 ⑤ — the departed window, supersede, and manual declarations', () => {
  it('🔴 too early is refused (outside_departed_window)', async () => {
    const { res } = await fire({ type: 'rally_departed', noticeId: NOTICE_ID }, { nowMs: TARGET_MS - 60_000 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'outside_departed_window' });
  });

  it('🔴 too late is refused too — the window has both edges', async () => {
    const { res } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID },
      // The late edge is GRACE + FIRE_WINDOW + LATE_SLACK (26 min past target),
      // not GRACE + LATE_SLACK — the first draft of this case forgot the firing
      // window and called a legitimate 201 a bug.
      { nowMs: TARGET_MS + RALLY_GRACE_MS + RALLY_FIRE_WINDOW_MS + RALLY_LATE_SLACK_MS + 60_000 },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'outside_departed_window' });
  });

  it('🔴 inside the window it fires the capsule on its own subject', async () => {
    const { res, db } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID },
      { nowMs: TARGET_MS + RALLY_GRACE_MS + 1000 },
    );
    if (res.status !== 201) console.log('PROBE body:', JSON.stringify(await res.json()));
    expect(res.status).toBe(201);
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'wait_ended', subjectKey: `rally:${NOTICE_ID}:capsule` }),
    );
    expect(db.inserts.tour_room_messages).toHaveLength(1);
  });

  it('🔴 a superseded notice dissolves silently (204), not into a capsule', async () => {
    const { res, db } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID },
      { db: fakeDb({ superseded: true }), nowMs: TARGET_MS + RALLY_GRACE_MS + 1000 },
    );
    expect(res.status).toBe(204);
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it('🔴 a manual departure is staff-only', async () => {
    const { res } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID, manual: true },
      { role: 'customer', nowMs: TARGET_MS - 60_000 },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'staff_only' });
  });

  it('🔴 staff may declare manually outside the automatic window, on its own subject', async () => {
    const { res } = await fire(
      { type: 'rally_departed', noticeId: NOTICE_ID, manual: true },
      { role: 'driver', nowMs: TARGET_MS + 60 * 60_000 },
    );
    expect(res.status).toBe(201);
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rally_stage', subjectKey: `rally:${NOTICE_ID}:manual_departed` }),
    );
    // The capsule subject is separate ON PURPOSE: a manual declaration after a
    // mistaken [전원 탑승] must still be able to fire exactly one capsule.
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subjectKey: `rally:${NOTICE_ID}:capsule` }),
    );
  });
});

describe('FA-003 — the crossing has its own rate namespace', () => {
  it('🔴 does not spend the guest-signal bucket', async () => {
    await fire({ type: 'rally_remind', noticeId: NOTICE_ID });
    const namespaces = requestGateMock.mock.calls.map(([opts]) => opts.namespace as string);
    expect(namespaces).toContain('tour_room_rally_crossing');
    expect(namespaces).not.toContain('tour_room_signal');
  });

  it('🔴 a refused gate answers 429 with Retry-After and writes nothing', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 12_000 });
    const { res, db } = await fire({ type: 'rally_remind', noticeId: NOTICE_ID });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });
});
