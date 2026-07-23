/**
 * 체크인 QR nonce — AtoC 통합 플랜 §5.4 C-13①.
 *
 * 가이드 콘솔이 룸 체크인 QR을 표시하고, 게스트가 스캔한 URL의 nonce +
 * 저장된 개인 토큰으로 체크인한다. nonce는 5분 로테이션 HMAC:
 * `{bucket}.{hmac12}` where hmac = HMAC-SHA256(secret, domain:roomId:bucket).
 * 서버 상태 없음 — 검증은 현재 버킷과 직전 버킷(경계에서 스캔한 QR 허용)만
 * 통과시킨다. 시크릿은 기존 TOUR_ROOM_TOKEN_SECRET 재사용(+PREV 로테이션).
 *
 * QR nonce는 "화면 앞에 실제로 있음"의 증거일 뿐 신원이 아니다 — 신원은
 * 항상 개인 토큰이 담당한다 (둘 다 있어야 guest_qr 체크인 성립).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { TOUR_ROOM_TOKEN_DEV_SECRET } from '@/lib/tour-room/token';

const DOMAIN = 'ops-checkin-nonce';
export const CHECKIN_NONCE_BUCKET_MS = 5 * 60 * 1000;

function secrets(): string[] {
  const primary =
    process.env.TOUR_ROOM_TOKEN_SECRET || TOUR_ROOM_TOKEN_DEV_SECRET;
  const out = [primary];
  const prev = process.env.TOUR_ROOM_TOKEN_SECRET_PREV;
  if (prev && !out.includes(prev)) out.push(prev);
  return out;
}

function hmacFor(roomId: string, bucket: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${DOMAIN}:${roomId}:${bucket}`)
    .digest('hex')
    .slice(0, 12);
}

/** 현재 nonce + 다음 로테이션까지 남은 초 (가이드 콘솔 QR 갱신 타이머용). */
export function mintCheckinNonce(
  roomId: string,
  nowMs = Date.now(),
): { nonce: string; rotatesInSec: number } {
  const bucket = Math.floor(nowMs / CHECKIN_NONCE_BUCKET_MS);
  const nonce = `${bucket}.${hmacFor(roomId, bucket, secrets()[0])}`;
  const rotatesInSec = Math.ceil(((bucket + 1) * CHECKIN_NONCE_BUCKET_MS - nowMs) / 1000);
  return { nonce, rotatesInSec };
}

/** 현재 버킷 또는 직전 버킷의 nonce만 유효 (5분 로테이션 + 스캔 지연 유예). */
export function verifyCheckinNonce(
  roomId: string,
  nonce: unknown,
  nowMs = Date.now(),
): boolean {
  if (typeof nonce !== 'string' || !nonce.includes('.')) return false;
  const [bucketRaw, sig] = nonce.split('.', 2);
  const bucket = Number(bucketRaw);
  if (!Number.isInteger(bucket) || !sig) return false;

  const current = Math.floor(nowMs / CHECKIN_NONCE_BUCKET_MS);
  if (bucket !== current && bucket !== current - 1) return false;

  for (const secret of secrets()) {
    const expected = hmacFor(roomId, bucket, secret);
    try {
      const a = Buffer.from(sig, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      return false;
    }
  }
  return false;
}
