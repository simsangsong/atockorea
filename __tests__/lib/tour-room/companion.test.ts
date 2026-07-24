/**
 * @jest-environment node
 *
 * §5.2 C-6 — 동행자 초대 토큰(스코프·만료·도메인 분리) + 정원 산술.
 */
import {
  signCompanionInviteToken,
  verifyCompanionInviteToken,
} from '@/lib/tour-room/companionToken';
import {
  isCompanionRoomToken,
  signCompanionRoomToken,
  signCustomerRoomToken,
  verifyRoomToken,
  roomTokenExpiryForTourDate,
} from '@/lib/tour-room/token';
import { signRoomClaimToken, verifyRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { companionCapacity, companionFullMessage, companionSlots } from '@/lib/tour-room/companion';

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const PAST = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

describe('companion invite token (§5.2 C-6)', () => {
  it('round-trips and is scoped to exactly one booking', () => {
    const { token, payload } = signCompanionInviteToken({ bookingId: 'bk-1', tourDate: FUTURE });
    expect(payload).toMatchObject({ scope: 'companion-invite', bookingId: 'bk-1', tourDate: FUTURE });
    expect(verifyCompanionInviteToken(token)).toMatchObject({ bookingId: 'bk-1' });
  });

  it('expires with the tour day + 1, exactly like the room claim link', () => {
    const { payload } = signCompanionInviteToken({ bookingId: 'bk-1', tourDate: FUTURE });
    expect(payload.exp).toBe(roomTokenExpiryForTourDate(FUTURE));
  });

  it('refuses a token whose tour date has already passed', () => {
    const { token } = signCompanionInviteToken({ bookingId: 'bk-1', tourDate: PAST });
    expect(verifyCompanionInviteToken(token)).toBeNull();
  });

  it('refuses tampering, garbage and non-strings', () => {
    const { token } = signCompanionInviteToken({ bookingId: 'bk-1', tourDate: FUTURE });
    const [body, sig] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ scope: 'companion-invite', bookingId: 'bk-EVIL', tourDate: FUTURE, iat: 1, exp: 9e9 }),
    ).toString('base64url');
    expect(verifyCompanionInviteToken(`${forgedBody}.${sig}`)).toBeNull();
    expect(verifyCompanionInviteToken(`${body}.${'0'.repeat(64)}`)).toBeNull();
    expect(verifyCompanionInviteToken('nope')).toBeNull();
    expect(verifyCompanionInviteToken(null)).toBeNull();
    expect(verifyCompanionInviteToken(42)).toBeNull();
  });

  it('is HMAC-domain separated: an invite is not a room token and vice versa', () => {
    const invite = signCompanionInviteToken({ bookingId: 'bk-1', tourDate: FUTURE }).token;
    const room = signCustomerRoomToken({ bookingId: 'bk-1', displayName: 'Lead', tourDate: FUTURE }).token;
    const claim = signRoomClaimToken({ roomId: 'r1', tourId: 't1', tourDate: FUTURE }).token;

    // 초대 토큰은 룸 API에 절대 통용되지 않는다.
    expect(verifyRoomToken(invite)).toBeNull();
    // 룸/claim 토큰으로 동행자 등록을 열 수도 없다.
    expect(verifyCompanionInviteToken(room)).toBeNull();
    expect(verifyCompanionInviteToken(claim)).toBeNull();
    expect(verifyRoomClaimToken(invite)).toBeNull();
  });
});

describe('companion personal token', () => {
  it('verifies as a normal booking-scope customer token but carries the companion mark', () => {
    const { token } = signCompanionRoomToken({ bookingId: 'bk-1', displayName: 'Sofia', tourDate: FUTURE });
    const payload = verifyRoomToken(token);
    expect(payload).toMatchObject({ scope: 'booking', role: 'customer', bookingId: 'bk-1' });
    expect(isCompanionRoomToken(payload)).toBe(true);
  });

  it('does not mark a lead token as a companion', () => {
    const { token } = signCustomerRoomToken({ bookingId: 'bk-1', displayName: 'Lead', tourDate: FUTURE });
    expect(isCompanionRoomToken(verifyRoomToken(token))).toBe(false);
    expect(isCompanionRoomToken(null)).toBe(false);
  });
});

describe('companion capacity (party-size cap)', () => {
  it('caps devices at the booked party size, lead included', () => {
    // 2인 예약: lead 1대 등록 → 동행자 1자리.
    expect(companionSlots(2, 1)).toEqual({ capacity: 2, used: 1, remaining: 1, full: false });
    // 그 1자리를 쓰면 끝 — 9대가 쌓일 수 없다.
    expect(companionSlots(2, 2)).toEqual({ capacity: 2, used: 2, remaining: 0, full: true });
    expect(companionSlots(2, 9)).toMatchObject({ remaining: 0, full: true });
  });

  it('is conservative about missing/absurd party sizes', () => {
    expect(companionCapacity(null)).toBe(1);
    expect(companionCapacity(undefined)).toBe(1);
    expect(companionCapacity(0)).toBe(1);
    expect(companionCapacity(-4)).toBe(1);
    expect(companionCapacity(2.7)).toBe(2);
    expect(companionCapacity(9999)).toBe(20);
  });

  it('degrades with a human sentence, not a stack trace', () => {
    expect(companionFullMessage('ko')).toContain('예약');
    expect(companionFullMessage('ja')).toBeTruthy();
    expect(companionFullMessage('pt')).toBe(companionFullMessage('en'));
    expect(companionFullMessage(null)).toBe(companionFullMessage('en'));
  });
});
