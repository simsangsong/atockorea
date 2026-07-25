/**
 * 월 스케줄 매트릭스 — 관제 W4.
 *
 * 핵심 불변식: **overlap 과 double 은 다른 사실이다.** 둘을 하나로 합치면
 * 빨간 칸이 흔해지고, 흔한 경고는 읽히지 않는다. 그래서 시각이 있는 진짜 겹침만
 * 빨강이고 시각을 모르는 하루 2건은 노랑이다.
 */

import {
  buildScheduleMatrix,
  cellIssues,
  matrixToAoa,
  periodBounds,
  isScheduleAxis,
  type ScheduleItem,
} from '../matrix';

const PERIOD = '2026-08';
const TODAY = '2026-08-10';

function item(over: Partial<ScheduleItem> & { id: string; date: string }): ScheduleItem {
  return { subjectId: 'g1', label: 'private', ...over };
}

describe('isScheduleAxis', () => {
  it('accepts only the two axes', () => {
    expect(isScheduleAxis('guide')).toBe(true);
    expect(isScheduleAxis('vehicle')).toBe(true);
    expect(isScheduleAxis('driver')).toBe(false);
    expect(isScheduleAxis(null)).toBe(false);
  });
});

describe('periodBounds', () => {
  it('lands on the real last day of the month', () => {
    expect(periodBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(periodBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(periodBounds('2026-12')).toEqual({ first: '2026-12-01', last: '2026-12-31' });
  });
});

describe('cellIssues', () => {
  it('flags a real overlap in red territory, not the softer "double"', () => {
    const issues = cellIssues(
      [
        item({ id: 'a', date: '2026-08-03', startTime: '08:00', endTime: '12:00' }),
        item({ id: 'b', date: '2026-08-03', startTime: '11:00', endTime: '15:00' }),
      ],
      false,
    );
    expect(issues).toContain('overlap');
    expect(issues).not.toContain('double');
  });

  it('flags two same-day items with unknown times as "double" only', () => {
    const issues = cellIssues(
      [item({ id: 'a', date: '2026-08-03' }), item({ id: 'b', date: '2026-08-03' })],
      false,
    );
    expect(issues).toEqual(['double']);
  });

  it('does not flag two non-overlapping timed tours', () => {
    const issues = cellIssues(
      [
        item({ id: 'a', date: '2026-08-03', startTime: '08:00', endTime: '12:00' }),
        item({ id: 'b', date: '2026-08-03', startTime: '14:00', endTime: '18:00' }),
      ],
      false,
    );
    // 하루 두 탕은 정상이지만 "2건 있음"은 알려야 한다.
    expect(issues).toEqual(['double']);
  });

  it('ignores cancelled items entirely', () => {
    const issues = cellIssues(
      [
        item({ id: 'a', date: '2026-08-03', startTime: '08:00', endTime: '12:00' }),
        item({ id: 'b', date: '2026-08-03', startTime: '09:00', endTime: '13:00', status: 'cancelled' }),
      ],
      false,
    );
    expect(issues).toEqual([]);
  });

  it('flags a rest day only when something is actually booked on it', () => {
    expect(cellIssues([], true)).toEqual([]);
    expect(cellIssues([item({ id: 'a', date: '2026-08-03' })], true)).toContain('on_rest_day');
  });

  it('surfaces an item-level problem such as over capacity', () => {
    expect(cellIssues([item({ id: 'a', date: '2026-08-03', problem: '정원 초과' })], false)).toContain('problem');
  });
});

describe('buildScheduleMatrix', () => {
  const subjects = [
    { id: 'g1', label: '김가이드' },
    { id: 'g2', label: '이가이드' },
  ];

  it('lays out every day of the month', () => {
    const matrix = buildScheduleMatrix({ period: PERIOD, axis: 'guide', subjects, items: [], today: TODAY });
    expect(matrix.days).toHaveLength(31);
    expect(matrix.days[0].date).toBe('2026-08-01');
    expect(matrix.days[30].date).toBe('2026-08-31');
  });

  it('creates no cell for a day with nothing on it', () => {
    // 가이드 20명 × 31일 = 620개의 빈 객체를 만들 이유가 없다.
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects,
      items: [item({ id: 'a', date: '2026-08-03' })],
      today: TODAY,
    });
    expect(matrix.rows[0].cells.size).toBe(1);
    expect(matrix.rows[1].cells.size).toBe(0);
  });

  it('creates a cell for a rest day even with no assignment', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects,
      items: [],
      unavailable: [{ subjectId: 'g1', date: '2026-08-05' }],
      today: TODAY,
    });
    expect(matrix.rows[0].cells.get('2026-08-05')?.unavailable).toBe(true);
  });

  it('drops items outside the month rather than mis-placing them', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects,
      items: [item({ id: 'a', date: '2026-09-01' })],
      today: TODAY,
    });
    expect(matrix.rows[0].cells.size).toBe(0);
  });

  it('gathers subject-less items into an unassigned row instead of losing them', () => {
    // 차량 축에서 마스터 미등록(용차)이 여기로 온다. 조용히 버리면 "배차가 없다"로 읽힌다.
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'vehicle',
      subjects: [{ id: 'v1', label: '12가 3456' }],
      items: [item({ id: 'a', date: '2026-08-03', subjectId: null, label: '용차' })],
      today: TODAY,
    });
    expect(matrix.unassigned).not.toBeNull();
    expect(matrix.unassigned!.total).toBe(1);
  });

  it('has no unassigned row when everything is assigned', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects,
      items: [item({ id: 'a', date: '2026-08-03' })],
      today: TODAY,
    });
    expect(matrix.unassigned).toBeNull();
  });

  it('counts totals per row and per day, excluding cancellations', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects,
      items: [
        item({ id: 'a', date: '2026-08-03' }),
        item({ id: 'b', date: '2026-08-04' }),
        item({ id: 'c', date: '2026-08-04', subjectId: 'g2' }),
        item({ id: 'd', date: '2026-08-04', status: 'cancelled' }),
      ],
      today: TODAY,
    });
    expect(matrix.rows[0].total).toBe(2);
    expect(matrix.rows[1].total).toBe(1);
    // g1 은 8/4에 live 1건 + 취소 1건이다. 취소가 "하루 2건" 경고를 만들면
    // 취소한 배정이 영원히 그 날을 노랗게 물들인다.
    expect(matrix.dayTotals.get('2026-08-04')).toEqual({ count: 2, issues: 0 });
    expect(matrix.rows[0].cells.get('2026-08-04')?.issues).toEqual([]);
  });

  it('does raise the day-level issue count when two live items share a day', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects,
      items: [item({ id: 'a', date: '2026-08-04' }), item({ id: 'b', date: '2026-08-04' })],
      today: TODAY,
    });
    expect(matrix.dayTotals.get('2026-08-04')).toEqual({ count: 2, issues: 1 });
  });
});

describe('matrixToAoa', () => {
  it('marks problem cells so the number alone is not misleading in Excel', () => {
    // 엑셀에는 셀 색이 실리지 않는다. 숫자만 보면 겹침을 알 수 없다.
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects: [{ id: 'g1', label: '김가이드' }],
      items: [
        item({ id: 'a', date: '2026-08-03', startTime: '08:00', endTime: '12:00' }),
        item({ id: 'b', date: '2026-08-03', startTime: '11:00', endTime: '15:00' }),
      ],
      today: TODAY,
    });
    const aoa = matrixToAoa(matrix);
    expect(aoa[0][0]).toBe('가이드');
    expect(aoa[1][3]).toBe('2⚠');
  });

  it('writes 휴무 for a rest day with nothing booked', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects: [{ id: 'g1', label: '김가이드' }],
      items: [],
      unavailable: [{ subjectId: 'g1', date: '2026-08-01' }],
      today: TODAY,
    });
    expect(matrixToAoa(matrix)[1][1]).toBe('휴무');
  });

  it('labels the axis column by axis', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'vehicle',
      subjects: [{ id: 'v1', label: '12가 3456' }],
      items: [],
      today: TODAY,
    });
    expect(matrixToAoa(matrix)[0][0]).toBe('차량');
  });

  it('emits rectangular rows so Excel columns line up', () => {
    const matrix = buildScheduleMatrix({
      period: PERIOD,
      axis: 'guide',
      subjects: [
        { id: 'g1', label: 'a' },
        { id: 'g2', label: 'b' },
      ],
      items: [item({ id: 'a', date: '2026-08-03' })],
      today: TODAY,
    });
    const aoa = matrixToAoa(matrix);
    expect(new Set(aoa.map((r) => r.length)).size).toBe(1);
  });
});
