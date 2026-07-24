/**
 * @jest-environment node
 *
 * T5.1/T5.3/T5.4 — invite dispatch: revoke-then-mint, ledger rows, localized
 * mails, cancellation hook, dedupe helper, and the admin route's flag gate.
 */
import '@/test-utils/restoreWebPrimitives';
import {
  dispatchRoomInvites,
  hasActiveCustomerInvite,
  revokeRoomForCancelledBooking,
  type DispatchDbClient,
} from '@/lib/tour-room/dispatch';
import { POST as dispatchPOST } from '@/app/api/admin/orders/[id]/dispatch-room/route';
import { sendEmail } from '@/lib/email';
import { verifyRoomToken } from '@/lib/tour-room/token';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));
jest.mock('qrcode', () => ({ toBuffer: jest.fn(async () => Buffer.from([1, 2, 3])) }));
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const sendEmailMock = sendEmail as jest.Mock;
const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2099-07-20',
  tour_time: '09:00',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  preferred_language: 'ja',
  status: 'confirmed',
};

interface FakeState {
  invites: Array<Record<string, unknown>>;
  revocations: Array<Record<string, unknown>>;
  roomUpdates: Array<Record<string, unknown>>;
  activeInvites?: number;
  tourPriceType?: string | null;
}

function fakeDb(state: FakeState): DispatchDbClient & FakeState {
  const client = {
    ...state,
    storage: {
      listBuckets: async () => ({ data: [{ name: 'tour-room-photos' }] }),
      createBucket: async () => ({ error: null }),
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') {
          return { data: { ...BOOKING, pickup_points: { name: 'Seomyeon', pickup_time: '08:40' } }, error: null };
        }
        if (table === 'tours')
          return {
            data: { title: 'Busan Top Attractions', price_type: state.tourPriceType ?? null },
            error: null,
          };
        if (table === 'merchants') return { data: { contact_email: 'guide@merchant.test' }, error: null };
        if (table === 'tour_room_invites') {
          return { data: Array.from({ length: state.activeInvites ?? 0 }, (_, i) => ({ id: `inv-${i}` })), error: null };
        }
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'in', 'is', 'order', 'limit']) {
        chain[method] = jest.fn((...args: unknown[]) => {
          if (method === 'eq') filters[String(args[0])] = args[1];
          return chain;
        });
      }
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.update = jest.fn((values: Record<string, unknown>) => {
        if (table === 'tour_room_invites') state.revocations.push({ ...values });
        if (table === 'tour_rooms') state.roomUpdates.push({ ...values });
        return chain;
      });
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        if (table === 'tour_room_invites') state.invites.push(values);
        return { then: (r: (v: unknown) => unknown) => r({ data: null, error: null }), error: null };
      });
      return chain;
    },
  };
  return client as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://atockorea.com';
  sendEmailMock.mockResolvedValue({ success: true });
});

describe('dispatchRoomInvites (T5.1)', () => {
  it('revokes prior scope, records hashed invites, and emails both sides', async () => {
    const db = fakeDb({ invites: [], revocations: [], roomUpdates: [] });
    const result = await dispatchRoomInvites(db, BOOKING, { createdBy: 'admin-1' });

    expect(result.customer.sent).toBe(true);
    expect(result.guide.sent).toBe(true);

    // Ledger: one customer (booking scope) + one guide (tour-date scope).
    const customerInvite = db.invites.find((invite) => invite.role === 'customer')!;
    const guideInvite = db.invites.find((invite) => invite.role === 'guide')!;
    expect(customerInvite).toMatchObject({ booking_id: 'booking-1', sent_to: 'alex@example.com' });
    expect(guideInvite).toMatchObject({ tour_id: 'tour-1', tour_date: '2099-07-20', sent_to: 'guide@merchant.test' });
    expect(String(customerInvite.token_hash)).toMatch(/^[0-9a-f]{64}$/); // raw token never stored

    // Revocation ran for both scopes (revoked_at set).
    expect(db.revocations.length).toBeGreaterThanOrEqual(2);

    // Customer mail: localized (ja) with a working room link.
    const customerCall = sendEmailMock.mock.calls.find((c) => c[0].to === 'alex@example.com')![0];
    expect(customerCall.subject).toContain('ツアールーム');
    const url = /href="([^"]+)"/.exec(customerCall.html)![1];
    expect(url).toContain('/tour-mode/room/booking-1?rt=');
    const token = decodeURIComponent(new URL(url).searchParams.get('rt')!);
    expect(verifyRoomToken(token)).toMatchObject({ scope: 'booking', bookingId: 'booking-1' });

    // Guide mail carries a hosted QR image, never a data: URI.
    const guideCall = sendEmailMock.mock.calls.find((c) => c[0].to === 'guide@merchant.test')![0];
    expect(guideCall.html).toContain('https://cdn.test/qr/');
    expect(guideCall.html).not.toContain('data:image');
  });

  it('D2: private (vehicle) tour includes the /plan CTA in the customer mail', async () => {
    const db = fakeDb({ invites: [], revocations: [], roomUpdates: [], tourPriceType: 'vehicle' });
    await dispatchRoomInvites(db, BOOKING, { createdBy: 'admin-1' });
    const customerCall = sendEmailMock.mock.calls.find((c) => c[0].to === 'alex@example.com')![0];
    expect(customerCall.html).toContain('/tour-mode/plan/booking-1?rt=');
  });

  it('D2: join (person/group) tour omits the /plan CTA from the customer mail', async () => {
    const db = fakeDb({ invites: [], revocations: [], roomUpdates: [], tourPriceType: 'person' });
    await dispatchRoomInvites(db, BOOKING, { createdBy: 'admin-1' });
    const customerCall = sendEmailMock.mock.calls.find((c) => c[0].to === 'alex@example.com')![0];
    expect(customerCall.html).not.toContain('/tour-mode/plan/');
    // The room link itself is unchanged — only the plan CTA is gated.
    expect(customerCall.html).toContain('/tour-mode/room/booking-1?rt=');
  });

  it('reports (not throws) a missing contact email', async () => {
    const db = fakeDb({ invites: [], revocations: [], roomUpdates: [] });
    const result = await dispatchRoomInvites(db, { ...BOOKING, contact_email: null });
    expect(result.customer.sent).toBe(false);
    expect(result.customer.error).toContain('contact email');
    expect(result.guide.sent).toBe(true); // guide side unaffected
  });
});

describe('hasActiveCustomerInvite (T5.4 dedupe)', () => {
  it('true with a live invite, false without', async () => {
    expect(await hasActiveCustomerInvite(fakeDb({ invites: [], revocations: [], roomUpdates: [], activeInvites: 1 }), 'b1')).toBe(true);
    expect(await hasActiveCustomerInvite(fakeDb({ invites: [], revocations: [], roomUpdates: [], activeInvites: 0 }), 'b1')).toBe(false);
  });
});

describe('revokeRoomForCancelledBooking (§O-1 ⑧)', () => {
  it('revokes the booking invites and closes the room', async () => {
    const db = fakeDb({ invites: [], revocations: [], roomUpdates: [] });
    await revokeRoomForCancelledBooking(db, 'booking-1');
    expect(db.revocations.length).toBeGreaterThanOrEqual(1);
    expect(db.roomUpdates[0]).toMatchObject({ status: 'closed' });
  });
});

describe('POST /api/admin/orders/[id]/dispatch-room (T5.3)', () => {
  const fakeReq = (json: unknown) =>
    ({
      nextUrl: { searchParams: new URLSearchParams() },
      headers: { get: () => null },
      json: async () => json,
    }) as never;
  const routeParams = () => ({ params: Promise.resolve({ id: 'booking-1' }) });

  it('409s while the launch flag is off, unless forced', async () => {
    delete process.env.NEXT_PUBLIC_TOUR_MODE_V1;
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    createServerClientMock.mockReturnValue(fakeDb({ invites: [], revocations: [], roomUpdates: [] }));

    const blocked = await dispatchPOST(fakeReq({}), routeParams());
    expect(blocked.status).toBe(409);

    const forced = await dispatchPOST(fakeReq({ force: true }), routeParams());
    expect(forced.status).toBe(201);
    const json = await forced.json();
    expect(json.customer.sent).toBe(true);
  });

  it('403s non-admins', async () => {
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'));
    const res = await dispatchPOST(fakeReq({}), routeParams());
    expect(res.status).toBe(403);
  });
});
