/**
 * §L L2 — Tier 1 캐시 키.
 *
 * 🔴 이 스위트가 지키는 것은 절감이 아니라 **정확성**이다. 컨텍스트를 무시한
 * 캐시는 "이미 지난 스팟의 답"을 다음 손님에게 주고, 그건 비용 절감이 아니라
 * 오정보 생산이다(L-D3 / S2).
 */

import {
  CONTEXT_TIME_BUCKET_MS,
  conciergeCacheKey,
  contextVersion,
  isCacheableQuestion,
  normalizeQuestion,
} from '@/lib/tour-room/conciergeCache';

const NOW = Date.parse('2026-08-17T03:00:00Z');
const base = {
  tourId: 'T1',
  tourDate: '2026-08-17',
  poiKey: 'seongsan',
  lifecycle: 'live',
  freeTimeActive: false,
  nowMs: NOW,
};

describe('normalizeQuestion — 같은 말을 그대로 다시 친 경우만 잡는다', () => {
  it('대소문자·여백·끝 문장부호를 무시한다', () => {
    expect(normalizeQuestion('  Where is the TOILET?  ')).toBe('where is the toilet');
    expect(normalizeQuestion('화장실 어디예요??')).toBe('화장실 어디예요');
    expect(normalizeQuestion('몇 시에   출발해요')).toBe('몇 시에 출발해요');
  });

  it('🔴 과하게 정규화하지 않는다 — 다른 질문이 같은 키로 뭉치면 엉뚱한 답이 나간다', () => {
    expect(normalizeQuestion('화장실 어디예요')).not.toBe(normalizeQuestion('식당 어디예요'));
    expect(normalizeQuestion('몇 시에 출발해요')).not.toBe(normalizeQuestion('몇 시에 도착해요'));
  });
});

describe('isCacheableQuestion', () => {
  it('짧은 오타·감탄사는 캐시하지 않는다', () => {
    expect(isCacheableQuestion('아')).toBe(false);
    expect(isCacheableQuestion('ㅇㅇ')).toBe(false);
  });

  it('보통 질문은 캐시한다', () => {
    expect(isCacheableQuestion('화장실 어디예요?')).toBe(true);
  });

  it('아주 긴 질문은 캐시하지 않는다 — 다시 맞을 일이 없고 테이블만 부푼다', () => {
    expect(isCacheableQuestion('가'.repeat(201))).toBe(false);
  });
});

describe('🔴 L-D3 — 컨텍스트가 바뀌면 키가 바뀐다', () => {
  const key = (over: Partial<typeof base> = {}) =>
    conciergeCacheKey('화장실 어디예요', 'ko', contextVersion({ ...base, ...over }));

  it('같은 상황·같은 질문이면 같은 키 — 여기서 절감이 나온다', () => {
    expect(key()).toBe(key());
  });

  it('스팟이 바뀌면 다른 키다 — 지난 스팟의 답이 재사용되면 오정보다', () => {
    expect(key({ poiKey: 'udo' })).not.toBe(key());
  });

  it('라이프사이클이 바뀌면 다른 키다 (lobby/live/ended는 답이 다르다)', () => {
    expect(key({ lifecycle: 'lobby' })).not.toBe(key());
    expect(key({ lifecycle: 'ended' })).not.toBe(key());
  });

  it('자유시간이 켜지면 다른 키다 — "몇 시까지예요"의 답이 달라진다', () => {
    expect(key({ freeTimeActive: true })).not.toBe(key());
  });

  it('다른 투어·다른 날짜는 절대 섞이지 않는다', () => {
    expect(key({ tourId: 'T2' })).not.toBe(key());
    expect(key({ tourDate: '2026-08-18' })).not.toBe(key());
  });

  it('로케일이 다르면 다른 키다 — 일본어 손님에게 영어 답이 가면 안 된다', () => {
    const ko = conciergeCacheKey('q', 'ko', contextVersion(base));
    const ja = conciergeCacheKey('q', 'ja', contextVersion(base));
    expect(ko).not.toBe(ja);
  });
});

describe('시각 버킷 — 캐시된 답의 시각 오차에 상한을 둔다', () => {
  const key = (nowMs: number) => conciergeCacheKey('q', 'ko', contextVersion({ ...base, nowMs }));

  it('버킷 안에서는 같은 키(= 히트)', () => {
    expect(key(NOW)).toBe(key(NOW + CONTEXT_TIME_BUCKET_MS - 1000));
  });

  it('🔴 버킷을 넘기면 새 키 — 30분보다 오래된 시각을 말하는 답이 남지 않는다', () => {
    expect(key(NOW + CONTEXT_TIME_BUCKET_MS)).not.toBe(key(NOW));
  });
});

describe('키에 질문 원문이 남지 않는다', () => {
  it('sha256 16진 64자다', () => {
    const k = conciergeCacheKey('환불 어떻게 하나요', 'ko', contextVersion(base));
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain('환불');
  });
});
