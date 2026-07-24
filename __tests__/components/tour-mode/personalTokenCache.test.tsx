/**
 * §K B0.3c — 개인 링크로 룸에 들어오면 아침 QR이 그 손님을 알아본다.
 *
 * 이것이 없으면 B0.3(개인 링크 일괄 발송)이 **아침에 무의미해진다**: 손님은
 * 개인 링크로 룸을 열었는데 QR 스캔에서 `no_token`이 떠 claim 화면으로 간다 —
 * 개인 링크가 없애려던 바로 그 화면이다.
 *
 * TourRoomClient 전체를 렌더하면 실시간 채널·오디오·지도까지 끌려오므로,
 * 여기서는 그 컴포넌트가 쓰는 **계약**(어떤 토큰을 저장소에 넣는가)을 직접
 * 검증한다. 계약이 깨지면 이 스위트가 먼저 운다.
 */

import {
  PERSONAL_TOKENS_KEY,
  decodeTokenBody,
  readStoredPersonalTokens,
  storePersonalToken,
} from '@/lib/ops/seating/personalTokens';

/** TourRoomClient의 cachePersonalTokenForMorningQr와 같은 규칙. */
function cachePersonalTokenForMorningQr(token: string | null): void {
  if (!token) return;
  try {
    const body = decodeTokenBody(token);
    if (body?.scope !== 'booking') return;
    storePersonalToken(token);
  } catch {
    /* noop */
  }
}

function mintToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.sig`;
}

const customerToken = mintToken({
  scope: 'booking',
  role: 'customer',
  bookingId: 'B1',
  displayName: 'Massimo',
  exp: 4102444800,
});
const guideToken = mintToken({
  scope: 'tour-date',
  role: 'guide',
  tourId: 'T1',
  tourDate: '2026-08-17',
  exp: 4102444800,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('B0.3c — 룸 진입 시 개인 토큰 캐싱', () => {
  it('개인(booking 스코프) 토큰은 저장된다 — 아침 QR이 이걸 읽는다', () => {
    cachePersonalTokenForMorningQr(customerToken);
    expect(readStoredPersonalTokens()).toEqual([customerToken]);
  });

  it('🔴 가이드·기사 토큰은 저장하지 않는다 — QR 랜딩이 가이드를 손님으로 인사한다', () => {
    cachePersonalTokenForMorningQr(guideToken);
    expect(readStoredPersonalTokens()).toEqual([]);
  });

  it('토큰 없이 룸에 들어온 경우(쿠키 세션·이메일 매칭) 아무것도 저장하지 않는다', () => {
    cachePersonalTokenForMorningQr(null);
    cachePersonalTokenForMorningQr('');
    expect(readStoredPersonalTokens()).toEqual([]);
  });

  it('깨진 토큰은 조용히 무시한다 — 룸은 계속 동작해야 한다', () => {
    cachePersonalTokenForMorningQr('not-a-token');
    cachePersonalTokenForMorningQr('!!!.###');
    expect(readStoredPersonalTokens()).toEqual([]);
  });

  it('같은 링크로 여러 번 들어와도 중복이 쌓이지 않는다', () => {
    cachePersonalTokenForMorningQr(customerToken);
    cachePersonalTokenForMorningQr(customerToken);
    cachePersonalTokenForMorningQr(customerToken);
    expect(readStoredPersonalTokens()).toEqual([customerToken]);
  });

  it('재발급된 토큰이 최신 우선으로 앞에 온다 — 폐기-후-재발급(B0-D1c)이 그렇게 돈다', () => {
    const reissued = mintToken({
      scope: 'booking',
      role: 'customer',
      bookingId: 'B1',
      displayName: 'Massimo',
      exp: 4102444801,
    });
    cachePersonalTokenForMorningQr(customerToken);
    cachePersonalTokenForMorningQr(reissued);
    expect(readStoredPersonalTokens()[0]).toBe(reissued);
    expect(readStoredPersonalTokens()).toHaveLength(2);
  });

  it('claim·동행자 경로가 쓰는 저장소와 같은 키를 쓴다 — 다리가 되려면 같은 곳이어야 한다', () => {
    cachePersonalTokenForMorningQr(customerToken);
    expect(JSON.parse(window.localStorage.getItem(PERSONAL_TOKENS_KEY) ?? '[]')).toContain(customerToken);
  });
});
