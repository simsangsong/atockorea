/**
 * 가이드 셀프 스케줄 토큰 — §11.F `/g/schedule/[token]`.
 *
 * 바인딩 결정 5: **투어룸 토큰 체계를 재사용하지 않는다.** 두 체계는 권한의 성격이
 * 완전히 다르다 —
 *   · 투어룸 토큰(lib/tour-room/token.ts): 하루짜리, 룸 하나, 채팅·위치·SOS까지.
 *   · 셀프 스케줄 토큰: 몇 달짜리, 룸과 무관, 오직 "내 휴무 달력" 하나.
 * 같은 시크릿과 같은 페이로드 모양을 공유하면 언젠가 한쪽 검증기가 다른 쪽 토큰을
 * 통과시킨다(scope 혼선). 그래서 시크릿도 페이로드 태그도 분리했다.
 *
 * 포맷: base64url(JSON) + "." + hex(HMAC-SHA256) — 프리미티브 자체는 룸 토큰과
 * 동일하다(검증된 형태를 다시 발명할 이유는 없다). 페이로드는 암호화되지 않는다:
 * 비밀이 아니라 서명이 요점이고, 안에는 guideId와 표시용 이름뿐이다(PII 없음).
 *
 * 회수(revocation)는 시크릿 로테이션으로 한다 — 토큰 원장을 따로 두지 않는다.
 * 개별 회수가 필요하면 가이드 상세에서 링크를 재발급하고 예전 링크는 만료를
 * 기다린다(휴무 등록이라는 낮은 위험도에 맞춘 절제).
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const GUIDE_SCHEDULE_TOKEN_DEV_SECRET = 'atoc-guide-schedule-dev-secret';

/** 기본 유효기간 — 한 시즌(180일). 링크 하나로 시즌 내내 쓴다. */
export const DEFAULT_TTL_SECONDS = 180 * 24 * 60 * 60;

export interface GuideScheduleTokenPayload {
  /** 룸 토큰과 절대 겹치지 않는 태그. */
  scope: 'guide-schedule';
  guideId: string;
  /** 화면 인사말용 이름. PII로 취급하지 않는 수준(성명은 이미 링크 수신자 본인 것). */
  name: string;
  iat: number;
  exp: number;
}

function primarySecret(): string {
  const secret = process.env.OPS_GUIDE_SCHEDULE_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    // 링크가 500이 되면 안 되므로 동작은 유지하되 오설정을 시끄럽게 만든다.
    console.warn(
      '[ops-guides] OPS_GUIDE_SCHEDULE_TOKEN_SECRET is not set in production — using dev fallback secret',
    );
  }
  return GUIDE_SCHEDULE_TOKEN_DEV_SECRET;
}

function verificationSecrets(): string[] {
  const secrets = [primarySecret()];
  const prev = process.env.OPS_GUIDE_SCHEDULE_TOKEN_SECRET_PREV;
  if (prev && !secrets.includes(prev)) secrets.push(prev);
  return secrets;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function signGuideScheduleToken(input: {
  guideId: string;
  name?: string | null;
  ttlSeconds?: number;
}): { token: string; payload: GuideScheduleTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds && input.ttlSeconds > 0 ? Math.floor(input.ttlSeconds) : DEFAULT_TTL_SECONDS;
  const payload: GuideScheduleTokenPayload = {
    scope: 'guide-schedule',
    guideId: input.guideId,
    name: input.name?.trim() || '가이드',
    iat,
    exp: iat + ttl,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body, primarySecret())}`, payload };
}

function signatureMatches(body: string, sig: string): boolean {
  for (const secret of verificationSecrets()) {
    const expected = sign(body, secret);
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 서명·형태·만료 검증. 통과하면 페이로드, 아니면 null.
 *
 * scope 검사가 이 함수의 존재 이유다 — 룸 토큰을 여기에 붙여도, 여기 토큰을
 * 룸 검증기에 붙여도 통과하지 못한다(시크릿이 다르므로 서명에서 먼저 걸리고,
 * 시크릿을 같게 설정하는 사고가 나도 scope에서 걸린다: 이중 방어).
 */
export function verifyGuideScheduleToken(token: unknown): GuideScheduleTokenPayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig || !signatureMatches(body, sig)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const payload = parsed as Record<string, unknown>;
  if (payload.scope !== 'guide-schedule') return null;
  if (typeof payload.guideId !== 'string' || payload.guideId.length === 0) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    scope: 'guide-schedule',
    guideId: payload.guideId,
    name: typeof payload.name === 'string' ? payload.name : '가이드',
    iat: typeof payload.iat === 'number' ? payload.iat : 0,
    exp: payload.exp,
  };
}

/** 로그·디버깅에서 토큰 원문 대신 쓰는 지문. */
export function hashGuideScheduleToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
