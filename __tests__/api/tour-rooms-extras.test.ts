/**
 * @jest-environment node
 *
 * W2.4 — extras LEDGER API: log/confirm/settle/void transitions (P-D2).
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as extrasGET, PATCH as extrasPATCH, POST as extrasPOST } from '@/app/api/tour-rooms/[bookingId]/extras/route';
import { allowedExtraTransition, renderExtraCapsule } from '@/lib/tour-room/ledger';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { kstToday } from '@/lib/tour-room/time';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/attachments', () => ({
  classifyAttachment: jest.fn(() => ({ kind: 'image', ext: 'jpg' })),
  uploadAttachment: jest.fn(async () => ({ url: 'https://x/att/receipt.jpg', mime: 'image/jpeg', name: 'r.jpg', size: 100 })),
}));
// T2-2 — capsules translate the item; echo by default so existing assertions
// (which check amounts/status, not the item text) hold. Per-test overrides
// supply a real per-locale translation.
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(async (text: string) => ({
    source_locale: 'ko',
    translations: { en: text, ko: text, ja: text, es: text, zh: text },
  })),
}));
const translateItemMock = jest.requireMock('@/lib/openai-server').translateTextForLocales as jest.Mock;

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  // Dynamic — the P-D12 post_tour gate reads the real clock (no date rot).
  tour_date: kstToday(),
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ja',
};

function fakeDb(config: { extra?: Record<string, unknown> | null } = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const updates: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    updates,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const resolve = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'tour_room_extras') return { data: config.extra ?? null, error: null };
        return { data: null, error: null };
      };
      chain.single = jest.fn(resolve);
      chain.maybeSingle = jest.fn(resolve);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        (table === 'tour_room_extras'
          ? Promise.resolve({ data: config.extra ? [config.extra] : [], error: null })
          : resolve()
        ).then(res, rej);
      chain.upsert = jest.fn(() => ({
        select: () => ({
          single: async () => ({ data: { id: 'room-1', booking_id: 'booking-1', status: 'active' }, error: null }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-1`, ...values }, error: null }) }) };
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        (updates[table] ??= []).push(values);
        return {
          eq: jest.fn(() => ({
            select: () => ({ single: async () => ({ data: { ...(config.extra ?? {}), ...values }, error: null }) }),
          })),
        };
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
const session = (role: 'customer' | 'guide' | 'driver' | 'admin') =>
  signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId: `p-${role}`, role, displayName: 'X' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('allowedExtraTransition (§C-3 extra machine)', () => {
  it('customer confirms logged only; guide settles logged/confirmed; settled is final', () => {
    expect(allowedExtraTransition('confirm', 'customer', 'logged')).toBe('confirmed');
    expect(allowedExtraTransition('confirm', 'customer', 'confirmed')).toBeNull();
    expect(allowedExtraTransition('confirm', 'guide', 'logged')).toBeNull();
    expect(allowedExtraTransition('settle', 'guide', 'logged')).toBe('settled');
    expect(allowedExtraTransition('settle', 'guide', 'confirmed')).toBe('settled');
    expect(allowedExtraTransition('settle', 'customer', 'confirmed')).toBeNull();
    expect(allowedExtraTransition('void', 'guide', 'confirmed')).toBe('voided');
    expect(allowedExtraTransition('void', 'guide', 'settled')).toBeNull();
  });

  it('T1-2 — a driver settles/voids only the expenses they advanced (payer=driver)', () => {
    expect(allowedExtraTransition('settle', 'driver', 'confirmed', 'driver')).toBe('settled');
    expect(allowedExtraTransition('settle', 'driver', 'logged', 'driver')).toBe('settled');
    expect(allowedExtraTransition('settle', 'driver', 'confirmed', 'guide')).toBeNull();
    expect(allowedExtraTransition('settle', 'driver', 'confirmed')).toBeNull();
    expect(allowedExtraTransition('void', 'driver', 'logged', 'driver')).toBe('voided');
    expect(allowedExtraTransition('void', 'driver', 'settled', 'driver')).toBeNull();
  });
});

describe('renderExtraCapsule payer-aware recipient (T1-2)', () => {
  it('names the driver when the driver advanced it, the guide otherwise', () => {
    expect(renderExtraCapsule('logged', '입장권', 48000, 'driver').translations.ko).toContain('기사님에게');
    expect(renderExtraCapsule('logged', '입장권', 48000, 'guide').translations.ko).toContain('가이드에게');
    expect(renderExtraCapsule('logged', 'ticket', 48000, 'driver').translations.en).toContain('your driver');
  });
});

describe('extras API', () => {
  it('guide logs an expense → row + logged capsule with amount', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await extrasPOST(
      fakeReq({
        headers: { 'x-tour-room-auth': session('guide') },
        json: { item: '입장권 4매', amount_krw: 48000, kind: 'advance' },
      }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_extras[0]).toMatchObject({ item: '입장권 4매', amount_krw: 48000, kind: 'advance', payer: 'guide' });
    const capsule = db.inserts.tour_room_messages[0];
    expect(capsule.metadata).toMatchObject({ kind: 'extra_ledger', status: 'logged', amount_krw: 48000 });
    expect((capsule.translations as Record<string, string>).ko).toContain('₩48,000');
  });

  it('T1-3 — a multipart log with a receipt stores receipt_photo_url on the row + capsule', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const receipt = new File([Buffer.from('img')], 'r.jpg', { type: 'image/jpeg' });
    const form = new Map<string, unknown>([
      ['item', '입장권 4매'],
      ['amount_krw', '48000'],
      ['kind', 'ticket'],
      ['receipt', receipt],
    ]);
    const req = {
      nextUrl: { searchParams: new URLSearchParams() },
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type'
            ? 'multipart/form-data; boundary=x'
            : name.toLowerCase() === 'x-tour-room-auth'
              ? session('driver')
              : null,
      },
      formData: async () => ({ get: (k: string) => form.get(k) ?? null }),
    } as never;
    const res = await extrasPOST(req, routeParams());
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_extras[0]).toMatchObject({ kind: 'ticket', payer: 'driver', receipt_photo_url: 'https://x/att/receipt.jpg' });
    expect(db.inserts.tour_room_messages[0].metadata).toMatchObject({ receipt_photo_url: 'https://x/att/receipt.jpg' });
  });

  it('T2-2 — translates the ledger item into each locale on the capsule', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    translateItemMock.mockResolvedValueOnce({
      source_locale: 'ko',
      translations: { en: '4 admission tickets', ko: '입장권 4매', ja: '入場券4枚', es: '4 entradas', zh: '4张门票' },
    });
    const res = await extrasPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { item: '입장권 4매', amount_krw: 48000, kind: 'ticket' } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const capsule = db.inserts.tour_room_messages[0];
    expect(capsule.metadata).toMatchObject({ item_i18n: { en: '4 admission tickets' } });
    expect((capsule.translations as Record<string, string>).en).toContain('4 admission tickets');
  });

  it('customers cannot log; invalid amounts are rejected', async () => {
    const asCustomer = await extrasPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { item: 'x', amount_krw: 1000 } }),
      routeParams(),
    );
    expect(asCustomer.status).toBe(403);
    const badAmount = await extrasPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { item: 'x', amount_krw: -5 } }),
      routeParams(),
    );
    expect(badAmount.status).toBe(400);
  });

  it('customer confirm → confirmed capsule; guide settle → settled_via cash', async () => {
    const logged = { id: 'e-1', room_id: 'room-1', item: 'Taxi', amount_krw: 20000, kind: 'other', payer: 'guide', status: 'logged' };
    let db = fakeDb({ extra: logged });
    createServerClientMock.mockReturnValue(db);
    const confirmRes = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { extraId: 'e-1', action: 'confirm' } }),
      routeParams(),
    );
    expect(confirmRes.status).toBe(200);
    expect(db.updates.tour_room_extras[0]).toMatchObject({ status: 'confirmed' });
    expect(db.inserts.tour_room_messages[0].metadata).toMatchObject({ status: 'confirmed' });

    db = fakeDb({ extra: { ...logged, status: 'confirmed' } });
    createServerClientMock.mockReturnValue(db);
    const settleRes = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { extraId: 'e-1', action: 'settle' } }),
      routeParams(),
    );
    expect(settleRes.status).toBe(200);
    expect(db.updates.tour_room_extras[0]).toMatchObject({ status: 'settled', settled_via: 'cash' });
  });

  it('T1-2 — a driver settles their own advance; a guide-paid row is 403', async () => {
    const own = { id: 'e-1', room_id: 'room-1', item: '입장권', amount_krw: 48000, kind: 'ticket', payer: 'driver', status: 'confirmed' };
    const db = fakeDb({ extra: own });
    createServerClientMock.mockReturnValue(db);
    const ok = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('driver') }, json: { extraId: 'e-1', action: 'settle' } }),
      routeParams(),
    );
    expect(ok.status).toBe(200);
    expect(db.updates.tour_room_extras[0]).toMatchObject({ status: 'settled', settled_via: 'cash' });

    createServerClientMock.mockReturnValue(fakeDb({ extra: { ...own, payer: 'guide' } }));
    const denied = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('driver') }, json: { extraId: 'e-1', action: 'settle' } }),
      routeParams(),
    );
    expect(denied.status).toBe(403);
  });

  it('customer settle is 403; unknown extra is 404', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ extra: { id: 'e-1', status: 'confirmed', item: 'x', amount_krw: 1 } }));
    const res = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { extraId: 'e-1', action: 'settle' } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    createServerClientMock.mockReturnValue(fakeDb({ extra: null }));
    const missing = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { extraId: 'e-9', action: 'settle' } }),
      routeParams(),
    );
    expect(missing.status).toBe(404);
  });

  it('settlement summary capsule lists items + total + ATM hint (G4/G7)', async () => {
    const db = fakeDb({ extra: { id: 'e-1', item: 'Taxi', amount_krw: 20000, status: 'confirmed' } });
    createServerClientMock.mockReturnValue(db);
    const res = await extrasPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { summary: true } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const capsule = db.inserts.tour_room_messages[0];
    expect(capsule.metadata).toMatchObject({ kind: 'settlement_summary', total_krw: 20000, count: 1 });
    expect((capsule.translations as Record<string, string>).ko).toContain('합계 ₩20,000');
    expect((capsule.translations as Record<string, string>).ko).toContain('ATM');
  });

  it('freezes the ledger after the post_tour window (P-D12)', async () => {
    // Dynamic past date (5 days ago) — always > tour-day end + 48h.
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const db = fakeDb({ extra: { id: 'e-1', item: 'Taxi', amount_krw: 20000, status: 'logged' } });
    const oldBookingDb = {
      ...db,
      from(table: string) {
        const chain = db.from(table);
        if (table === 'bookings') {
          const resolve = async () => ({ data: { ...BOOKING, tour_date: oldDate }, error: null });
          chain.single = jest.fn(resolve);
          chain.maybeSingle = jest.fn(resolve);
        }
        return chain;
      },
    };
    createServerClientMock.mockReturnValue(oldBookingDb);
    const res = await extrasPATCH(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { extraId: 'e-1', action: 'settle' } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'post_tour_window_closed' });
  });

  it('GET sums unsettled amounts', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb({ extra: { id: 'e-1', item: 'Taxi', amount_krw: 20000, status: 'logged' } }),
    );
    const res = await extrasGET(fakeReq({ headers: { 'x-tour-room-auth': session('customer') } }), routeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ unsettled_krw: 20000 });
  });
});
