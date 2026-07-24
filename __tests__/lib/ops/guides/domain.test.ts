/**
 * 순수 도메인 — 휴무 날짜 산술 / 단가 우선순위 / 배정 추천 점수.
 *
 * 날짜 벡터는 kursoflow `guides/__tests__/availability.test.ts`에서 가져왔다(월
 * 경계·31일 달·역순 입력). 범위 표현이 daterange[]에서 하루 1행으로 바뀌었으므로
 * 반각/폐구간 경계 대신 expandDateRange의 양끝 포함 규칙을 검사한다.
 */

import {
  MAX_RANGE_DAYS,
  addDays,
  daysInMonth,
  expandDateRange,
  isUnavailableOn,
  isValidYmd,
  monthBounds,
  monthCells,
  shiftMonth,
  unavailableDatesForMonth,
  weekdayOf,
} from '@/lib/ops/guides/availability';
import { currentRateTable, resolveRate, type GuideRateRow } from '@/lib/ops/guides/rates';
import { SCORE, scoreGuides, type RecommendableGuide } from '@/lib/ops/guides/recommend';

describe('availability — 날짜 산술', () => {
  it('adds days offset-free across month boundaries', () => {
    expect(addDays('2026-05-18', 1)).toBe('2026-05-19');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-05-19', -1)).toBe('2026-05-18');
  });

  it('validates YYYY-MM-DD including impossible dates', () => {
    expect(isValidYmd('2026-05-18')).toBe(true);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('2026-13-01')).toBe(false);
    expect(isValidYmd('26-05-18')).toBe(false);
    expect(isValidYmd(20260518)).toBe(false);
  });

  it('counts days per month (leap year included)', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 5)).toBe(31);
    expect(monthBounds(2026, 5)).toEqual({ first: '2026-05-01', last: '2026-05-31' });
  });

  it('knows weekdays (0=Sun)', () => {
    expect(weekdayOf('2026-05-17')).toBe(0);
    expect(weekdayOf('2026-05-18')).toBe(1);
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });
});

describe('expandDateRange — 일괄 등록 입력 정규화', () => {
  it('expands an inclusive range (both ends included)', () => {
    expect(expandDateRange('2026-05-18', '2026-05-21')).toEqual([
      '2026-05-18',
      '2026-05-19',
      '2026-05-20',
      '2026-05-21',
    ]);
  });

  it('treats a missing end as a single day', () => {
    expect(expandDateRange('2026-05-18')).toEqual(['2026-05-18']);
    expect(expandDateRange('2026-05-18', null)).toEqual(['2026-05-18']);
    expect(expandDateRange('2026-05-18', '')).toEqual(['2026-05-18']);
    expect(expandDateRange('2026-05-18', '2026-05-18')).toEqual(['2026-05-18']);
  });

  it('spans a month boundary', () => {
    expect(expandDateRange('2026-02-27', '2026-03-01')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  // 조용히 잘라내면 "등록됐다"는 착각이 남는다 — 빈 배열로 호출부가 400을 내게 한다.
  it('refuses reversed, invalid and oversized ranges', () => {
    expect(expandDateRange('2026-05-21', '2026-05-18')).toEqual([]);
    expect(expandDateRange('2026-02-30', '2026-03-01')).toEqual([]);
    expect(expandDateRange('nope')).toEqual([]);
    expect(expandDateRange('2026-01-01', '2030-01-01')).toEqual([]);
  });

  it('allows exactly MAX_RANGE_DAYS but not one more', () => {
    const start = '2026-01-01';
    const lastOk = addDays(start, MAX_RANGE_DAYS - 1);
    expect(expandDateRange(start, lastOk)).toHaveLength(MAX_RANGE_DAYS);
    expect(expandDateRange(start, addDays(start, MAX_RANGE_DAYS))).toEqual([]);
  });
});

describe('availability — 휴무 판정과 달력 그리드', () => {
  const off = ['2026-05-18', '2026-05-19', '2026-06-01'];

  it('detects a rest day from an array or a set', () => {
    expect(isUnavailableOn(off, '2026-05-18')).toBe(true);
    expect(isUnavailableOn(off, '2026-05-20')).toBe(false);
    expect(isUnavailableOn(new Set(off), '2026-06-01')).toBe(true);
    expect(isUnavailableOn(null, '2026-05-18')).toBe(false);
    expect(isUnavailableOn(undefined, '2026-05-18')).toBe(false);
  });

  it('keeps only in-month days (month boundary)', () => {
    expect([...unavailableDatesForMonth(off, 2026, 5)].sort()).toEqual(['2026-05-18', '2026-05-19']);
    expect([...unavailableDatesForMonth(off, 2026, 6)]).toEqual(['2026-06-01']);
    expect(unavailableDatesForMonth(off, 2026, 4).size).toBe(0);
    // 2026-05는 두 자리 월이라 '2026-1'이 '2026-10'을 잘못 잡지 않는지도 확인.
    expect(unavailableDatesForMonth(['2026-10-05'], 2026, 1).size).toBe(0);
  });

  it('week-aligns the month grid and flags today/past/weekend', () => {
    const { cells, leadingBlanks } = monthCells(2026, 5, '2026-05-18');
    expect(cells).toHaveLength(31);
    expect(leadingBlanks).toBe(weekdayOf('2026-05-01'));
    const today = cells.find((c) => c.date === '2026-05-18')!;
    expect(today.isToday).toBe(true);
    expect(today.isPast).toBe(false);
    expect(cells.find((c) => c.date === '2026-05-17')!.isPast).toBe(true);
    expect(cells.find((c) => c.date === '2026-05-17')!.isWeekend).toBe(true);
    expect(cells.find((c) => c.date === '2026-05-19')!.isPast).toBe(false);
  });
});

describe('rates — 우선순위와 effective_from 경계', () => {
  const rows: GuideRateRow[] = [
    { id: 'd1', guide_id: null, tour_type: 'private', amount_krw: 150_000, effective_from: '2026-01-01' },
    { id: 'd2', guide_id: null, tour_type: 'private', amount_krw: 170_000, effective_from: '2026-06-01' },
    { id: 'g1', guide_id: 'guide-a', tour_type: 'private', amount_krw: 200_000, effective_from: '2026-03-01' },
    { id: 'b1', guide_id: null, tour_type: 'bus', amount_krw: 120_000, effective_from: '2026-01-01' },
  ];

  it('prefers a guide override over the tenant default', () => {
    const r = resolveRate(rows, { guideId: 'guide-a', tourType: 'private', onDate: '2026-07-01' })!;
    expect(r.amountKrw).toBe(200_000);
    expect(r.scope).toBe('guide');
    expect(r.rowId).toBe('g1');
  });

  it('falls back to the tenant default for a guide with no override', () => {
    const r = resolveRate(rows, { guideId: 'guide-b', tourType: 'private', onDate: '2026-07-01' })!;
    expect(r.amountKrw).toBe(170_000);
    expect(r.scope).toBe('default');
  });

  it('picks the latest effective_from at or before the date', () => {
    expect(resolveRate(rows, { guideId: 'guide-b', tourType: 'private', onDate: '2026-05-31' })!.amountKrw).toBe(150_000);
    // 시행일 당일부터 새 단가 (경계 포함).
    expect(resolveRate(rows, { guideId: 'guide-b', tourType: 'private', onDate: '2026-06-01' })!.amountKrw).toBe(170_000);
  });

  it('ignores a guide override that has not taken effect yet', () => {
    const r = resolveRate(rows, { guideId: 'guide-a', tourType: 'private', onDate: '2026-02-28' })!;
    expect(r.scope).toBe('default');
    expect(r.amountKrw).toBe(150_000);
  });

  // 0원과 "미설정"은 다른 사실이다 — null이어야 정산이 조용히 0원을 지급하지 않는다.
  it('returns null (not zero) when nothing applies', () => {
    expect(resolveRate(rows, { guideId: 'guide-a', tourType: 'cruise', onDate: '2026-07-01' })).toBeNull();
    expect(resolveRate(rows, { guideId: 'guide-a', tourType: 'private', onDate: '2025-12-31' })).toBeNull();
    expect(resolveRate([], { guideId: 'guide-a', tourType: 'private', onDate: '2026-07-01' })).toBeNull();
    expect(resolveRate(null, { guideId: 'guide-a', tourType: 'private', onDate: '2026-07-01' })).toBeNull();
  });

  it('builds a current rate table across tour types', () => {
    const table = currentRateTable(rows, { guideId: 'guide-a', onDate: '2026-07-01' });
    expect(table.map((t) => [t.tourType, t.amountKrw, t.scope])).toEqual([
      ['bus', 120_000, 'default'],
      ['private', 200_000, 'guide'],
    ]);
  });
});

describe('recommend — 언어·휴무·중복배정', () => {
  const guides: RecommendableGuide[] = [
    { id: 'a', name: '김가이드', languages: ['ko', 'en'], guide_type: 'both', certified: true },
    { id: 'b', name: '박기사', languages: ['ko'], guide_type: 'driver', certified: false },
    { id: 'c', name: '이통역', languages: ['ko', 'ja'], guide_type: 'bus_guide', certified: true },
    { id: 'd', name: '비활성', languages: ['en'], guide_type: 'both', certified: true, active: false },
  ];

  it('ranks a language match above a non-match', () => {
    const out = scoreGuides(guides, { language: 'en' });
    expect(out[0].guide.id).toBe('a');
    expect(out[0].reasons).toContain('EN 가능');
    expect(out.find((r) => r.guide.id === 'b')!.reasons).toContain('⚠️ EN 미등록');
  });

  it('matches a regional code against the base language (zh-CN → zh)', () => {
    const zh: RecommendableGuide[] = [{ id: 'z', name: '중국어', languages: ['zh'], guide_type: 'both', certified: false }];
    expect(scoreGuides(zh, { language: 'zh-CN' })[0].score).toBe(SCORE.languageMatch);
    expect(scoreGuides(zh, { language: 'ja' })[0].score).toBe(0);
  });

  it('excludes inactive guides entirely', () => {
    expect(scoreGuides(guides, {}).map((r) => r.guide.id)).not.toContain('d');
  });

  // §11.F — 휴무는 제외가 아니라 "맨 뒤 + 경고".
  it('sorts rest-day guides last but keeps them selectable', () => {
    const out = scoreGuides(guides, { language: 'en', unavailableGuideIds: ['a'] });
    expect(out.map((r) => r.guide.id)).toContain('a');
    expect(out[out.length - 1].guide.id).toBe('a');
    expect(out[out.length - 1].unavailable).toBe(true);
    expect(out[out.length - 1].reasons[0]).toBe('⚠️ 이 날짜 휴무');
  });

  it('penalises (not excludes) a guide already assigned that day', () => {
    const assigned = new Map([['a', 2]]);
    const out = scoreGuides(guides, { language: 'en', assignedCounts: assigned });
    const a = out.find((r) => r.guide.id === 'a')!;
    expect(a.assignedCount).toBe(2);
    expect(a.score).toBe(SCORE.languageMatch + SCORE.certified + SCORE.alreadyAssigned * 2);
    expect(a.reasons).toContain('⚠️ 이 날짜 이미 2건 배정됨');
  });

  it('scores certification and type fit', () => {
    const out = scoreGuides(guides, { needType: 'driver' });
    const b = out.find((r) => r.guide.id === 'b')!;
    expect(b.score).toBe(SCORE.typeMatch);
    expect(b.reasons).toContain('운전 가능');
    // 'both'는 어떤 유형 요구도 충족한다.
    expect(out.find((r) => r.guide.id === 'a')!.score).toBe(SCORE.certified + SCORE.typeMatch);
    expect(out.find((r) => r.guide.id === 'c')!.reasons).toContain('⚠️ 유형 불일치 (bus_guide)');
  });

  it('respects the limit and handles empty input', () => {
    expect(scoreGuides(guides, { limit: 2 })).toHaveLength(2);
    expect(scoreGuides([], {})).toEqual([]);
    expect(scoreGuides(null, {})).toEqual([]);
  });
});
