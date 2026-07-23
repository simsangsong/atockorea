/**
 * @jest-environment node
 *
 * §5.4c 룸 체크인 QR 토큰 — 라운드트립, 만료, 도메인 분리, URL 스킴 2변형.
 */
import {
  signRoomCheckinToken,
  verifyRoomCheckinToken,
  buildCheckinUrls,
} from '@/lib/ops/seating/checkinToken';
import { verifyRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { verifyRoomToken } from '@/lib/tour-room/token';

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

describe('room check-in token (§5.4c)', () => {
  it('round-trips and rejects tamper/expiry', () => {
    const { token } = signRoomCheckinToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE });
    expect(verifyRoomCheckinToken(token)).toMatchObject({
      scope: 'room-checkin',
      roomId: 'room-1',
      tourDate: FUTURE,
    });
    // 서명 첫 글자를 뒤집으면 검증 실패 (진짜 변조).
    const flipped = (token[0] === 'a' ? 'b' : 'a') + token.slice(1);
    expect(verifyRoomCheckinToken(flipped)).toBeNull();
    expect(verifyRoomCheckinToken('garbage')).toBeNull();
    const expired = signRoomCheckinToken({ roomId: 'room-1', tourId: 't', tourDate: '2020-01-01' }).token;
    expect(verifyRoomCheckinToken(expired)).toBeNull();
  });

  it('is domain-separated from room tokens and claim tokens', () => {
    const { token } = signRoomCheckinToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE });
    expect(verifyRoomToken(token)).toBeNull();
    expect(verifyRoomClaimToken(token)).toBeNull();
  });

  it('builds console (nonce) and static (print) URL variants', () => {
    const urls = buildCheckinUrls('https://atockorea.com/', 'tok.abc', '123.def');
    expect(urls.consoleUrl).toBe('https://atockorea.com/tour-mode/checkin/tok.abc?n=123.def');
    expect(urls.staticUrl).toBe('https://atockorea.com/tour-mode/checkin/tok.abc');
  });
});
