/**
 * @jest-environment node
 *
 * Ops Freedom — manual booking entry (OTA/direct/test) API.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as mbGET, POST as mbPOST } from '@/app/api/admin/tour-ops/manual-booking/route';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/email-templates/admin-booking-alert', () => ({
  sendAdminBookingAlert: jest.fn(async () => ({ sent: 1, failed: 0 })),
}));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

function fakeDb() {
  const inserts: Array<Record<string, unknown>> = [];
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order']) chain[m] = jest.fn(() => chain);
      const resolve = async () => {
        if (table === 'tours') {
          return { data: { id: 'tour-1', title: 'Jeju Grand Loop', merchant_id: 'm-1', price_currency: 'KRW' }, error: null };
        }
        return { data: null, error: null };
      };
      chain.maybeSingle = jest.fn(resolve);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: 'tour-1', title: 'Jeju Grand Loop', city: 'Jeju' }], error: null }).then(res, rej);
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        inserts.push(values);
        return { select: () => ({ single: async () => ({ data: { id: 'b-new', ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(json?: unknown) {
  return {
    headers: { get: () => null },
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => json ?? {},
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1' });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('manual-booking API', () => {
  it('rejects non-admin callers', async () => {
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'));
    expect((await mbGET(fakeReq())).status).toBe(403);
    expect((await mbPOST(fakeReq({}))).status).toBe(403);
  });

  it('validates required fields', async () => {
    const res = await mbPOST(fakeReq({ tourId: 't', tourDate: 'not-a-date', contactName: '' }));
    expect(res.status).toBe(400);
  });

  it('creates a payment-cron-safe confirmed booking with the channel recorded', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await mbPOST(
      fakeReq({
        tourId: 'tour-1',
        tourDate: '2026-09-12',
        tourTime: '08:00',
        contactName: 'Caroline Anne',
        contactEmail: 'customer-x@reply.getyourguide.com',
        numberOfGuests: 1,
        preferredLanguage: 'fr',
        channel: 'gyg',
        externalRef: 'GYGBLHK75KZ3',
        totalPrice: 97000,
      }),
    );
    expect(res.status).toBe(201);
    const row = db.inserts[0];
    expect(row).toMatchObject({
      tour_id: 'tour-1',
      merchant_id: 'm-1',
      tour_date: '2026-09-12',
      booking_date: '2026-09-12',
      tour_time: '08:00:00',
      status: 'confirmed',
      source: 'gyg',
      final_price: 97000,
      preferred_language: 'fr',
    });
    // Cron safety: no stripe fields — capture needs payment_intent_id, re-auth
    // needs card_collection_method='setup_intent_then_hold'.
    expect(row.payment_intent_id).toBeUndefined();
    expect(row.card_collection_method).toBeUndefined();
    expect(JSON.parse(String(row.special_requests))).toMatchObject({
      channel: 'gyg',
      external_ref: 'GYGBLHK75KZ3',
      manual_entry: true,
    });
  });

  it('GET returns the active tour picker list', async () => {
    const res = await mbGET(fakeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).tours[0]).toMatchObject({ id: 'tour-1', city: 'Jeju' });
  });
});
