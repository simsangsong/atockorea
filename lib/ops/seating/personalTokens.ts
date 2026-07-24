/**
 * 개인 토큰 · 디바이스 키 클라이언트 저장 — AtoC 통합 플랜 §5.2 C-4.
 *
 * claim 순간 발급된 booking-scope 개인 토큰을 localStorage `ops_personal_tokens`
 * (JSON 배열, 최신 우선)에 저장한다 — QR 랜딩(§5.4c CheckinLanding)이 같은
 * 키에서 자동 인식한다. 디바이스 키는 QR 랜딩과 동일한 `tour_mode_device_key`
 * 를 공유해 한 기기가 하나의 participant로 수렴한다.
 *
 * decodeTokenBody는 서명을 검증하지 않는다 (검증은 서버 몫) — 재접속 인식용
 * bookingId/만료만 base64url로 읽는 순수 헬퍼다.
 */

export const PERSONAL_TOKENS_KEY = 'ops_personal_tokens';
export const DEVICE_KEY_STORAGE = 'tour_mode_device_key';

export function readStoredPersonalTokens(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PERSONAL_TOKENS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string').slice(0, 10);
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return [];
  }
}

/** 새 토큰을 최신 우선으로 저장(중복 제거, 최대 10개). */
export function storePersonalToken(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    const existing = readStoredPersonalTokens().filter((t) => t !== token);
    window.localStorage.setItem(PERSONAL_TOKENS_KEY, JSON.stringify([token, ...existing].slice(0, 10)));
  } catch {
    /* private mode — in-memory flow still proceeds */
  }
}

/** 안정적 디바이스 키 (QR 랜딩과 공유). 없으면 UUID 생성. */
export function getOrCreateDeviceKey(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY_STORAGE, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export interface DecodedTokenBody {
  scope?: string;
  role?: string;
  bookingId?: string;
  displayName?: string;
  exp?: number;
}

/** base64url(JSON).sig 토큰의 payload를 서명 검증 없이 디코드 (재접속 인식용). */
export function decodeTokenBody(token: string | null | undefined): DecodedTokenBody | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const body = token.slice(0, token.lastIndexOf('.'));
    let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(
            atob(b64)
              .split('')
              .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
              .join(''),
          )
        : Buffer.from(body, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as DecodedTokenBody) : null;
  } catch {
    return null;
  }
}

/** 저장된 토큰들 중 이 룸 명단(bookingIds)에 속하고 만료 안 된 첫 토큰 (C-4 인식). */
export function findRecognizedToken(
  bookingIds: Iterable<string>,
  tokens: string[] = readStoredPersonalTokens(),
): { token: string; bookingId: string; displayName: string } | null {
  const ids = new Set(bookingIds);
  const nowSec = Math.floor(Date.now() / 1000);
  for (const token of tokens) {
    const body = decodeTokenBody(token);
    if (!body || body.scope !== 'booking' || !body.bookingId) continue;
    if (typeof body.exp === 'number' && body.exp < nowSec) continue;
    if (ids.has(body.bookingId)) {
      return { token, bookingId: body.bookingId, displayName: body.displayName ?? '' };
    }
  }
  return null;
}
