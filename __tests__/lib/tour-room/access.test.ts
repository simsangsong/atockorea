/**
 * T0.5 — resolveRoomActor authorization matrix
 * (admin / invite token / room session / owner / merchant guide / guest).
 */
import type { NextRequest } from 'next/server';
import {
  matchesGuestCredentials,
  resolveRoomActor,
  signRoomSession,
  tokenMatchesBooking,
  verifyRoomSession,
  type RoomBooking,
  type RoomDbClient,
} from '@/lib/tour-room/access';
import { signCustomerRoomToken, signGuideRoomToken } from '@/lib/tour-room/token';
import { getAuthUser } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
const getAuthUserMock = getAuthUser as jest.Mock;

const BOOKING: RoomBooking = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2026-07-15',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'en',
};

function fakeDb(options?: {
  booking?: RoomBooking | null;
  revokedHashes?: Set<string>;
  knownHashes?: Set<string>;
}): RoomDbClient {
  const booking = options?.booking === undefined ? BOOKING : options.booking;
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, value: unknown) {
              return {
                async single() {
                  if (table === 'bookings') {
                    return booking && value === booking.id
                      ? { data: booking, error: null }
                      : { data: null, error: { message: 'not found' } };
                  }
                  return { data: null, error: { message: 'unexpected' } };
                },
                async maybeSingle() {
                  if (table === 'tour_room_invites') {
                    const hash = String(value);
                    if (options?.revokedHashes?.has(hash)) {
                      return { data: { id: 'inv-1', revoked_at: '2026-07-14T00:00:00Z' }, error: null };
                    }
                    if (options?.knownHashes?.has(hash)) {
                      return { data: { id: 'inv-1', revoked_at: null }, error: null };
                    }
                    return { data: null, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        upsert() {
          return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
        },
      };
    },
  } as RoomDbClient;
}

function fakeReq(input?: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): NextRequest {
  const params = new URLSearchParams(input?.query ?? {});
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: params },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
  } as unknown as NextRequest;
}

describe('lib/tour-room/access', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TOUR_ROOM_TOKEN_SECRET: 'unit-test-secret' };
    getAuthUserMock.mockReset();
    getAuthUserMock.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('404s when the booking does not exist', async () => {
    const result = await resolveRoomActor(fakeReq(), 'missing', { supabase: fakeDb({ booking: null }) });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  describe('path 1 — admin', () => {
    it('authenticates admins regardless of other credentials', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb() });
      expect(result).toMatchObject({ ok: true, actor: { kind: 'admin', role: 'admin' } });
    });
  });

  describe('path 2 — invite token', () => {
    it('accepts a valid customer token for its own booking (?rt= query)', async () => {
      const { token } = signCustomerRoomToken({
        bookingId: BOOKING.id,
        displayName: 'Alex',
        tourDate: BOOKING.tour_date!,
      });
      const result = await resolveRoomActor(fakeReq({ query: { rt: token } }), BOOKING.id, {
        supabase: fakeDb(),
      });
      expect(result).toMatchObject({
        ok: true,
        actor: { kind: 'token', role: 'customer', displayName: 'Alex' },
      });
    });

    it('accepts a guide token whose tour-date scope covers the booking (§O-3)', async () => {
      const { token } = signGuideRoomToken({
        tourId: BOOKING.tour_id!,
        tourDate: BOOKING.tour_date!,
        displayName: 'Guide Lee',
      });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb(),
        token,
      });
      expect(result).toMatchObject({ ok: true, actor: { kind: 'token', role: 'guide' } });
    });

    it.each([
      ['another booking', signCustomerRoomToken({ bookingId: 'other', displayName: 'X', tourDate: '2026-07-15' })],
      ['another tour', signGuideRoomToken({ tourId: 'other-tour', tourDate: '2026-07-15', displayName: 'X' })],
      ['another date', signGuideRoomToken({ tourId: 'tour-1', tourDate: '2026-07-16', displayName: 'X' })],
    ])('rejects a token scoped to %s', async (_label, signed) => {
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb(),
        token: signed.token,
      });
      expect(result).toMatchObject({ ok: false, status: 403 });
    });

    it('rejects a revoked token via the invite ledger (§O-1 ⑧)', async () => {
      const { token } = signCustomerRoomToken({
        bookingId: BOOKING.id,
        displayName: 'Alex',
        tourDate: BOOKING.tour_date!,
      });
      const { hashToken } = jest.requireActual('@/lib/tour-room/token');
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb({ revokedHashes: new Set([hashToken(token)]) }),
        token,
      });
      expect(result).toMatchObject({ ok: false, status: 403 });
    });

    it('still allows a known, un-revoked ledger token', async () => {
      const { token } = signCustomerRoomToken({
        bookingId: BOOKING.id,
        displayName: 'Alex',
        tourDate: BOOKING.tour_date!,
      });
      const { hashToken } = jest.requireActual('@/lib/tour-room/token');
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb({ knownHashes: new Set([hashToken(token)]) }),
        token,
      });
      expect(result).toMatchObject({ ok: true, actor: { kind: 'token' } });
    });

    it('falls through to owner auth when the token is garbage', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
      const result = await resolveRoomActor(fakeReq({ query: { rt: 'garbage.token' } }), BOOKING.id, {
        supabase: fakeDb(),
      });
      expect(result).toMatchObject({ ok: true, actor: { kind: 'owner' } });
    });
  });

  describe('path 3 — room session', () => {
    it('accepts a signed room session for this booking', async () => {
      const { session } = signRoomSession({
        roomId: 'room-1',
        bookingId: BOOKING.id,
        participantId: 'p-1',
        role: 'customer',
        displayName: 'Alex',
      });
      const result = await resolveRoomActor(
        fakeReq({ headers: { 'x-tour-room-auth': session } }),
        BOOKING.id,
        { supabase: fakeDb() },
      );
      expect(result).toMatchObject({
        ok: true,
        actor: { kind: 'session', role: 'customer', sessionPayload: { participantId: 'p-1' } },
      });
    });

    it('rejects a session minted for a different booking', async () => {
      const { session } = signRoomSession({
        roomId: 'room-2',
        bookingId: 'other-booking',
        participantId: 'p-9',
        role: 'customer',
        displayName: 'Mallory',
      });
      const result = await resolveRoomActor(
        fakeReq({ headers: { 'x-tour-room-auth': session } }),
        BOOKING.id,
        { supabase: fakeDb() },
      );
      expect(result).toMatchObject({ ok: false, status: 403 });
    });

    it('rejects expired and tampered sessions at verify level', () => {
      const { session } = signRoomSession(
        { roomId: 'r', bookingId: 'b', participantId: 'p', role: 'guide', displayName: 'G' },
        -10, // already expired
      );
      expect(verifyRoomSession(session)).toBeNull();

      const { session: good } = signRoomSession({
        roomId: 'r',
        bookingId: 'b',
        participantId: 'p',
        role: 'guide',
        displayName: 'G',
      });
      const [body, sig] = good.split('.');
      expect(verifyRoomSession(`${body}.${'0'.repeat(sig.length)}`)).toBeNull();
      expect(verifyRoomSession('not-a-session')).toBeNull();
    });
  });

  describe('path 4 — booking owner', () => {
    it('authenticates the logged-in owner', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb() });
      expect(result).toMatchObject({ ok: true, actor: { kind: 'owner', userId: 'user-owner' } });
    });

    it('does not authenticate an unrelated logged-in user', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'someone-else', role: 'customer' });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb() });
      expect(result).toMatchObject({ ok: false, status: 403 });
    });
  });

  describe('path 5 — merchant guide', () => {
    it('authenticates the merchant owning the booking as guide', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'user-m', role: 'merchant', merchantId: 'merchant-1' });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb() });
      expect(result).toMatchObject({
        ok: true,
        actor: { kind: 'merchant-guide', role: 'guide', merchantId: 'merchant-1' },
      });
    });

    it('rejects a different merchant', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'user-m', role: 'merchant', merchantId: 'merchant-2' });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb() });
      expect(result).toMatchObject({ ok: false, status: 403 });
    });
  });

  describe('path 6 — guest email match (PA-4 gated)', () => {
    it('authenticates on matching contact email (name optional)', async () => {
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb(),
        guestEmail: ' Alex@Example.com ',
      });
      expect(result).toMatchObject({ ok: true, actor: { kind: 'guest', role: 'customer' } });
    });

    it('rejects a name mismatch and missing credentials', async () => {
      const mismatch = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb(),
        guestEmail: 'alex@example.com',
        guestName: 'Not Alex',
      });
      expect(mismatch).toMatchObject({ ok: false, status: 403 });

      const empty = await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb() });
      expect(empty).toMatchObject({ ok: false, status: 403 });
    });

    it('answers 429 when the guest gate denies, before matching', async () => {
      const guestGate = jest.fn().mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
      const result = await resolveRoomActor(fakeReq(), BOOKING.id, {
        supabase: fakeDb(),
        guestEmail: 'alex@example.com',
        guestGate,
      });
      expect(result).toMatchObject({ ok: false, status: 429, retryAfterMs: 30_000 });
    });

    it('never invokes the gate for role-authenticated requests', async () => {
      getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
      const guestGate = jest.fn();
      await resolveRoomActor(fakeReq(), BOOKING.id, { supabase: fakeDb(), guestGate });
      expect(guestGate).not.toHaveBeenCalled();
    });
  });

  describe('pure helpers', () => {
    it('tokenMatchesBooking requires tour_id AND tour_date for guide scope', () => {
      const guide = signGuideRoomToken({ tourId: 'tour-1', tourDate: '2026-07-15', displayName: 'G' }).payload;
      expect(tokenMatchesBooking(guide, BOOKING)).toBe(true);
      expect(tokenMatchesBooking(guide, { ...BOOKING, tour_id: null })).toBe(false);
      expect(tokenMatchesBooking(guide, { ...BOOKING, tour_date: null })).toBe(false);
    });

    it('matchesGuestCredentials never matches on empty email', () => {
      expect(matchesGuestCredentials({ contact_email: '', contact_name: 'A' }, '')).toBe(false);
      expect(matchesGuestCredentials({ contact_email: null, contact_name: null }, null)).toBe(false);
    });
  });
});
