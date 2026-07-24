/**
 * §K B5 — 자동 체크인의 안전 계약.
 *
 * 🔴 B5-D1이 이 스위트의 존재 이유다: **정적 QR에서는 자동이 성립하지 않는다.**
 * 차량 외부에 붙는 인쇄 QR은 인도에서도 스캔되므로, 자동이면 타지 않은 사람이
 * 탑승으로 기록되고 시작 게이트가 빈자리를 안은 채 열린다 — absent/노쇼 설계가
 * 막으려던 바로 그 실패다.
 *
 * 랜딩 컴포넌트 전체를 렌더하지 않고 **판정 규칙**을 직접 본다. 규칙이 깨지면
 * 여기가 먼저 운다.
 */

import { CHECKIN_NONCE_BUCKET_MS, mintCheckinNonce, verifyCheckinNonce } from '../qrNonce';
import { checkinCopy } from '../checkinCopy';

const ROOM = 'room-abc';

/**
 * 서버가 `autoEligible`을 계산하는 규칙(context 라우트와 동일):
 * nonce가 **있고 유효할 때만** true. 없으면(정적 QR) null → false.
 */
function autoEligible(nonce: string | null, nowMs: number): boolean {
  const nonceValid = nonce ? verifyCheckinNonce(ROOM, nonce, nowMs) : null;
  return nonceValid === true;
}

describe('B5-D1 — 자동 체크인은 nonce가 있는 QR에서만', () => {
  const NOW = 1_800_000_000_000;

  it('콘솔 QR(유효 nonce)은 자동 대상이다', () => {
    const { nonce } = mintCheckinNonce(ROOM, NOW);
    expect(autoEligible(nonce, NOW)).toBe(true);
  });

  it('🔴 인쇄용 정적 QR(nonce 없음)은 자동 대상이 아니다 — 탭을 유지한다', () => {
    expect(autoEligible(null, NOW)).toBe(false);
    expect(autoEligible('', NOW)).toBe(false);
  });

  it('🔴 만료된 nonce는 자동 대상이 아니다', () => {
    const { nonce } = mintCheckinNonce(ROOM, NOW);
    // 두 버킷을 넘기면 직전 버킷 유예도 지난다.
    const later = NOW + CHECKIN_NONCE_BUCKET_MS * 3;
    expect(autoEligible(nonce, later)).toBe(false);
  });

  it('경계에서 스캔한 직전 버킷 nonce는 여전히 자동 대상이다 — 실사용 유예', () => {
    const { nonce } = mintCheckinNonce(ROOM, NOW);
    expect(autoEligible(nonce, NOW + CHECKIN_NONCE_BUCKET_MS)).toBe(true);
  });

  it('🔴 다른 룸의 nonce는 자동 대상이 아니다 — 옆 차 QR로 체크인되면 안 된다', () => {
    const { nonce } = mintCheckinNonce('room-other', NOW);
    expect(autoEligible(nonce, NOW)).toBe(false);
  });

  it('위조 nonce는 자동 대상이 아니다', () => {
    const bucket = Math.floor(NOW / CHECKIN_NONCE_BUCKET_MS);
    expect(autoEligible(`${bucket}.deadbeef1234`, NOW)).toBe(false);
    expect(autoEligible('garbage', NOW)).toBe(false);
  });
});

describe('B5.3 — 환영 문구 5로케일 키 누락 0', () => {
  const LOCALES = ['en', 'ko', 'zh', 'ja', 'es'] as const;
  const NEW_KEYS = ['welcome', 'welcomeSeat', 'welcomeParty', 'undo', 'undone', 'openRoom'] as const;

  it.each(NEW_KEYS)('`%s`가 5로케일 전부에 있다', (key) => {
    for (const locale of LOCALES) {
      const text = checkinCopy(locale, key);
      expect(typeof text).toBe('string');
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('환영 문구는 **질문이 아니다** — 자동이면 물을 것이 없다 (B5-D3)', () => {
    for (const locale of LOCALES) {
      const welcome = checkinCopy(locale, 'welcome');
      expect(welcome).not.toContain('?');
      expect(welcome).not.toContain('？');
      expect(welcome).not.toContain('까요');
    }
  });

  it('기존 greeting(질문)은 정적 QR 경로용으로 그대로 남아 있다', () => {
    // 지우면 정적 QR 손님이 아무 안내도 못 받는다.
    expect(checkinCopy('ko', 'greeting')).toContain('{name}');
    expect(checkinCopy('ko', 'greeting')).toContain('까요');
  });

  it('좌석·인원 자리표시자가 보존된다', () => {
    for (const locale of LOCALES) {
      expect(checkinCopy(locale, 'welcome')).toContain('{name}');
      expect(checkinCopy(locale, 'welcomeSeat')).toContain('{seat}');
      expect(checkinCopy(locale, 'welcomeParty')).toContain('{n}');
    }
  });
});
