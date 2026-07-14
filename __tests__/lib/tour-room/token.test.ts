/**
 * T0.4 — room invite token unit tests: expiry, tamper, role, scope, rotation.
 */
import {
  hashToken,
  roomTokenExpiryForTourDate,
  signCustomerRoomToken,
  signGuideRoomToken,
  verifyRoomToken,
} from '@/lib/tour-room/token';

const FIXED_NOW_MS = Date.UTC(2026, 6, 14, 3, 0, 0); // 2026-07-14 12:00 KST

describe('lib/tour-room/token', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
    delete process.env.TOUR_ROOM_TOKEN_SECRET_PREV;
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  describe('expiry anchoring', () => {
    it('expires at KST end-of-tour-date + 24h', () => {
      // 2026-07-14 23:59:59 KST == 2026-07-14 14:59:59 UTC; +24h grace.
      const expected = Math.floor(Date.UTC(2026, 6, 14, 14, 59, 59) / 1000) + 24 * 60 * 60;
      expect(roomTokenExpiryForTourDate('2026-07-14')).toBe(expected);
    });

    it('rejects malformed and impossible dates', () => {
      expect(() => roomTokenExpiryForTourDate('2026-7-4')).toThrow();
      expect(() => roomTokenExpiryForTourDate('2026-02-30')).toThrow();
      expect(() => roomTokenExpiryForTourDate('not-a-date')).toThrow();
    });

    it('verifies a token for today and rejects one whose tour date has passed the grace window', () => {
      const live = signCustomerRoomToken({
        bookingId: 'b-1',
        displayName: 'Traveller',
        tourDate: '2026-07-14',
      });
      expect(verifyRoomToken(live.token)).toMatchObject({ scope: 'booking', bookingId: 'b-1' });

      const stale = signCustomerRoomToken({
        bookingId: 'b-1',
        displayName: 'Traveller',
        tourDate: '2026-07-10', // grace ended 2026-07-11 23:59:59 KST + 24h < now
      });
      expect(verifyRoomToken(stale.token)).toBeNull();
    });
  });

  describe('scopes and roles', () => {
    it('issues booking-scoped customer tokens', () => {
      const { token, payload } = signCustomerRoomToken({
        bookingId: 'booking-123',
        displayName: 'Kim',
        tourDate: '2026-07-15',
      });
      expect(payload.scope).toBe('booking');
      expect(payload.role).toBe('customer');
      const verified = verifyRoomToken(token);
      expect(verified).toEqual(payload);
    });

    it('issues tour-date-scoped guide tokens (§O-3)', () => {
      const { token, payload } = signGuideRoomToken({
        tourId: 'tour-9',
        tourDate: '2026-07-15',
        displayName: 'Guide Lee',
      });
      expect(payload.scope).toBe('tour-date');
      expect(payload.role).toBe('guide');
      const verified = verifyRoomToken(token);
      expect(verified).toEqual(payload);
    });

    it('rejects a payload whose role/scope combination was tampered with', () => {
      // Forge: take a customer token body, flip role to guide, keep signature.
      const { token } = signCustomerRoomToken({
        bookingId: 'booking-123',
        displayName: 'Kim',
        tourDate: '2026-07-15',
      });
      const [body, sig] = token.split('.');
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      payload.role = 'guide';
      const forgedBody = Buffer.from(JSON.stringify(payload)).toString('base64url');
      expect(verifyRoomToken(`${forgedBody}.${sig}`)).toBeNull();
    });
  });

  describe('tamper resistance', () => {
    it('rejects signature tampering, body tampering, and garbage', () => {
      const { token } = signGuideRoomToken({
        tourId: 'tour-9',
        tourDate: '2026-07-15',
        displayName: 'Guide Lee',
      });
      const [body, sig] = token.split('.');
      expect(verifyRoomToken(`${body}.${'0'.repeat(sig.length)}`)).toBeNull();
      expect(verifyRoomToken(`${body}x.${sig}`)).toBeNull();
      expect(verifyRoomToken('')).toBeNull();
      expect(verifyRoomToken(null)).toBeNull();
      expect(verifyRoomToken('no-dot-here')).toBeNull();
      expect(verifyRoomToken(`${body}.not-hex`)).toBeNull();
    });

    it('rejects tokens signed with a different secret', () => {
      const { token } = signCustomerRoomToken({
        bookingId: 'b-1',
        displayName: 'Kim',
        tourDate: '2026-07-15',
      });
      process.env.TOUR_ROOM_TOKEN_SECRET = 'a-brand-new-secret';
      expect(verifyRoomToken(token)).toBeNull();
    });
  });

  describe('secret rotation (§O-13)', () => {
    it('still verifies tokens signed with the previous secret when PREV is set', () => {
      const { token } = signCustomerRoomToken({
        bookingId: 'b-1',
        displayName: 'Kim',
        tourDate: '2026-07-15',
      });
      process.env.TOUR_ROOM_TOKEN_SECRET = 'rotated-secret';
      process.env.TOUR_ROOM_TOKEN_SECRET_PREV = 'unit-test-secret';
      expect(verifyRoomToken(token)).toMatchObject({ bookingId: 'b-1' });

      // And newly issued tokens use the rotated secret.
      const fresh = signCustomerRoomToken({
        bookingId: 'b-2',
        displayName: 'Kim',
        tourDate: '2026-07-15',
      });
      expect(verifyRoomToken(fresh.token)).toMatchObject({ bookingId: 'b-2' });
    });
  });

  describe('hashToken', () => {
    it('is deterministic and never echoes the token', () => {
      const { token } = signCustomerRoomToken({
        bookingId: 'b-1',
        displayName: 'Kim',
        tourDate: '2026-07-15',
      });
      const hash = hashToken(token);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(hashToken(token));
      expect(hash.includes(token)).toBe(false);
    });
  });
});
