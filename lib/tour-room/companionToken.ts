/**
 * 동행자 초대 링크 토큰 — AtoC 통합 플랜 §5.2 C-6.
 *
 * "동행자 개별 디바이스 등록 원하면 lead가 '동행자 초대' 링크 재공유
 *  (participant 추가, is_lead=false)."
 *
 * 링크 2계층(§5.1)의 변형: 이 토큰은 명단이 아니라 **한 예약 한 건**에만
 * 묶인다(scope=companion-invite + bookingId). 열면 redeem 라우트가 그 예약의
 * participant를 is_lead=false로 하나 더 만들고, 그 디바이스 전용
 * booking-scope 개인 토큰(signCompanionRoomToken)을 발급한다 — 이후 모든
 * 접속·좌석·체크인의 신원은 그 개인 토큰이고, 이 초대 토큰은 redeem에만 쓰인다.
 *
 * claimToken.ts와 같은 이유로 lib/tour-room/token.ts를 건드리지 않고 HMAC
 * 도메인을 `tour-room-companion:`으로 분리했다 — 초대 토큰이 verifyRoomToken
 * 소비처(룸 API 전체)에 통용될 수 없고 그 역도 성립한다. 서명이 아예 호환되지
 * 않으므로 "초대 링크를 그대로 룸 토큰으로 쓰는" 경로가 원천 봉쇄된다.
 *
 * 만료 = 투어일 KST 종료 + 24h — 룸 claim 링크(§5.1 "만료=투어일+1")와 동일한
 * roomTokenExpiryForTourDate를 그대로 재사용한다.
 *
 * 폐기는 tour_room_invites에 role='companion' 행(sha256 해시)으로 기록하고
 * revoked_at을 검사한다 (20260725110000_tour_room_companion_invites.sql).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { TOUR_ROOM_TOKEN_DEV_SECRET, roomTokenExpiryForTourDate } from '@/lib/tour-room/token';

/** HMAC 도메인 분리 프리픽스 — token.ts / claimToken.ts 서명과 호환 금지. */
const DOMAIN = 'tour-room-companion:';

export interface CompanionInviteTokenPayload {
  scope: 'companion-invite';
  /** 이 링크가 등록할 수 있는 유일한 예약 — 라우트 [bookingId]와 일치해야 한다. */
  bookingId: string;
  /** YYYY-MM-DD (KST tour day) — 만료 계산의 기준. */
  tourDate: string;
  iat: number;
  exp: number;
}

function primarySecret(): string {
  const secret = process.env.TOUR_ROOM_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[companion] TOUR_ROOM_TOKEN_SECRET is not set in production — using dev fallback secret');
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

export function signCompanionInviteToken(input: {
  bookingId: string;
  tourDate: string;
}): { token: string; payload: CompanionInviteTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: CompanionInviteTokenPayload = {
    scope: 'companion-invite',
    bookingId: input.bookingId,
    tourDate: input.tourDate,
    iat,
    exp: roomTokenExpiryForTourDate(input.tourDate),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body, primarySecret())}`, payload };
}

/**
 * 서명(현재/이전 시크릿) + 형태 + 만료 검증. 폐기(tour_room_invites.revoked_at)
 * 는 호출자가 hashToken()으로 원장을 조회해 별도로 판정한다.
 */
export function verifyCompanionInviteToken(token: unknown): CompanionInviteTokenPayload | null {
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
  if (payload.scope !== 'companion-invite') return null;
  if (typeof payload.bookingId !== 'string' || !payload.bookingId) return null;
  if (typeof payload.tourDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.tourDate)) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as unknown as CompanionInviteTokenPayload;
}
