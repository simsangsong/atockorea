/**
 * 룸 초대(claim) 링크 토큰 — AtoC 통합 플랜 §5.1 (조인투어 링크 2계층의 1층).
 *
 * scope = room (tour_id + tour_date). 게스트가 이 링크를 열어 명단에서 본인
 * 이름을 선택(claim)하면 그 순간 기존 booking-scope 개인 토큰
 * (lib/tour-room/token.ts signCustomerRoomToken)이 발급된다 — 이 토큰은
 * 이후 모든 접속·좌석·체크인의 신원이고, 여기 claim 토큰은 명단 조회와
 * claim 1회에만 쓰인다.
 *
 * 의도적으로 lib/tour-room/token.ts를 수정하지 않는다: HMAC 도메인을
 * `ops-room-claim:`으로 분리해 서명 자체가 호환되지 않게 했다 — claim 토큰이
 * verifyRoomToken 소비처(룸 API 전체)에 절대 통용될 수 없고, 그 역도 성립.
 * (기존 파일에 payload 타입을 추가하면 verifyRoomToken의 반환 유니온이 넓어져
 * 모든 기존 소비처의 타입/보안 검토가 필요해진다 — 분리가 더 안전한 additive.)
 *
 * 만료 = 투어일 KST 종료 + 24h (§5.1 "만료=투어일+1") — 기존
 * roomTokenExpiryForTourDate를 그대로 재사용. 폐기는 tour_room_invites에
 * role='room_claim' 행(sha256 해시)으로 원장 기록 후 revoked_at 세팅
 * (20260724090000_ops_room_claim_invites.sql).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  TOUR_ROOM_TOKEN_DEV_SECRET,
  roomTokenExpiryForTourDate,
} from '@/lib/tour-room/token';

/** HMAC 도메인 분리 프리픽스 — token.ts 서명과 절대 호환 금지. */
const DOMAIN = 'ops-room-claim:';

export interface RoomClaimTokenPayload {
  scope: 'room-claim';
  /** tour_rooms.id — claim 라우트 경로의 [roomId]와 일치해야 한다. */
  roomId: string;
  tourId: string;
  /** YYYY-MM-DD (KST tour day). */
  tourDate: string;
  iat: number;
  exp: number;
}

function primarySecret(): string {
  const secret = process.env.TOUR_ROOM_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[ops-claim] TOUR_ROOM_TOKEN_SECRET is not set in production — using dev fallback secret');
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

export function signRoomClaimToken(input: {
  roomId: string;
  tourId: string;
  tourDate: string;
}): { token: string; payload: RoomClaimTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: RoomClaimTokenPayload = {
    scope: 'room-claim',
    roomId: input.roomId,
    tourId: input.tourId,
    tourDate: input.tourDate,
    iat,
    exp: roomTokenExpiryForTourDate(input.tourDate),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body, primarySecret())}`, payload };
}

/**
 * 서명(현재/이전 시크릿) + 형태 + 만료 검증. 폐기(tour_room_invites
 * revoked_at)는 별도 서버측 체크 — 호출자가 hashToken()으로 원장을 조회한다.
 */
export function verifyRoomClaimToken(token: unknown): RoomClaimTokenPayload | null {
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
  if (payload.scope !== 'room-claim') return null;
  if (typeof payload.roomId !== 'string' || !payload.roomId) return null;
  if (typeof payload.tourId !== 'string' || !payload.tourId) return null;
  if (typeof payload.tourDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.tourDate)) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as unknown as RoomClaimTokenPayload;
}
