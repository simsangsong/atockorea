/**
 * §K B1 — 주/월 범위 계산. 순수, KST 기준.
 *
 * KST는 DST가 없으므로 UTC+9 고정 오프셋 산술로 충분하다 — 이 저장소의
 * `lib/tour-room/time.ts`가 쓰는 것과 같은 전제다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function kstDate(ms: number): Date {
  return new Date(ms + KST_OFFSET_MS);
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export interface DateRange {
  from: string;
  to: string;
}

/**
 * 주간 범위. **월요일 시작**이다 — 투어 운영은 주말이 성수기라
 * 일요일 시작으로 자르면 토·일이 다른 주로 갈라진다.
 */
export function weekRange(nowMs = Date.now()): DateRange {
  const d = kstDate(nowMs);
  // getUTCDay(): 0=일 … 6=토. 월요일 기준으로 며칠 지났는지.
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - daysSinceMonday * DAY_MS);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return { from: ymd(monday), to: ymd(sunday) };
}

/** 월간 범위(그 달 1일 ~ 말일). */
export function monthRange(nowMs = Date.now()): DateRange {
  const d = kstDate(nowMs);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { from: ymd(first), to: ymd(last) };
}

/** `YYYY-MM` 문자열의 월 범위. 달력이 이전/다음 달로 이동할 때 쓴다. */
export function monthRangeOf(month: string): DateRange | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const last = new Date(Date.UTC(year, mon, 0));
  return { from: ymd(first), to: ymd(last) };
}

/** 범위 안의 날짜를 전부. 달력이 빈 칸까지 그려야 하므로 목록이 필요하다. */
export function datesIn(range: DateRange): string[] {
  const start = Date.parse(`${range.from}T00:00:00Z`);
  const end = Date.parse(`${range.to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const out: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) out.push(ymd(new Date(t)));
  return out;
}

/**
 * 달력 그리드의 선행 빈칸 수(월요일 시작). 1일이 무슨 요일인지에 달렸다.
 * 375px 폭에서 7열이 무너지지 않게 하는 것은 CSS의 몫이고, 여기서는
 * 어느 칸이 비는지만 정한다.
 */
export function leadingBlanks(monthStart: string): number {
  const t = Date.parse(`${monthStart}T00:00:00Z`);
  if (!Number.isFinite(t)) return 0;
  return (new Date(t).getUTCDay() + 6) % 7;
}
