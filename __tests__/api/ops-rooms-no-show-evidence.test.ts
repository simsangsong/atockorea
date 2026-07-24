/**
 * @jest-environment node
 *
 * §5.4b D12 노쇼 증거팩 업로드 라우트 — staff 전용, 좌석 실재 확인, private
 * 버킷 업로드, 워터마크 합성(실패해도 원본으로 200), insert 인자.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as evidencePOST, GET as evidenceGET } from '@/app/api/ops/rooms/[roomId]/no-show-evidence/route';
import { signGuideRoomToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { createServerClient } from '@/lib/supabase';
import { __resetRequestGateMemory } from '@/lib/durable-rate-limit';
import { EVIDENCE_BUCKET } from '@/lib/ops/seating/evidence';
import { makeFakeDb, queriesFor, fakeNextRequest, type FakeQuery } from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(async () => null) }));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
  broadcastToRooms: jest.fn(async () => ({ ok: true })),
}));

// sharp는 기본적으로 "합성 성공"으로 가짜 동작 — 개별 테스트가 throw로 덮는다.
const sharpFactory = jest.fn();
jest.mock('sharp', () => ({
  __esModule: true,
  default: (...args: unknown[]) => sharpFactory(...args),
}));

function okSharp() {
  const instance: Record<string, unknown> = {};
  const chain = () => instance;
  Object.assign(instance, {
    rotate: chain,
    resize: chain,
    jpeg: chain,
    composite: chain,
    toBuffer: async (opts?: { resolveWithObject?: boolean }) =>
      opts?.resolveWithObject
        ? { data: Buffer.from('resized'), info: { width: 1200, height: 900 } }
        : Buffer.from('stamped'),
  });
  return instance;
}

const createServerClientMock = createServerClient as jest.Mock;

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const ROOM = { id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: FUTURE, status: 'active' };
const SEAT = { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 3, guest_label: 'Massimo Cassina' };

interface StorageCall {
  method: string;
  args: unknown[];
}

function evidenceDb(over: { evidenceRows?: unknown[]; uploadError?: unknown } = {}) {
  const log: FakeQuery[] = [];
  const storageCalls: StorageCall[] = [];
  const base = makeFakeDb((q) => {
    if (q.table === 'tour_rooms' && q.terminal === 'maybeSingle') return { data: ROOM };
    if (q.table === 'tour_rooms') return { data: [{ id: 'room-1', status: 'active' }] };
    if (q.table === 'tour_room_invites') return { data: null };
    if (q.table === 'bookings') return { data: { id: 'b1', contact_name: 'Massimo Cassina' } };
    if (q.table === 'ops_room_vehicles') {
      return { data: [{ id: 'v1', room_id: 'room-1', layout_id: 'l1', plate_number: null, ops_vehicle_layouts: null }] };
    }
    if (q.table === 'ops_seat_assignments') return { data: [SEAT] };
    if (q.table === 'ops_no_show_evidence' && q.op === 'insert') return { data: { id: 'ev-1' } };
    if (q.table === 'ops_no_show_evidence') return { data: over.evidenceRows ?? [] };
    if (q.table === 'tour_room_events') return { data: { id: 'ev' } };
    return { data: null };
  }, log);

  const db = {
    ...base,
    storage: {
      listBuckets: async () => {
        storageCalls.push({ method: 'listBuckets', args: [] });
        return { data: [] };
      },
      createBucket: async (name: string, options: Record<string, unknown>) => {
        storageCalls.push({ method: 'createBucket', args: [name, options] });
        return { error: null };
      },
      from: (bucket: string) => ({
        upload: async (path: string, body: Buffer, options: Record<string, unknown>) => {
          storageCalls.push({ method: 'upload', args: [bucket, path, body.length, options] });
          return { error: over.uploadError ?? null };
        },
        createSignedUrl: async (path: string, expiresIn: number) => {
          storageCalls.push({ method: 'createSignedUrl', args: [bucket, path, expiresIn] });
          return { data: { signedUrl: `https://signed/${path}` }, error: null };
        },
      }),
    },
  };
  createServerClientMock.mockReturnValue(db);
  return { log, storageCalls };
}

const params = { params: Promise.resolve({ roomId: 'room-1' }) };
const guideToken = () => signGuideRoomToken({ tourId: 'tour-1', tourDate: FUTURE, displayName: 'G' }).token;

function evidenceForm(over: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.append('photo', new File([new Uint8Array(2048)], 'IMG_1.jpg', { type: 'image/jpeg' }));
  form.append('roomVehicleId', 'v1');
  form.append('seatNumber', '3');
  form.append('capturedAt', new Date().toISOString());
  form.append('latitude', '33.4996');
  form.append('longitude', '126.5312');
  form.append('accuracyM', '11');
  for (const [k, v] of Object.entries(over)) {
    form.delete(k);
    form.append(k, v);
  }
  return form;
}

function post(form: FormData, token = guideToken()) {
  return evidencePOST(
    fakeNextRequest({
      headers: { 'x-tour-room-token': token, 'content-type': 'multipart/form-data; boundary=x', 'user-agent': 'jest-ua' },
      formData: form,
    }),
    params,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetRequestGateMemory();
  sharpFactory.mockImplementation(() => okSharp());
});

describe('POST /api/ops/rooms/[roomId]/no-show-evidence (D12)', () => {
  it('uploads original + watermark to a PRIVATE bucket and records the row', async () => {
    const { log, storageCalls } = evidenceDb();
    const res = await post(evidenceForm());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, evidenceId: 'ev-1', watermarked: true });
    expect(json.previewUrl).toContain('watermarked.jpg');

    // 버킷은 반드시 public:false로 생성된다.
    const created = storageCalls.find((c) => c.method === 'createBucket');
    expect(created?.args[0]).toBe(EVIDENCE_BUCKET);
    expect(created?.args[1]).toMatchObject({ public: false });

    const uploads = storageCalls.filter((c) => c.method === 'upload');
    expect(uploads).toHaveLength(2);
    expect(String(uploads[0].args[1])).toMatch(/^no-show\/room-1\/.+\/original\.jpg$/);
    expect(String(uploads[1].args[1])).toMatch(/watermarked\.jpg$/);

    const insert = queriesFor(log, 'ops_no_show_evidence', 'insert')[0];
    expect(insert.payload).toMatchObject({
      room_id: 'room-1',
      room_vehicle_id: 'v1',
      seat_number: 3,
      booking_id: 'b1',
      seat_assignment_id: 'a1',
      guest_label: 'Massimo C.', // 마스킹본만 저장
      latitude: 33.4996,
      longitude: 126.5312,
      accuracy_m: 11,
      actor_role: 'guide',
      device_user_agent: 'jest-ua',
    });
    expect((insert.payload as { photo_path: string }).photo_path).toMatch(/original\.jpg$/);
    expect((insert.payload as { watermarked_path: string }).watermarked_path).toMatch(/watermarked\.jpg$/);

    const event = queriesFor(log, 'tour_room_events', 'insert')[0];
    expect(event.payload).toMatchObject({ type: 'no_show_evidence' });
  });

  it('still saves the original with a 200 when sharp blows up', async () => {
    const { log, storageCalls } = evidenceDb();
    sharpFactory.mockImplementation(() => {
      throw new Error('sharp native module missing');
    });
    const res = await post(evidenceForm());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, watermarked: false });
    expect(storageCalls.filter((c) => c.method === 'upload')).toHaveLength(1);
    const insert = queriesFor(log, 'ops_no_show_evidence', 'insert')[0];
    expect((insert.payload as { watermarked_path: string | null }).watermarked_path).toBeNull();
  });

  it('records the reason (and no coordinates) when GPS was unavailable', async () => {
    const { log } = evidenceDb();
    const form = evidenceForm();
    form.delete('latitude');
    form.delete('longitude');
    form.delete('accuracyM');
    form.append('gpsUnavailableReason', '실내 주차장이라 미수신');
    const res = await post(form);
    expect(res.status).toBe(200);
    expect(queriesFor(log, 'ops_no_show_evidence', 'insert')[0].payload).toMatchObject({
      latitude: null,
      longitude: null,
      gps_unavailable_reason: '실내 주차장이라 미수신',
    });
  });

  it('400s a photo-less, non-image or reason-less submission', async () => {
    evidenceDb();
    const noPhoto = evidenceForm();
    noPhoto.delete('photo');
    expect((await post(noPhoto)).status).toBe(400);

    evidenceDb();
    expect(
      (await post(evidenceForm({ photo: new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' }) }))).status,
    ).toBe(400);

    evidenceDb();
    const noGps = evidenceForm();
    noGps.delete('latitude');
    noGps.delete('longitude');
    const res = await post(noGps);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'gps_reason_required' });
  });

  it('is staff-only and 404s an unassigned seat', async () => {
    evidenceDb();
    const customer = signCustomerRoomToken({ bookingId: 'b1', displayName: 'M', tourDate: FUTURE }).token;
    expect((await post(evidenceForm(), customer)).status).toBe(403);

    evidenceDb();
    const res = await post(evidenceForm({ seatNumber: '19' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'seat_not_assigned' });
  });

  it('502s (and never inserts) when the original upload fails', async () => {
    const { log } = evidenceDb({ uploadError: new Error('storage down') });
    const res = await post(evidenceForm());
    expect(res.status).toBe(502);
    expect(queriesFor(log, 'ops_no_show_evidence', 'insert')).toHaveLength(0);
  });
});

describe('GET /api/ops/rooms/[roomId]/no-show-evidence', () => {
  it('returns the room evidence with signed URLs for the print sheet', async () => {
    evidenceDb({
      evidenceRows: [
        {
          id: 'ev-1',
          room_vehicle_id: 'v1',
          seat_number: 3,
          booking_id: 'b1',
          guest_label: 'Massimo C.',
          photo_path: 'no-show/room-1/ev-1/original.jpg',
          watermarked_path: 'no-show/room-1/ev-1/watermarked.jpg',
          captured_at: '2026-07-24T05:00:00.000Z',
          recorded_at: '2026-07-24T05:00:05.000Z',
          latitude: 33.4996,
          longitude: 126.5312,
          accuracy_m: 11,
          gps_unavailable_reason: null,
          actor_role: 'guide',
          device_user_agent: 'ua',
          note: null,
        },
      ],
    });
    const res = await evidenceGET(
      fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }),
      params,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.evidence).toHaveLength(1);
    expect(json.evidence[0]).toMatchObject({ id: 'ev-1', seatNumber: 3, guestLabel: 'Massimo C.' });
    expect(json.evidence[0].watermarkedUrl).toContain('watermarked.jpg');
    expect(json.evidence[0].photoUrl).toContain('original.jpg');
  });

  it('is staff-only', async () => {
    evidenceDb();
    const customer = signCustomerRoomToken({ bookingId: 'b1', displayName: 'M', tourDate: FUTURE }).token;
    const res = await evidenceGET(fakeNextRequest({ headers: { 'x-tour-room-token': customer } }), params);
    expect(res.status).toBe(403);
  });
});
