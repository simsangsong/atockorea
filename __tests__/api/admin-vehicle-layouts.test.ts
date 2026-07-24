/**
 * @jest-environment node
 *
 * §5.3b 배치도 에디터 API — 확정 게이트와 사용 중 배치도 보호.
 *
 * 두 가지가 이 라우트의 존재 이유고, 그래서 여기서 검증한다:
 *   ① 실차 사진 없이는 절대 확정되지 않는다 (사람의 확인도 함께 필요).
 *   ② 이미 배정된 좌석이 사라지는 저장은 409 — 영향받는 룸을 돌려주고
 *      명시적 확인을 받은 뒤에만 통과한다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as listGET } from '@/app/api/admin/vehicle-layouts/route';
import { GET, PATCH } from '@/app/api/admin/vehicle-layouts/[id]/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

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
jest.mock('@/lib/ops/seating/layoutPhoto', () => ({
  ...jest.requireActual('@/lib/ops/seating/layoutPhoto'),
  layoutPhotoSignedUrl: jest.fn(async (_c: unknown, path: string | null) =>
    path ? `https://signed.example/${path}` : null,
  ),
  ensureLayoutPhotoBucket: jest.fn(async () => undefined),
  uploadLayoutPhoto: jest.fn(async () => undefined),
}));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const LAYOUT_ID = 'layout-county';

const LAYOUT: VehicleLayoutJson = {
  model: 'county_20',
  cols: 5,
  fixtures: [{ type: 'driver', r: 0, c: 0 }],
  seats: [
    { n: 1, r: 1, c: 0 },
    { n: 2, r: 1, c: 1 },
    { n: 3, r: 1, c: 3 },
  ],
};

type Op = [string, unknown[]];

interface Handlers {
  select?: (table: string, columns: string, ops: Op[]) => { data?: unknown; error?: unknown } | undefined;
  update?: (table: string, values: Record<string, unknown>, ops: Op[]) => { data?: unknown; error?: unknown } | undefined;
  insert?: (table: string, values: unknown) => { data?: unknown; error?: unknown } | undefined;
  del?: (table: string, ops: Op[]) => { data?: unknown; error?: unknown } | undefined;
}

/** 체이너블 Supabase 목 — select/update/insert/delete 를 표 단위로 라우팅한다. */
function makeDb(handlers: Handlers) {
  const calls: Array<{ table: string; mode: string; values?: unknown }> = [];
  const client = {
    calls,
    from(table: string) {
      const state = { mode: 'select', columns: '', values: undefined as unknown, ops: [] as Op[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      const record = (name: string) => (...args: unknown[]) => {
        state.ops.push([name, args]);
        return chain;
      };
      chain.select = (columns?: string) => {
        if (state.mode === 'select') state.columns = columns ?? '';
        state.ops.push(['select', [columns]]);
        return chain;
      };
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
      const resolve = async () => {
        calls.push({ table, mode: state.mode, values: state.values });
        const handler =
          state.mode === 'select'
            ? handlers.select?.(table, state.columns, state.ops)
            : state.mode === 'update'
              ? handlers.update?.(table, state.values as Record<string, unknown>, state.ops)
              : state.mode === 'insert'
                ? handlers.insert?.(table, state.values)
                : handlers.del?.(table, state.ops);
        return { data: handler?.data ?? null, error: handler?.error ?? null };
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

/** 배치도 1행 + (선택) 사용 중 좌석을 가진 목. */
function db(options: {
  layoutRow?: Record<string, unknown>;
  vehicles?: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
  updates?: Array<Record<string, unknown>>;
}) {
  const updates = options.updates ?? [];
  return makeDb({
    select: (table) => {
      if (table === 'ops_vehicle_layouts') {
        return {
          data: [
            options.layoutRow ?? {
              id: LAYOUT_ID,
              model: 'county_20',
              display_name: { ko: '카운티 20인승' },
              layout_json: LAYOUT,
              total_seats: 3,
              is_verified: false,
              reference_photo_path: null,
            },
          ],
        };
      }
      if (table === 'ops_room_vehicles') return { data: options.vehicles ?? [] };
      if (table === 'ops_seat_assignments') return { data: options.assignments ?? [] };
      if (table === 'tour_rooms') {
        return { data: [{ id: 'room-1', booking_id: 'bk-1', tour_id: 'tour-1', tour_date: '2026-08-17' }] };
      }
      if (table === 'bookings') return { data: [{ id: 'bk-1', contact_name: 'Massimo Colombo' }] };
      if (table === 'tours') return { data: [{ id: 'tour-1', title: '성산 일출' }] };
      return { data: [] };
    },
    update: (table, values) => {
      if (table === 'ops_vehicle_layouts') updates.push(values);
      return { data: null };
    },
  });
}

function req({ search = '', body }: { search?: string; body?: unknown } = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
    json: async () => body,
  } as never;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1', email: 'ops@atockorea.com' });
  createServerClientMock.mockReturnValue(db({}));
});

describe('auth', () => {
  it('propagates the admin auth failure on every verb', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(403, 'no', 'FORBIDDEN'));
    expect((await listGET(req())).status).toBe(403);
    expect((await GET(req(), ctx(LAYOUT_ID))).status).toBe(403);
    expect((await PATCH(req({ body: {} }), ctx(LAYOUT_ID))).status).toBe(403);
  });
});

describe('GET /api/admin/vehicle-layouts/[id]', () => {
  it('returns the layout with a signed reference-photo url and in-use seats', async () => {
    createServerClientMock.mockReturnValue(
      db({
        layoutRow: {
          id: LAYOUT_ID,
          model: 'county_20',
          display_name: { ko: '카운티' },
          layout_json: LAYOUT,
          total_seats: 3,
          is_verified: true,
          reference_photo_path: 'vehicle-layout/x/y.jpg',
        },
        vehicles: [{ id: 'rv-1', room_id: 'room-1', layout_id: LAYOUT_ID, plate_number: '12가 3456' }],
        assignments: [{ room_vehicle_id: 'rv-1', seat_number: 2, guest_label: 'Massimo C.', checked_in_at: null }],
      }),
    );
    const res = await GET(req(), ctx(LAYOUT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.reference_photo_url).toContain('signed.example');
    expect(json.in_use_seats).toHaveLength(1);
    expect(json.in_use_seats[0].roomLabel).toContain('성산 일출');
  });

  it('404s an unknown layout', async () => {
    createServerClientMock.mockReturnValue(makeDb({ select: () => ({ data: [] }) }));
    expect((await GET(req(), ctx('nope'))).status).toBe(404);
  });
});

describe('PATCH — 실차 사진 대조 게이트 (§5.3b)', () => {
  it('refuses to verify without a reference photo', async () => {
    const res = await PATCH(req({ body: { action: 'verify', confirm_photo_match: true } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('photo_required');
  });

  it('refuses to verify with a photo but no human confirmation', async () => {
    createServerClientMock.mockReturnValue(
      db({
        layoutRow: {
          id: LAYOUT_ID,
          model: 'county_20',
          layout_json: LAYOUT,
          total_seats: 3,
          is_verified: false,
          reference_photo_path: 'vehicle-layout/x/y.jpg',
        },
      }),
    );
    const res = await PATCH(req({ body: { action: 'verify' } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('confirm_required');
  });

  it('verifies once a photo and the confirmation are both present', async () => {
    const updates: Array<Record<string, unknown>> = [];
    createServerClientMock.mockReturnValue(
      db({
        layoutRow: {
          id: LAYOUT_ID,
          model: 'county_20',
          layout_json: LAYOUT,
          total_seats: 3,
          is_verified: false,
          reference_photo_path: 'vehicle-layout/x/y.jpg',
        },
        updates,
      }),
    );
    const res = await PATCH(
      req({ body: { action: 'verify', confirm_photo_match: true } }),
      ctx(LAYOUT_ID),
    );
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ is_verified: true, verified_by: 'admin-1' });
    expect(updates[0].verified_at).toBeTruthy();
  });

  it('unverifies on demand', async () => {
    const updates: Array<Record<string, unknown>> = [];
    createServerClientMock.mockReturnValue(db({ updates }));
    const res = await PATCH(req({ body: { action: 'unverify' } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ is_verified: false, verified_at: null, verified_by: null });
  });
});

describe('PATCH — 배치도 저장', () => {
  it('rejects a malformed layout_json', async () => {
    const res = await PATCH(req({ body: { layout_json: { model: 'sedan' } } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_layout');
  });

  it('rejects a layout with duplicate seat numbers', async () => {
    const broken = { ...LAYOUT, seats: [...LAYOUT.seats, { n: 2, r: 2, c: 0 }] };
    const res = await PATCH(req({ body: { layout_json: broken, total_seats: 4 } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('layout_invalid');
    expect(json.issues.some((i: { code: string }) => i.code === 'duplicate_seat_number')).toBe(true);
  });

  it('rejects total_seats that disagrees with the seat count', async () => {
    const res = await PATCH(req({ body: { layout_json: LAYOUT, total_seats: 20 } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.issues.some((i: { code: string }) => i.code === 'total_seats_mismatch')).toBe(true);
  });

  it('409s when an assigned seat would vanish, naming the affected room', async () => {
    createServerClientMock.mockReturnValue(
      db({
        vehicles: [{ id: 'rv-1', room_id: 'room-1', layout_id: LAYOUT_ID, plate_number: null }],
        assignments: [{ room_vehicle_id: 'rv-1', seat_number: 3, guest_label: 'Massimo C.', checked_in_at: null }],
      }),
    );
    const shrunk = { ...LAYOUT, seats: LAYOUT.seats.slice(0, 2) };
    const res = await PATCH(req({ body: { layout_json: shrunk, total_seats: 2 } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('seats_in_use');
    expect(json.message).toContain('성산 일출');
    const issue = json.issues.find((i: { code: string }) => i.code === 'in_use_seat_removed');
    expect(issue.rooms[0].seats).toEqual([3]);
    expect(issue.rooms[0].guests).toContain('Massimo C.');
  });

  it('saves the shrink once the operator confirms, and resets verification', async () => {
    const updates: Array<Record<string, unknown>> = [];
    createServerClientMock.mockReturnValue(
      db({
        layoutRow: {
          id: LAYOUT_ID,
          model: 'county_20',
          layout_json: LAYOUT,
          total_seats: 3,
          is_verified: true,
          reference_photo_path: 'vehicle-layout/x/y.jpg',
        },
        vehicles: [{ id: 'rv-1', room_id: 'room-1', layout_id: LAYOUT_ID, plate_number: null }],
        assignments: [{ room_vehicle_id: 'rv-1', seat_number: 3, guest_label: 'Massimo C.', checked_in_at: null }],
        updates,
      }),
    );
    const shrunk = { ...LAYOUT, seats: LAYOUT.seats.slice(0, 2) };
    const res = await PATCH(
      req({ body: { layout_json: shrunk, total_seats: 2, confirm_in_use: true } }),
      ctx(LAYOUT_ID),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).verification_reset).toBe(true);
    // 그림이 바뀌었으니 확정은 풀리고, 사진 경로는 남는다.
    expect(updates[0]).toMatchObject({ total_seats: 2, is_verified: false, verified_at: null });
    expect(updates[0].reference_photo_path).toBeUndefined();
  });

  it('ignores vehicles that carry their own override when judging in-use risk', async () => {
    createServerClientMock.mockReturnValue(
      db({
        vehicles: [
          { id: 'rv-1', room_id: 'room-1', layout_id: LAYOUT_ID, plate_number: null, layout_override_json: LAYOUT },
        ],
        assignments: [{ room_vehicle_id: 'rv-1', seat_number: 3, guest_label: 'Massimo C.', checked_in_at: null }],
      }),
    );
    const shrunk = { ...LAYOUT, seats: LAYOUT.seats.slice(0, 2) };
    const res = await PATCH(req({ body: { layout_json: shrunk, total_seats: 2 } }), ctx(LAYOUT_ID));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/vehicle-layouts (목록)', () => {
  it('reports usage counts and lists per-vehicle overrides', async () => {
    createServerClientMock.mockReturnValue(
      db({
        vehicles: [
          { id: 'rv-1', room_id: 'room-1', layout_id: LAYOUT_ID, plate_number: '12가 3456' },
          {
            id: 'rv-2',
            room_id: 'room-1',
            layout_id: LAYOUT_ID,
            plate_number: '34나 5678',
            layout_override_json: LAYOUT,
            override_note: '뒷줄 3석',
          },
        ],
      }),
    );
    const res = await listGET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].vehicle_count).toBe(2);
    expect(json.data[0].override_count).toBe(1);
    expect(json.overrides).toHaveLength(1);
    expect(json.overrides[0].room_vehicle_id).toBe('rv-2');
    expect(json.overrides[0].note).toBe('뒷줄 3석');
  });
});
