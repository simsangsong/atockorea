/**
 * @jest-environment node
 *
 * 배차 차량 사진 (옵션) — 렌트 운영 대응.
 *
 * 계약:
 *   1. **private 저장.** DB에는 URL이 아니라 storage path가 들어간다. 차 안에는
 *      기사·손님이 찍힐 수 있어서 public URL을 만들면 안 된다.
 *   2. **새 버킷을 만들지 않는다.** 기존 `ops-vehicle-refs`를 `room-vehicle/…`
 *      경로로 나눠 쓴다.
 *   3. `vehicle_id`는 **배차 행 id**다(마스터 아님) — 형제 라우트와 같은 규약.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST, DELETE } from '@/app/api/admin/tour-ops/rooms/[roomId]/vehicles/photo/route';
import { createServerClient } from '@/lib/supabase';
import { LAYOUT_PHOTO_BUCKET } from '@/lib/ops/seating/layoutPhoto';

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(async () => ({ id: 'admin-1' })),
  AdminAuthFailure: class extends Error {},
  adminAuthJsonResponse: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;
const ROOM_ID = 'room-1';

function makeDb(vehicles: Array<Record<string, unknown>>) {
  const updated: Array<{ table: string; values: Record<string, unknown> }> = [];
  const uploads: Array<{ bucket: string; path: string }> = [];
  const createdBuckets: Array<{ name: string; options: Record<string, unknown> }> = [];

  const client = {
    updated,
    uploads,
    createdBuckets,
    storage: {
      listBuckets: async () => ({ data: [{ name: LAYOUT_PHOTO_BUCKET }] }),
      createBucket: async (name: string, options: Record<string, unknown>) => {
        createdBuckets.push({ name, options });
        return { error: null };
      },
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploads.push({ bucket, path });
          return { error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example/${path}?token=x` },
          error: null,
        }),
      }),
    },
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      let mode = 'select';
      let values: Record<string, unknown> = {};
      for (const name of ['select', 'eq', 'in', 'order', 'limit']) chain[name] = () => chain;
      chain.update = (v: Record<string, unknown>) => {
        mode = 'update';
        values = v;
        return chain;
      };
      const resolve = async () => {
        if (mode === 'update') {
          updated.push({ table, values });
          return { data: null, error: null };
        }
        if (table === 'ops_room_vehicles') return { data: vehicles, error: null };
        if (table === 'tour_rooms') {
          return {
            data: [{ id: ROOM_ID, booking_id: 'bk-1', tour_id: 't1', tour_date: '2026-08-17', status: 'active' }],
            error: null,
          };
        }
        return { data: [], error: null };
      };
      chain.maybeSingle = async () => {
        const res = await resolve();
        return { data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: res.error };
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain.then = (ok: any, err: any) => resolve().then(ok, err);
      return chain;
    },
  };
  return client;
}

const dispatchRow = (over: Record<string, unknown> = {}) => ({
  id: 'rv-1',
  room_id: ROOM_ID,
  layout_id: 'lay-county',
  plate_number: null,
  driver_participant_id: null,
  ...over,
});

function photoFile(type = 'image/jpeg', name = 'bus.jpg') {
  return {
    type,
    size: 1024,
    name,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
}

function postReq(fields: Record<string, unknown>) {
  const map = new Map(Object.entries(fields));
  return { formData: async () => ({ get: (k: string) => map.get(k) ?? null }) } as never;
}

const ctx = { params: Promise.resolve({ roomId: ROOM_ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  createServerClientMock.mockReturnValue(makeDb([dispatchRow()]));
});

it('stores a private storage path, never a public url', async () => {
  const db = makeDb([dispatchRow()]);
  createServerClientMock.mockReturnValue(db);
  const res = await POST(postReq({ vehicle_id: 'rv-1', photo: photoFile() }), ctx);
  expect(res.status).toBe(201);

  const saved = db.updated.find((u) => u.table === 'ops_room_vehicles')!.values.photo_path as string;
  expect(saved.startsWith('room-vehicle/rv-1/')).toBe(true);
  expect(saved).not.toContain('http');
  // 응답의 URL은 서명 URL이지 저장값이 아니다.
  expect((await res.json()).photo_url).toContain('signed.example');
});

it('reuses the existing vehicle-reference bucket instead of making a new one', async () => {
  const db = makeDb([dispatchRow()]);
  createServerClientMock.mockReturnValue(db);
  await POST(postReq({ vehicle_id: 'rv-1', photo: photoFile() }), ctx);
  expect(db.uploads[0].bucket).toBe(LAYOUT_PHOTO_BUCKET);
  expect(db.createdBuckets).toHaveLength(0);
});

it('rejects a non-image', async () => {
  const res = await POST(postReq({ vehicle_id: 'rv-1', photo: photoFile('application/pdf', 'a.pdf') }), ctx);
  expect(res.status).toBe(400);
});

it('requires the dispatch row to belong to this room', async () => {
  createServerClientMock.mockReturnValue(makeDb([dispatchRow({ room_id: 'other-room' })]));
  const res = await POST(postReq({ vehicle_id: 'rv-1', photo: photoFile() }), ctx);
  expect(res.status).toBe(404);
});

it('400s without a vehicle_id — the dispatch row id, not the master', async () => {
  const res = await POST(postReq({ photo: photoFile() }), ctx);
  expect(res.status).toBe(400);
});

it('clears only the reference on delete, keeping the stored object', async () => {
  const db = makeDb([dispatchRow({ photo_path: 'room-vehicle/rv-1/a.jpg' })]);
  createServerClientMock.mockReturnValue(db);
  const res = await DELETE(
    { nextUrl: { searchParams: new URLSearchParams('vehicle_id=rv-1') } } as never,
    ctx,
  );
  expect(res.status).toBe(200);
  expect(db.updated.find((u) => u.table === 'ops_room_vehicles')!.values).toEqual({ photo_path: null });
});
