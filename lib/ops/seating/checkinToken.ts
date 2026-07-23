/**
 * 룸 체크인 QR 토큰 — AtoC 통합 플랜 §5.4c (D16, 가이드 QR 원탭 플로우).
 *
 * QR URL 스킴 (룸당 1장):
 *   콘솔 표시용:  {origin}/tour-mode/checkin/{roomCheckinToken}?n={nonce}
 *   인쇄(정적)용: {origin}/tour-mode/checkin/{roomCheckinToken}
 *
 * roomCheckinToken은 "어느 룸의 QR인가"만 증명한다 — 신원은 항상 게스트
 * 디바이스에 저장된 개인 토큰(§5.1 2층)이 담당하고, 둘이 합쳐져야 체크인이
 * 성립한다. nonce(qrNonce.ts, 5분 로테이션)는 콘솔 변형에만 붙는 현장성
 * 증거이고, 인쇄 변형은 nonce 없이 통과시킨다 (플랜 Q-1: 원격 체크인 잔여
 * 리스크는 가이드의 실물 대조로 상쇄 — 문서화된 트레이드오프).
 *
 * claimToken.ts와 같은 이유로 lib/tour-room/token.ts는 수정하지 않는다 —
 * HMAC 도메인 `ops-room-checkin:` 분리로 상호 통용 불가.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  TOUR_ROOM_TOKEN_DEV_SECRET,
  roomTokenExpiryForTourDate,
} from '@/lib/tour-room/token';

const DOMAIN = 'ops-room-checkin:';

export interface RoomCheckinTokenPayload {
  scope: 'room-checkin';
  /** tour_rooms.id — 체크인 라우트 경로의 [roomId]. */
  roomId: string;
  tourId: string | null;
  /** YYYY-MM-DD (KST tour day). */
  tourDate: string;
  iat: number;
  exp: number;
}

function primarySecret(): string {
  const secret = process.env.TOUR_ROOM_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[ops-checkin] TOUR_ROOM_TOKEN_SECRET is not set in production — using dev fallback secret');
  }
  return TOUR_ROOM_TOKEN_DEV_SECRET;
}

function verificationSecrets(): string[] {
  const secrets = [primarySecret()];
  const prev = process.env.TOUR_ROOM_TOKEN_SECRET_PREV;
  if (prev && !secrets.includes(prev)) secrets.push(prev);
  return secrets;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${DOMAIN}${body}`).digest('hex');
}

export function signRoomCheckinToken(input: {
  roomId: string;
  tourId: string | null;
  tourDate: string;
}): { token: string; payload: RoomCheckinTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: RoomCheckinTokenPayload = {
    scope: 'room-checkin',
    roomId: input.roomId,
    tourId: input.tourId ?? null,
    tourDate: input.tourDate,
    iat,
    exp: roomTokenExpiryForTourDate(input.tourDate),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body, primarySecret())}`, payload };
}

export function verifyRoomCheckinToken(token: unknown): RoomCheckinTokenPayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  let matched = false;
  for (const secret of verificationSecrets()) {
    const expected = sign(body, secret);
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) {
        matched = true;
        break;
      }
    } catch {
      return null;
    }
  }
  if (!matched) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (payload.scope !== 'room-checkin') return null;
  if (typeof payload.roomId !== 'string' || !payload.roomId) return null;
  if (typeof payload.tourDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.tourDate)) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as unknown as RoomCheckinTokenPayload;
}

/** QR URL 빌더 — 콘솔(nonce 포함)/인쇄(정적) 두 변형 (§5.4c). */
export function buildCheckinUrls(origin: string, token: string, nonce: string): {
  consoleUrl: string;
  staticUrl: string;
} {
  const base = `${origin.replace(/\/$/, '')}/tour-mode/checkin/${encodeURIComponent(token)}`;
  return { consoleUrl: `${base}?n=${encodeURIComponent(nonce)}`, staticUrl: base };
}
