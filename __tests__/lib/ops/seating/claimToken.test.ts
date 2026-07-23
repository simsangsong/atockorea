/**
 * @jest-environment node
 *
 * §5.1 룸 claim 토큰 — 서명 라운드트립, 변조, 만료, 그리고 기존
 * lib/tour-room/token.ts와의 도메인 분리(상호 통용 불가).
 */
import { signRoomClaimToken, verifyRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { signCustomerRoomToken, verifyRoomToken } from '@/lib/tour-room/token';

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const PAST = '2020-01-01';

describe('room claim token (§5.1)', () => {
  it('round-trips a valid token', () => {
    const { token, payload } = signRoomClaimToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE });
    const verified = verifyRoomClaimToken(token);
    expect(verified).not.toBeNull();
    expect(verified).toMatchObject({ scope: 'room-claim', roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE });
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tampered payloads and garbage', () => {
    const { token } = signRoomClaimToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE });
    const [body, sig] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.roomId = 'room-EVIL';
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString('base64url');
    expect(verifyRoomClaimToken(`${forgedBody}.${sig}`)).toBeNull();
    expect(verifyRoomClaimToken('not-a-token')).toBeNull();
    expect(verifyRoomClaimToken(null)).toBeNull();
    expect(verifyRoomClaimToken(`${body}.deadbeef`)).toBeNull();
  });

  it('rejects expired tokens (투어일+1 경과)', () => {
    const { token } = signRoomClaimToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: PAST });
    expect(verifyRoomClaimToken(token)).toBeNull();
  });

  it('is domain-separated from room tokens (상호 통용 불가)', () => {
    const claim = signRoomClaimToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE }).token;
    const personal = signCustomerRoomToken({ bookingId: 'b1', displayName: 'G', tourDate: FUTURE }).token;
    // claim 토큰은 룸 API 인증에 절대 못 쓰고, 개인 토큰은 claim 검증에 못 쓴다.
    expect(verifyRoomToken(claim)).toBeNull();
    expect(verifyRoomClaimToken(personal)).toBeNull();
  });
});
