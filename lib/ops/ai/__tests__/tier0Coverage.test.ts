/**
 * §L L4 — Tier 0 커버리지 후보.
 *
 * 계약:
 *   1. 이미 사전이 잡는 질문은 후보가 아니다.
 *   2. 🔴 한 번만 나온 질문은 후보가 아니다 — 사전이 부풀면 매칭이 느려지고 오탐이 는다.
 *   3. 다른 질문이 한 군집으로 뭉치지 않는다 — 뭉치면 후보가 거짓말이 된다.
 */

import { normalizeForCluster, potentialCallsSaved, rankTier0Candidates } from '../tier0Coverage';

const q = (question: string, locale = 'ko') => ({ question, locale });

describe('normalizeForCluster', () => {
  it('대소문자·여백·문장부호를 무시한다', () => {
    expect(normalizeForCluster('  Where is the TOILET??  ')).toBe('where is the toilet');
    expect(normalizeForCluster('화장실 어디예요?')).toBe('화장실 어디예요');
  });

  it('🔴 다른 질문을 한 덩어리로 만들지 않는다', () => {
    expect(normalizeForCluster('몇 시에 출발해요')).not.toBe(normalizeForCluster('몇 시에 도착해요'));
    expect(normalizeForCluster('화장실 어디예요')).not.toBe(normalizeForCluster('식당 어디예요'));
  });
});

describe('rankTier0Candidates', () => {
  it('빈도순으로 묶는다', () => {
    const out = rankTier0Candidates([
      q('주차장 어디예요'),
      q('주차장 어디예요?'),
      q('주차장 어디예요'),
      q('와이파이 되나요'),
      q('와이파이 되나요'),
    ]);
    expect(out[0]).toMatchObject({ key: '주차장 어디예요', count: 3 });
    expect(out[1]).toMatchObject({ key: '와이파이 되나요', count: 2 });
  });

  it('🔴 한 번만 나온 질문은 후보가 아니다', () => {
    const out = rankTier0Candidates([q('아주 특이한 일회성 질문입니다')]);
    expect(out).toEqual([]);
  });

  it('이미 사전이 잡는 질문은 후보가 아니다 — 넣어도 아낄 것이 없다', () => {
    const out = rankTier0Candidates([q('화장실 어디예요'), q('화장실 어디예요'), q('주차장 어디예요'), q('주차장 어디예요')], {
      alreadyMatched: (t) => t.includes('화장실'),
    });
    expect(out.map((c) => c.key)).toEqual(['주차장 어디예요']);
  });

  it('사람이 판단할 수 있게 원문 예시를 남긴다 — 정규화 키만으로는 못 정한다', () => {
    const out = rankTier0Candidates([q('주차장 어디예요?'), q('주차장 어디예요!!')]);
    expect(out[0].samples.length).toBeGreaterThan(0);
    expect(out[0].samples[0]).toContain('주차장');
  });

  it('예시는 3개까지만 — 리포트가 로그를 통째로 쏟아내면 안 된다', () => {
    const out = rankTier0Candidates(
      Array.from({ length: 10 }, (_, i) => q(`주차장 어디예요${'!'.repeat(i)}`)),
    );
    expect(out[0].samples.length).toBeLessThanOrEqual(3);
  });

  it('로케일을 모아 준다 — 사전은 로케일별로 산다', () => {
    const out = rankTier0Candidates([q('wifi?', 'en'), q('wifi', 'en'), q('wifi', 'ja')]);
    expect(out[0].locales).toEqual(['en', 'ja']);
  });

  it('빈 질문·짧은 감탄사는 무시한다', () => {
    expect(rankTier0Candidates([q(''), q('  '), q('아'), q('아')])).toEqual([]);
  });

  it('limit을 지킨다', () => {
    const many = Array.from({ length: 60 }, (_, i) => [q(`질문 ${i}`), q(`질문 ${i}`)]).flat();
    expect(rankTier0Candidates(many, { limit: 5 })).toHaveLength(5);
  });

  it('minCount를 올리면 후보가 줄어든다', () => {
    const samples = [q('a 질문'), q('a 질문'), q('b 질문'), q('b 질문'), q('b 질문')];
    expect(rankTier0Candidates(samples, { minCount: 2 })).toHaveLength(2);
    expect(rankTier0Candidates(samples, { minCount: 3 })).toHaveLength(1);
  });
});

describe('potentialCallsSaved', () => {
  it('후보 빈도의 합이다 — 실제 절감이 아니라 상한이다', () => {
    const out = rankTier0Candidates([q('a 질문'), q('a 질문'), q('b 질문'), q('b 질문'), q('b 질문')]);
    expect(potentialCallsSaved(out)).toBe(5);
  });

  it('후보가 없으면 0', () => {
    expect(potentialCallsSaved([])).toBe(0);
  });
});
