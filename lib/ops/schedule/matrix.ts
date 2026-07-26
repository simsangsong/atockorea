/**
 * 월 스케줄 매트릭스 — 관제 W4
 * (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §5).
 *
 * **한 컴포넌트, 두 축.** 가이드 근무 달력과 차량 배차 달력은 축(행이 사람이냐
 * 차냐)만 다르고 나머지가 같다. 따로 만들면 셀 판정·충돌 규칙·달 이동을 두 번
 * 유지보수하게 되고, 두 벌은 반드시 갈라진다.
 *
 * 이 모듈은 순수하다. 날짜 산술은 `lib/ops/guides/availability.ts`를 재사용한다 —
 * 달력 격자를 다시 구현하면 그 자체로 두 번째 진실이 된다.
 */

import { monthBounds, monthCells, type DayCell } from '@/lib/ops/guides/availability';
import { overlaps } from '@/lib/ops/guides/conflicts';

export const SCHEDULE_AXES = ['guide', 'vehicle'] as const;
export type ScheduleAxis = (typeof SCHEDULE_AXES)[number];

export function isScheduleAxis(value: unknown): value is ScheduleAxis {
  return typeof value === 'string' && (SCHEDULE_AXES as readonly string[]).includes(value);
}

/** 셀 하나에 들어가는 배정/배차 한 건. */
export interface ScheduleItem {
  id: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 행 주체 id — 가이드 id 또는 차량 id. null이면 미배정 행으로 모인다. */
  subjectId: string | null;
  label: string;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
  /** 정원 초과 등 항목 자체가 안고 있는 문제. */
  problem?: string | null;
}

export interface ScheduleSubject {
  id: string;
  label: string;
  sublabel?: string | null;
  active?: boolean;
  /**
   * 이 행이 **한 대**인가 **한 종류**인가.
   *
   *   · `'instance'` (기본) — 특정 가이드 한 명, 등록된 차량 한 대.
   *     같은 날 두 건이면 확인이 필요하다.
   *   · `'class'` — 차량 **타입** 행(카운티·쏠라티…). 이 운영은 차를 소유하지 않고
   *     매번 렌트하므로 달력에서 의미 있는 축은 "그날 카운티 몇 대"다. 같은 타입이
   *     하루에 두 건인 것은 **2대를 빌린다는 뜻이지 충돌이 아니다** — 그걸 충돌로
   *     칠하면 달력이 매일 빨갛고, 매일 빨간 경고는 아무도 안 읽는다.
   */
  kind?: 'instance' | 'class';
}

export type CellIssue = 'overlap' | 'double' | 'on_rest_day' | 'problem';

export interface ScheduleCell {
  date: string;
  items: ScheduleItem[];
  /** 그날 이 주체가 쉬는가(가이드 축에서만 의미 있다). */
  unavailable: boolean;
  issues: CellIssue[];
}

export interface ScheduleRow {
  subject: ScheduleSubject;
  cells: Map<string, ScheduleCell>;
  total: number;
  issueCount: number;
}

export interface ScheduleMatrix {
  period: string;
  axis: ScheduleAxis;
  days: DayCell[];
  rows: ScheduleRow[];
  /** 주체를 특정할 수 없는 항목들 — 미배정 가이드/차량 없는 투어. */
  unassigned: ScheduleRow | null;
  /** 날짜별 합계(열 요약). */
  dayTotals: Map<string, { count: number; issues: number }>;
}

export interface BuildMatrixInput {
  period: string;
  axis: ScheduleAxis;
  subjects: ScheduleSubject[];
  items: ScheduleItem[];
  /** 'subjectId|date' 조합의 휴무. 가이드 축에서만 채워진다. */
  unavailable?: Array<{ subjectId: string; date: string }>;
  today?: string;
}

/**
 * 셀 판정.
 *   · `overlap`     — 시각이 있는 두 건이 실제로 겹친다. 확실한 문제.
 *   · `double`      — 같은 날 2건 이상인데 시각을 몰라 겹침을 단정할 수 없다. 확인 필요.
 *   · `on_rest_day` — 휴무일에 배정이 있다(사유 있는 오버라이드일 수 있다).
 *   · `problem`     — 항목이 스스로 안고 있는 문제(정원 초과 등).
 *
 * overlap 과 double 을 나누는 이유: 둘을 하나로 합치면 "빨간 셀"이 흔해지고,
 * 흔한 경고는 읽히지 않는다.
 */
export function cellIssues(
  items: ScheduleItem[],
  unavailable: boolean,
  /**
   * 같은 칸의 2건을 겹침으로 볼 것인가. 타입 행(`kind: 'class'`)에서는 **false** —
   * 그 행의 2건은 "그날 2대 빌린다"이지 충돌이 아니다.
   */
  countsAsOneSubject = true,
): CellIssue[] {
  const live = items.filter((i) => i.status !== 'cancelled');
  const issues: CellIssue[] = [];

  let overlapFound = false;
  if (countsAsOneSubject) {
    for (let i = 0; i < live.length && !overlapFound; i++) {
      for (let j = i + 1; j < live.length; j++) {
        if (
          overlaps({ start: live[i].startTime, end: live[i].endTime }, { start: live[j].startTime, end: live[j].endTime })
        ) {
          overlapFound = true;
          break;
        }
      }
    }
    if (overlapFound) issues.push('overlap');
    else if (live.length > 1) issues.push('double');
  }

  if (unavailable && live.length > 0) issues.push('on_rest_day');
  if (live.some((i) => i.problem)) issues.push('problem');

  return issues;
}

export function buildScheduleMatrix(input: BuildMatrixInput): ScheduleMatrix {
  const [year, month] = input.period.split('-').map(Number);
  const { cells: days } = monthCells(year, month, input.today);
  const validDates = new Set(days.map((d) => d.date));

  const restBySubject = new Map<string, Set<string>>();
  for (const row of input.unavailable ?? []) {
    const set = restBySubject.get(row.subjectId) ?? new Set<string>();
    set.add(row.date);
    restBySubject.set(row.subjectId, set);
  }

  const itemsBySubject = new Map<string, ScheduleItem[]>();
  const orphans: ScheduleItem[] = [];
  for (const item of input.items) {
    if (!validDates.has(item.date)) continue; // 달을 벗어난 행은 조용히 버리지 않고 아예 안 넣는다
    if (item.subjectId == null) {
      orphans.push(item);
      continue;
    }
    const list = itemsBySubject.get(item.subjectId) ?? [];
    list.push(item);
    itemsBySubject.set(item.subjectId, list);
  }

  const dayTotals = new Map<string, { count: number; issues: number }>();
  for (const day of days) dayTotals.set(day.date, { count: 0, issues: 0 });

  const makeRow = (subject: ScheduleSubject, items: ScheduleItem[], rest: Set<string>): ScheduleRow => {
    const cells = new Map<string, ScheduleCell>();
    let total = 0;
    let issueCount = 0;

    const byDate = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const list = byDate.get(item.date) ?? [];
      list.push(item);
      byDate.set(item.date, list);
    }

    for (const day of days) {
      const dayItems = byDate.get(day.date) ?? [];
      const isRest = rest.has(day.date);
      if (dayItems.length === 0 && !isRest) continue; // 빈 셀은 만들지 않는다(월 31 × 가이드 N 개의 빈 객체)
      const issues = cellIssues(dayItems, isRest, subject.kind !== 'class');
      cells.set(day.date, { date: day.date, items: dayItems, unavailable: isRest, issues });

      const live = dayItems.filter((i) => i.status !== 'cancelled').length;
      total += live;
      if (issues.length > 0) issueCount += 1;

      const bucket = dayTotals.get(day.date)!;
      bucket.count += live;
      if (issues.length > 0) bucket.issues += 1;
    }

    return { subject, cells, total, issueCount };
  };

  const rows = input.subjects.map((subject) =>
    makeRow(subject, itemsBySubject.get(subject.id) ?? [], restBySubject.get(subject.id) ?? new Set()),
  );

  const unassigned =
    orphans.length > 0
      ? makeRow({ id: '__unassigned__', label: '미배정', sublabel: null }, orphans, new Set())
      : null;

  return { period: input.period, axis: input.axis, days, rows, unassigned, dayTotals };
}

/** 'YYYY-MM' → 그 달의 [첫날, 마지막날]. 조회 range 필터용(availability 재사용). */
export function periodBounds(period: string): { first: string; last: string } {
  const [year, month] = period.split('-').map(Number);
  return monthBounds(year, month);
}

export const ISSUE_LABEL: Record<CellIssue, string> = {
  overlap: '시간 겹침',
  double: '하루 2건 이상',
  on_rest_day: '휴무일 배정',
  problem: '정원 초과',
};

/** 내보내기용 표(AoA) — 행=주체, 열=일자. W6의 xlsx 엔진이 그대로 받는다. */
export function matrixToAoa(matrix: ScheduleMatrix): Array<Array<string | number>> {
  const header: Array<string | number> = [
    matrix.axis === 'guide' ? '가이드' : '차량',
    ...matrix.days.map((d) => d.day),
    '합계',
  ];
  const body = [...matrix.rows, ...(matrix.unassigned ? [matrix.unassigned] : [])].map((row) => {
    const cells: Array<string | number> = matrix.days.map((d) => {
      const cell = row.cells.get(d.date);
      if (!cell) return '';
      const live = cell.items.filter((i) => i.status !== 'cancelled').length;
      if (live === 0) return cell.unavailable ? '휴무' : '';
      // 문제 있는 칸은 숫자 뒤에 표시를 붙인다 — 엑셀에는 색이 안 실리므로
      // 숫자만 보면 겹침을 알 수 없다.
      return cell.issues.length > 0 ? `${live}⚠` : live;
    });
    return [row.subject.label, ...cells, row.total];
  });
  return [header, ...body];
}
