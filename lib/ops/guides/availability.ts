/**
 * 가이드 휴무 달력 — 순수 날짜 연산. AtoC 통합 플랜 §6.9 / §11.F.
 *
 * kursoflow(`src/lib/guides/availability.ts` + `calendar-grid.ts`)의 날짜 산술을
 * 포팅했다. 저장 모델만 다르다: kursoflow는 `guides.unavailable_dates daterange[]`
 * 한 컬럼이었지만 여기서는 `ops_guide_unavailable_dates` 하루=1행이다. 그래서
 * 범위 파싱/분할(addRestDay·removeRestDay·parseDaterange) 대신 "범위를 날짜 배열로
 * 펼치는" expandDateRange가 그 자리를 대신한다 — 일괄 등록은 행 N개 upsert,
 * 해제는 행 삭제라서 분할 로직 자체가 필요 없어졌다(멱등성은 UNIQUE(guide_id,date)가
 * 보장).
 *
 * 모든 값은 date-only 'YYYY-MM-DD' 문자열이고 UTC 자정 기준으로 비교한다. KST는
 * DST가 없으므로 이 산술은 오프셋 프리다(kursoflow와 동일한 근거).
 *
 * 이 모듈은 의도적으로 `server-only`가 아니다 — admin 달력과 가이드 셀프 스케줄
 * 화면이 브라우저에서 monthCells/isUnavailableOn을 그대로 쓴다.
 */

const MS_PER_DAY = 86_400_000;

/** 일괄 등록 상한 — 실수로 10년치를 넣는 사고를 막는다(1년 + 하루). */
export const MAX_RANGE_DAYS = 367;

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function dateToMs(d: string): number {
  return new Date(`${d}T00:00:00Z`).getTime();
}

function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' 형식이며 실재하는 날짜인가 (2026-02-30 같은 값을 걸러낸다). */
export function isValidYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 'YYYY-MM-DD'에 n일 더하기 (UTC date-only; KST는 DST가 없어 오프셋 프리). */
export function addDays(d: string, n: number): string {
  return msToDate(dateToMs(d) + n * MS_PER_DAY);
}

/** 해당 월(1-based)의 일수. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** (year, month, day) → 'YYYY-MM-DD'. */
export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 0=일 … 6=토. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** KST 오늘 ('YYYY-MM-DD'). 달력의 유일한 "오늘" 기준. */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * [start, end] 양끝 포함 범위를 날짜 배열로 펼친다. 일괄 휴무 등록의 입력 정규화.
 * end 생략 = 하루만. 역순 입력(end < start)이나 MAX_RANGE_DAYS 초과는 빈 배열
 * (호출부가 400으로 거절한다 — 조용히 잘라내면 등록한 줄 알고 넘어간다).
 */
export function expandDateRange(start: string, end?: string | null): string[] {
  if (!isValidYmd(start)) return [];
  const last = end == null || end === '' ? start : end;
  if (!isValidYmd(last)) return [];
  const startMs = dateToMs(start);
  const endMs = dateToMs(last);
  if (endMs < startMs) return [];
  const span = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  if (span > MAX_RANGE_DAYS) return [];
  const out: string[] = [];
  for (let i = 0; i < span; i++) out.push(addDays(start, i));
  return out;
}

/** 이 날짜가 휴무인가. 입력은 저장된 날짜 문자열들(행 하나 = 하루). */
export function isUnavailableOn(dates: Iterable<string> | null | undefined, date: string): boolean {
  if (!dates) return false;
  if (dates instanceof Set) return dates.has(date);
  for (const d of dates) if (d === date) return true;
  return false;
}

/** 해당 월에 속하는 휴무일만 골라낸 Set (달력 셀 칠하기용). */
export function unavailableDatesForMonth(
  dates: Iterable<string> | null | undefined,
  year: number,
  month: number,
): Set<string> {
  const out = new Set<string>();
  if (!dates) return out;
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const d of dates) if (d.startsWith(prefix)) out.add(d);
  return out;
}

export interface DayCell {
  day: number;
  date: string;
  weekday: number;
  isToday: boolean;
  isWeekend: boolean;
  isPast: boolean;
}

/**
 * 일요일 시작 7열 그리드용 셀 + 선행 빈칸 수. `grid-cols-7`이 올바른 요일에서
 * 시작하도록 하는 유일한 계산 (kursoflow monthCells 포팅 + isPast 추가 —
 * 셀프 스케줄에서 지난 날짜는 못 만지게 한다).
 */
export function monthCells(
  year: number,
  month: number,
  today: string = kstToday(),
): { cells: DayCell[]; leadingBlanks: number } {
  const dim = daysInMonth(year, month);
  const leadingBlanks = weekdayOf(ymd(year, month, 1));
  const cells: DayCell[] = [];
  for (let day = 1; day <= dim; day++) {
    const date = ymd(year, month, day);
    const weekday = weekdayOf(date);
    cells.push({
      day,
      date,
      weekday,
      isToday: date === today,
      isWeekend: weekday === 0 || weekday === 6,
      isPast: date < today,
    });
  }
  return { cells, leadingBlanks };
}

/** 달력 이동 — (year, month)에 n개월 더하기. */
export function shiftMonth(year: number, month: number, n: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** 해당 월의 [첫날, 마지막날] — 휴무 조회 range 필터용. */
export function monthBounds(year: number, month: number): { first: string; last: string } {
  return { first: ymd(year, month, 1), last: ymd(year, month, daysInMonth(year, month)) };
}
