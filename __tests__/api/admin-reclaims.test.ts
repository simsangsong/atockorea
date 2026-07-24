/**
 * @jest-environment node
 *
 * §5.2 C-5 재claim 승인 큐 API — 탈취 방지 흐름.
 *
 * 검증 대상은 "승인이 실제로 기존 기기를 끊는가"다:
 *   · 승인 → tour_room_invites.revoked_at 로 기존 customer 토큰 전부 폐기
 *     (병렬 폐기 기구를 만들지 않는다 — access.ts가 검사하는 그 컬럼이다),
 *   · participant.device_key를 요청 기기로 이전(행은 유지 — 메시지·좌석 참조),
 *   · 새 개인 토큰 발급 + 원장 1행 + tour_room_events 감사 1행,
 *   · confirm 없이는 아무것도 일어나지 않고, 재승인도 막힌다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/admin/tour-ops/reclaims/route';
import { POST } from '@/app/api/admin/tour-ops/reclaims/decision/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { RECLAIM_APPROVED, RECLAIM_REQUESTED, reclaimSubjectKey } from '@/lib/ops/reclaim';

jest.mock('@/lib/auth', () => {
  const { NextResponse } = require('next/server');
  class AdminAuthFailure extends Error {
    status: number;
    code: string;
    constructor(status: number, message: string, code = 'AUTH') {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    requireAdmin: jest.fn(),
    AdminAuthFailure,
    adminAuthJsonResponse: (e: { code: string; message: string; status: number }) =>
      NextResponse.json({ ok: false, code: e.code, message: e.message }, { status: e.status }),
  };
});
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/events', () => ({
  recordRoomEvent: jest.fn(async () => ({ inserted: true, event: { id: 'evt-1' } })),
}));
jest.mock('@/lib/tour-ops/push', () => ({ sendOpsPush: jest.fn(async () => ({ sent: 0, pruned: 0 })) }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn(async () => 'data:image/png;base64,qr') }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;
const sendOpsPushMock = sendOpsPush as jest.Mock;

const ROOM_ID = 'room-1';
const BOOKING = '11111111-1111-4111-8111-111111111111';
const DEVICE_OLD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_NEW = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** 투어일은 항상 미래여야 한다 — 토큰 만료가 tour_date 기준이라 픽스처가 썩는다. */
function futureTourDate(): string {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

type Op = [string, unknown[]];

function makeDb(options: {
  events?: Array<Record<string, unknown>>;
  participants?: Array<Record<string, unknown>>;
  booking?: Record<string, unknown> | null;
  revokedRows?: Array<Record<string, unknown>>;
}) {
  const updates: Array<{ table: string; values: Record<string, unknown>; ops: Op[] }> = [];
  const inserts: Array<{ table: string; values: unknown }> = [];
  const client = {
    updates,
    inserts,
    from(table: string) {
      const state = { mode: 'select', values: undefined as unknown, ops: [] as Op[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      const record = (name: string) => (...args: unknown[]) => {
        state.ops.push([name, args]);
        return chain;
      };
      chain.select = record('select');
      for (const name of ['eq', 'in', 'is', 'gte', 'neq', 'order', 'limit']) chain[name] = record(name);
      chain.update = (values: Record<string, unknown>) => {
        state.mode = 'update';
        state.values = values;
        return chain;
      };
      chain.insert = (values: unknown) => {
        state.mode = 'insert';
        state.values = values;
        return chain;
      };
      chain.delete = () => {
        state.mode = 'delete';
        return chain;
      };
      const resolve = async (): Promise<{ data: unknown; error: unknown }> => {
        if (state.mode === 'update') {
          updates.push({ table, values: state.values as Record<string, unknown>, ops: state.ops });
          return {
            data: table === 'tour_room_invites' ? options.revokedRows ?? [{ id: 'inv-1' }] : null,
            error: null,
          };
        }
        if (state.mode === 'insert') {
          inserts.push({ table, values: state.values });
          return { data: { id: 'new' }, error: null };
        }
        switch (table) {
          case 'tour_room_events':
            return { data: options.events ?? [], error: null };
          case 'tour_room_participants':
            return { data: options.participants ?? [], error: null };
          case 'bookings':
            return {
              data:
                options.booking === null
                  ? []
                  : [
                      options.booking ?? {
                        id: BOOKING,
                        contact_name: 'Massimo Colombo',
                        number_of_guests: 2,
                        tour_id: 'tour-1',
                        tour_date: futureTourDate(),
                      },
                    ],
              error: null,
            };
          case 'tours':
            return { data: [{ id: 'tour-1', title: '성산 일출' }], error: null };
          default:
            return { data: [], error: null };
        }
      };
      chain.maybeSingle = async () => {
        const res = await resolve();
        return { data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: res.error };
      };
      chain.single = chain.maybeSingle;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain.then = (ok: any, err: any) => resolve().then(ok, err);
      return chain;
    },
  };
  return client;
}

const requestEvent = (deviceKey = DEVICE_NEW, createdAt = '2026-07-24T01:00:00Z') => ({
  id: `req-${deviceKey}`,
  room_id: ROOM_ID,
  booking_id: BOOKING,
  type: RECLAIM_REQUESTED,
  actor_role: 'system',
  subject_key: reclaimSubjectKey(BOOKING, deviceKey),
  payload: { device_key: deviceKey },
  created_at: createdAt,
});

const incumbent = (over: Record<string, unknown> = {}) => ({
  id: 'p-1',
  room_id: ROOM_ID,
  booking_id: BOOKING,
  device_key: DEVICE_OLD,
  display_name: 'Massimo C.',
  locale: 'en',
  is_lead: true,
  created_at: '2026-07-20T00:00:00Z',
  last_seen_at: '2026-07-24T00:00:00Z',
  ...over,
});

function req({ search = '', body }: { search?: string; body?: unknown } = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
    json: async () => body,
  } as never;
}

const approveBody = (over: Record<string, unknown> = {}) => ({
  room_id: ROOM_ID,
  booking_id: BOOKING,
  device_key: DEVICE_NEW,
  decision: 'approve',
  confirm: true,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1', email: 'ops@atockorea.com' });
  recordRoomEventMock.mockResolvedValue({ inserted: true, event: { id: 'evt-1' } });
  createServerClientMock.mockReturnValue(makeDb({ events: [requestEvent()], participants: [incumbent()] }));
});

describe('auth', () => {
  it('propagates the admin auth failure', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(403, 'no', 'FORBIDDEN'));
    expect((await GET(req())).status).toBe(403);
    expect((await POST(req({ body: approveBody() }))).status).toBe(403);
  });
});

describe('GET — 큐', () => {
  it('lists pending requests with masked devices and no raw contact data', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_count).toBe(1);
    const row = json.data[0];
    expect(row.status).toBe('pending');
    expect(row.guest_name).toBe('Massimo C.');
    expect(row.device_key_masked).toBe('bbbbbbbb…bbbb');
    expect(row.current_device_masked).toBe('aaaaaaaa…aaaa');
    expect(row.tour_title).toBe('성산 일출');
    expect(JSON.stringify(row)).not.toContain('Colombo');
  });

  it('hides decided requests unless status=all is asked for', async () => {
    const decided = {
      ...requestEvent(),
      id: 'dec-1',
      type: RECLAIM_APPROVED,
      created_at: '2026-07-24T02:00:00Z',
      payload: { revoked_token_count: 2 },
    };
    createServerClientMock.mockReturnValue(
      makeDb({ events: [requestEvent(), decided], participants: [incumbent()] }),
    );
    expect((await (await GET(req())).json()).data).toHaveLength(0);
    const all = await (await GET(req({ search: 'status=all' }))).json();
    expect(all.data[0].status).toBe('approved');
  });
});

describe('POST — 판정 게이트 (기본은 아무것도 승인되지 않는다)', () => {
  it('rejects a malformed body', async () => {
    expect((await POST(req({ body: { decision: 'approve' } }))).status).toBe(400);
    expect(
      (await POST(req({ body: approveBody({ device_key: 'not-a-uuid' }) }))).status,
    ).toBe(400);
    expect((await POST(req({ body: approveBody({ decision: 'maybe' }) }))).status).toBe(400);
  });

  it('refuses without confirm — nothing is written', async () => {
    const client = makeDb({ events: [requestEvent()], participants: [incumbent()] });
    createServerClientMock.mockReturnValue(client);
    const res = await POST(req({ body: approveBody({ confirm: false }) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('confirm_required');
    expect(client.updates).toHaveLength(0);
    expect(client.inserts).toHaveLength(0);
    expect(recordRoomEventMock).not.toHaveBeenCalled();
  });

  it('404s a device that never requested (no token minting path)', async () => {
    const res = await POST(
      req({ body: approveBody({ device_key: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }) }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('reclaim_not_found');
  });

  it('409s a request that was already decided (no re-mint)', async () => {
    const decided = {
      ...requestEvent(),
      id: 'dec-1',
      type: RECLAIM_APPROVED,
      created_at: '2026-07-24T02:00:00Z',
      payload: {},
    };
    createServerClientMock.mockReturnValue(
      makeDb({ events: [requestEvent(), decided], participants: [incumbent()] }),
    );
    const res = await POST(req({ body: approveBody() }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('already_decided');
  });
});

describe('POST — 승인 (기존 기기 토큰 폐기)', () => {
  it('revokes the live customer tokens, moves the device and mints a new one', async () => {
    const client = makeDb({
      events: [requestEvent()],
      participants: [incumbent()],
      revokedRows: [{ id: 'inv-1' }, { id: 'inv-2' }],
    });
    createServerClientMock.mockReturnValue(client);

    const res = await POST(req({ body: approveBody() }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.revoked_token_count).toBe(2);
    expect(json.previous_device_masked).toBe('aaaaaaaa…aaaa');
    expect(json.url).toContain(`/tour-mode/room/${BOOKING}?rt=`);
    expect(json.qr_data_url).toBe('data:image/png;base64,qr');

    // ① 기존 기구(revoked_at)로 폐기 — 병렬 기구를 만들지 않는다.
    const revoke = client.updates.find((row) => row.table === 'tour_room_invites')!;
    expect(revoke.values.revoked_at).toBeTruthy();
    expect(revoke.ops).toEqual(
      expect.arrayContaining([['is', ['revoked_at', null]], ['eq', ['role', 'customer']]]),
    );

    // ② participant 행은 유지하고 device_key만 이전.
    const transfer = client.updates.find((row) => row.table === 'tour_room_participants')!;
    expect(transfer.values).toMatchObject({ device_key: DEVICE_NEW, last_seen_at: null });

    // ③ 새 개인 토큰 원장 + 감사 이벤트.
    const ledger = client.inserts.find((row) => row.table === 'tour_room_invites')!;
    expect(ledger.values).toMatchObject({ booking_id: BOOKING, role: 'customer', created_by: 'admin-1' });
    const audit = recordRoomEventMock.mock.calls.find((call) => call[1].type === RECLAIM_APPROVED)![1];
    expect(audit.subjectKey).toBe(reclaimSubjectKey(BOOKING, DEVICE_NEW));
    expect(audit.actorRole).toBe('admin');
    expect(audit.payload).toMatchObject({
      previous_device_key: DEVICE_OLD,
      device_key: DEVICE_NEW,
      revoked_token_count: 2,
      decided_by: 'admin-1',
    });
    expect(sendOpsPushMock).toHaveBeenCalled();
  });

  it('refuses when the requesting device already belongs to another booking in the room', async () => {
    const client = makeDb({
      events: [requestEvent()],
      participants: [incumbent(), incumbent({ id: 'p-2', booking_id: 'other-booking', device_key: DEVICE_NEW })],
    });
    createServerClientMock.mockReturnValue(client);
    const res = await POST(req({ body: approveBody() }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('device_bound_to_other_booking');
    expect(client.updates).toHaveLength(0);
  });

  it('refuses when the booking has no tour_date (token expiry undefined)', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({
        events: [requestEvent()],
        participants: [incumbent()],
        booking: { id: BOOKING, contact_name: 'Massimo Colombo', number_of_guests: 2, tour_date: null },
      }),
    );
    const res = await POST(req({ body: approveBody() }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('booking_has_no_tour_date');
  });
});

describe('POST — 거절', () => {
  it('records the decision and leaves the incumbent device untouched', async () => {
    const client = makeDb({ events: [requestEvent()], participants: [incumbent()] });
    createServerClientMock.mockReturnValue(client);
    const res = await POST(req({ body: approveBody({ decision: 'reject', note: '본인 확인 실패' }) }));
    expect(res.status).toBe(200);
    expect((await res.json()).decision).toBe('reject');
    // 폐기도, 이전도, 토큰 발급도 없다.
    expect(client.updates).toHaveLength(0);
    expect(client.inserts).toHaveLength(0);
    const audit = recordRoomEventMock.mock.calls[0][1];
    expect(audit.type).toBe('reclaim_rejected');
    expect(audit.payload).toMatchObject({ device_key: DEVICE_NEW, note: '본인 확인 실패' });
    expect(sendOpsPushMock).toHaveBeenCalled();
  });
});
