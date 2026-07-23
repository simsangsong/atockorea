/**
 * @jest-environment node
 *
 * §5.4 C-13① 체크인 QR nonce — 5분 로테이션, 직전 버킷 유예, 룸 격리.
 */
import {
  mintCheckinNonce,
  verifyCheckinNonce,
  CHECKIN_NONCE_BUCKET_MS,
} from '@/lib/ops/seating/qrNonce';

const T0 = 1_800_000_000_000; // 고정 기준 시각

describe('check-in QR nonce (5분 로테이션)', () => {
  it('verifies the current bucket', () => {
    const { nonce, rotatesInSec } = mintCheckinNonce('room-1', T0);
    expect(verifyCheckinNonce('room-1', nonce, T0)).toBe(true);
    expect(rotatesInSec).toBeGreaterThan(0);
    expect(rotatesInSec).toBeLessThanOrEqual(300);
  });

  it('accepts the previous bucket (경계 스캔 유예) but not older', () => {
    const { nonce } = mintCheckinNonce('room-1', T0);
    expect(verifyCheckinNonce('room-1', nonce, T0 + CHECKIN_NONCE_BUCKET_MS)).toBe(true);
    expect(verifyCheckinNonce('room-1', nonce, T0 + 2 * CHECKIN_NONCE_BUCKET_MS)).toBe(false);
  });

  it('is room-scoped', () => {
    const { nonce } = mintCheckinNonce('room-1', T0);
    expect(verifyCheckinNonce('room-2', nonce, T0)).toBe(false);
  });

  it('rejects malformed nonces', () => {
    expect(verifyCheckinNonce('room-1', '', T0)).toBe(false);
    expect(verifyCheckinNonce('room-1', 'abc', T0)).toBe(false);
    expect(verifyCheckinNonce('room-1', '123.', T0)).toBe(false);
    expect(verifyCheckinNonce('room-1', null, T0)).toBe(false);
    const bucket = Math.floor(T0 / CHECKIN_NONCE_BUCKET_MS);
    expect(verifyCheckinNonce('room-1', `${bucket}.wrongsig12345`, T0)).toBe(false);
  });
});
