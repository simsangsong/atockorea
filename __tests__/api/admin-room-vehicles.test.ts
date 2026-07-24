/**
 * @jest-environment node
 *
 * §4.1 B-2 / §5.6 룸 차량 배정 — ops_room_vehicles의 유일한 쓰기 표면.
 *
 * 핵심 위험은 "이미 좌석을 고른 손님이 있는 차량의 배치도를 바꾸는 것"이다.
 * 기본값은 막는 것(409 + 무엇이 사라지는지)이고, 운영자가 결과를 본 뒤
 * 고른 선택만 실행되며, 해제된 배정은 스냅샷으로 되돌릴 수 있어야 한다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET, POST, PATCH, DELETE } from '@/app/api/admin/tour-ops/rooms/[roomId]/vehicles/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { recordRoomEvent } from '@/lib/tour-room/events';
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
jest.mock('@/lib/tour-room/events', () => ({
  recordRoomEvent: jest.fn(async () => ({ inserted: true, event: { id: 'evt-1' } })),
}));
jest.mock('@/lib/ops/seating/service', () => ({ broadcastSeatUpdate: jest.fn(async () => undefined) }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;

const ROOM_ID = 'room-1';
const OLD_LAYOUT_ID = 'layout-county';
const NEW_LAYOUT_ID = 'layout-solati';

const COUNTY: VehicleLayoutJson = {
  model: 'county_20',
  cols: 5,
  fixtures: [{ type: 'driver', r: 0, c: 0 }],
  seats: [1, 2, 3, 4, 5].map((n) => ({ n, r: 1, c: n - 1 })),
};
/** 3석짜리 대체 배치도 — 4·5번이 사라진다. */
const SOLATI: VehicleLayoutJson = {
  model: 'solati_16',
  cols: 5,
  fixtures: [{ type: 'driver', r: 0, c: 0 }],
  seats: [1, 2, 3].map((n) => ({ n, r: 1, c: n - 1 })),
};

type Op = [string, unknown[]];

function makeDb(options: {
  vehicles?: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
}) {
  const deleted: unknown[] = [];
  const updated: Array<{ table: string; values: Record<string, unknown> }> = [];
  const inserted: Array<{ table: string; values: unknown }> = [];
  const layouts = [
    { id: OLD_LAYOUT_ID, model: 'county_20', display_name: { ko: '카운티' }, total_seats: 5, layout_json: COUNTY, is_verified: true },
    { id: NEW_LAYOUT_ID, model: 'solati_16', display_name: { ko: '쏠라티' }, total_seats: 3, layout_json: SOLATI, is_verified: false },
  ];

  const client = {
    deleted,
    updated,
    inserted,
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
          updated.push({ table, values: state.values as Record<string, unknown> });
          return { data: null, error: null };
        }
        if (state.mode === 'insert') {
          inserted.push({ table, values: state.values });
          return { data: { id: 'rv-new' }, error: null };
        }
        if (state.mode === 'delete') {
          deleted.push({ table, ops: state.ops });
          return { data: null, error: null };
        }
        switch (table) {
          case 'tour_rooms':
            return {
              data: [{ id: ROOM_ID, booking_id: 'bk-1', tour_id: 'tour-1', tour_date: '2026-08-17', status: 'active' }],
              error: null,
            };
          case 'ops_room_vehicles':
            return { data: options.vehicles ?? [], error: null };
          case 'ops_seat_assignments':
            return { data: options.assignments ?? [], error: null };
          case 'ops_vehicle_layouts': {
            const eq = state.ops.find(([name]) => name === 'eq');
            const wanted = eq ? String((eq[1] as unknown[])[1]) : null;
            return { data: wanted ? layouts.filter((l) => l.id === wanted) : layouts, error: null };
          }
          case 'tour_room_participants':
            return { data: [{ id: 'p-driver', display_name: '김기사', role: 'driver', last_seen_at: null }], error: null };
          case 'tour_room_events':
            return { data: options.events ?? [], error: null };
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

const vehicle = (over: Record<string, unknown> = {}) => ({
  id: 'rv-1',
  room_id: ROOM_ID,
  layout_id: OLD_LAYOUT_ID,
  plate_number: '12가 3456',
  driver_participant_id: null,
  ...over,
});

const seat = (n: number, guest: string, checkedIn = false) => ({
  id: `sa-${n}`,
  room_vehicle_id: 'rv-1',
  booking_id: 'bk-1',
  participant_id: 'p-1',
  seat_number: n,
  guest_label: guest,
  checked_in_at: checkedIn ? '2026-08-17T00:10:00Z' : null,
  absent_at: null,
  locked: false,
});

function req({ search = '', body }: { search?: string; body?: unknown } = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
    json: async () => body,
  } as never;
}

const ctx = { params: Promise.resolve({ roomId: ROOM_ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1', email: 'ops@atockorea.com' });
  recordRoomEventMock.mockResolvedValue({ inserted: true, event: { id: 'evt-1' } });
  createServerClientMock.mockReturnValue(makeDb({}));
});

describe('auth', () => {
  it('propagates the admin auth failure', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(401, 'no', 'AUTH'));
    expect((await GET(req(), ctx)).status).toBe(401);
    expect((await POST(req({ body: {} }), ctx)).status).toBe(401);
    expect((await PATCH(req({ body: {} }), ctx)).status).toBe(401);
    expect((await DELETE(req({ search: 'vehicle_id=rv-1' }), ctx)).status).toBe(401);
  });
});

describe('GET — 배차 현황', () => {
  it('returns vehicles with assignment counts, layout options and driver candidates', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({ vehicles: [vehicle()], assignments: [seat(1, 'Massimo C.'), seat(2, 'Lena K.', true)] }),
    );
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.vehicles[0].plate_number).toBe('12가 3456');
    expect(json.vehicles[0].assignments).toHaveLength(2);
    expect(json.vehicles[0].total_seats).toBe(5);
    expect(json.layouts).toHaveLength(2);
    expect(json.drivers[0].display_name).toBe('김기사');
  });

  it('reports an empty vehicle list for an unassigned room (좌석 오픈 예정)', async () => {
    const json = await (await GET(req(), ctx)).json();
    expect(json.vehicles).toEqual([]);
  });
});

describe('POST — 배차', () => {
  it('requires a layout_id', async () => {
    expect((await POST(req({ body: {} }), ctx)).status).toBe(400);
  });

  it('creates the vehicle and logs the assignment event', async () => {
    const client = makeDb({});
    createServerClientMock.mockReturnValue(client);
    const res = await POST(
      req({ body: { layout_id: OLD_LAYOUT_ID, plate_number: ' 12가 3456 ', driver_name: '김기사' } }),
      ctx,
    );
    expect(res.status).toBe(201);
    const insert = client.inserted.find((row) => row.table === 'ops_room_vehicles')!;
    expect(insert.values).toMatchObject({ room_id: ROOM_ID, layout_id: OLD_LAYOUT_ID, plate_number: '12가 3456' });
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'vehicle_assigned' }),
    );
  });
});

describe('PATCH — 좌석이 배정된 차량의 배치도 교체', () => {
  it('blocks by default and reports exactly which seats would be lost', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({
        vehicles: [vehicle()],
        assignments: [seat(1, 'Massimo C.'), seat(4, 'Lena K.'), seat(5, 'Yuki T.', true)],
      }),
    );
    const res = await PATCH(req({ body: { vehicle_id: 'rv-1', layout_id: NEW_LAYOUT_ID } }), ctx);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('seats_assigned');
    expect(json.assigned).toHaveLength(3);
    expect(json.lost.map((row: { seat_number: number }) => row.seat_number)).toEqual([4, 5]);
    expect(json.lost[1].checked_in).toBe(true);
    expect(json.strategies).toEqual(['keep', 'clear']);
  });

  it('blocks a "keep" that was not explicitly confirmed', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({ vehicles: [vehicle()], assignments: [seat(4, 'Lena K.')] }),
    );
    const res = await PATCH(
      req({ body: { vehicle_id: 'rv-1', layout_id: NEW_LAYOUT_ID, strategy: 'keep' } }),
      ctx,
    );
    expect(res.status).toBe(409);
  });

  it('keep: releases only the seats missing from the new layout, and snapshots them', async () => {
    const client = makeDb({
      vehicles: [vehicle()],
      assignments: [seat(1, 'Massimo C.'), seat(4, 'Lena K.')],
    });
    createServerClientMock.mockReturnValue(client);
    const res = await PATCH(
      req({ body: { vehicle_id: 'rv-1', layout_id: NEW_LAYOUT_ID, strategy: 'keep', confirm: true } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.released).toEqual([4]);
    expect(json.undo_event_id).toBe('evt-1');
    const change = recordRoomEventMock.mock.calls.find((call) => call[1].type === 'vehicle_changed')![1];
    expect(change.payload.strategy).toBe('keep');
    expect(change.payload.released).toEqual([
      expect.objectContaining({ seat_number: 4, guest_label: 'Lena K.' }),
    ]);
  });

  it('clear: releases every assignment', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({ vehicles: [vehicle()], assignments: [seat(1, 'Massimo C.'), seat(4, 'Lena K.')] }),
    );
    const res = await PATCH(
      req({ body: { vehicle_id: 'rv-1', layout_id: NEW_LAYOUT_ID, strategy: 'clear', confirm: true } }),
      ctx,
    );
    expect((await res.json()).released).toEqual([1, 4]);
  });

  it('edits plate/driver without touching assignments when the layout is unchanged', async () => {
    const client = makeDb({ vehicles: [vehicle()], assignments: [seat(4, 'Lena K.')] });
    createServerClientMock.mockReturnValue(client);
    const res = await PATCH(
      req({ body: { vehicle_id: 'rv-1', plate_number: '99하 1111', driver_participant_id: 'p-driver' } }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).released).toEqual([]);
    expect(client.deleted).toHaveLength(0);
    expect(client.updated.find((row) => row.table === 'ops_room_vehicles')!.values).toMatchObject({
      plate_number: '99하 1111',
      driver_participant_id: 'p-driver',
    });
  });

  it('404s a vehicle that belongs to another room', async () => {
    createServerClientMock.mockReturnValue(makeDb({ vehicles: [vehicle({ room_id: 'other-room' })] }));
    const res = await PATCH(req({ body: { vehicle_id: 'rv-1', layout_id: NEW_LAYOUT_ID } }), ctx);
    expect(res.status).toBe(404);
  });
});

describe('PATCH — 되돌리기 (스냅샷 복원)', () => {
  it('restores the previous layout and the released assignments', async () => {
    const client = makeDb({
      vehicles: [vehicle({ layout_id: NEW_LAYOUT_ID })],
      events: [
        {
          id: 'evt-1',
          room_id: ROOM_ID,
          type: 'vehicle_changed',
          payload: {
            room_vehicle_id: 'rv-1',
            from_layout_id: OLD_LAYOUT_ID,
            to_layout_id: NEW_LAYOUT_ID,
            released: [{ booking_id: 'bk-1', participant_id: 'p-1', seat_number: 4, guest_label: 'Lena K.' }],
          },
        },
      ],
    });
    createServerClientMock.mockReturnValue(client);
    const res = await PATCH(req({ body: { undo_event_id: 'evt-1' } }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.restored).toBe(1);
    expect(json.skipped).toEqual([]);
    expect(client.updated.find((row) => row.table === 'ops_room_vehicles')!.values).toEqual({
      layout_id: OLD_LAYOUT_ID,
    });
    expect(client.inserted.find((row) => row.table === 'ops_seat_assignments')!.values).toMatchObject({
      seat_number: 4,
      guest_label: 'Lena K.',
    });
  });

  it('404s an undo target that is not a vehicle_changed event of this room', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({ events: [{ id: 'evt-1', room_id: 'other', type: 'vehicle_changed', payload: {} }] }),
    );
    expect((await PATCH(req({ body: { undo_event_id: 'evt-1' } }), ctx)).status).toBe(404);
  });
});

describe('DELETE — 배차 해제', () => {
  it('blocks while seats are assigned and lists them', async () => {
    createServerClientMock.mockReturnValue(
      makeDb({ vehicles: [vehicle()], assignments: [seat(1, 'Massimo C.')] }),
    );
    const res = await DELETE(req({ search: 'vehicle_id=rv-1' }), ctx);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('seats_assigned');
    expect(json.assigned[0].guest_label).toBe('Massimo C.');
  });

  it('snapshots the assignments before deleting once confirmed', async () => {
    const client = makeDb({ vehicles: [vehicle()], assignments: [seat(1, 'Massimo C.')] });
    createServerClientMock.mockReturnValue(client);
    const res = await DELETE(req({ search: 'vehicle_id=rv-1&confirm=1' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).released).toBe(1);
    const event = recordRoomEventMock.mock.calls.find((call) => call[1].type === 'vehicle_unassigned')![1];
    expect(event.payload.released).toHaveLength(1);
    expect(client.deleted).toHaveLength(1);
  });
});
