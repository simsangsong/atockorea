/**
 * T1-1 — driver overtime settlement (real-world money rule).
 *
 * A private charter includes a base number of hours (user-confirmed 2026-07-20:
 * Jeju 9h, Busan 8h); beyond that the guest pays the driver in cash on the day.
 * The per-hour overtime rate is PER-CITY (AtoC plan §11.D D5, user-confirmed:
 * Jeju ₩30,000/h, Busan ₩40,000/h), and the first OVERTIME_GRACE_MINUTES of
 * overtime are free. Pure + injectable so the cockpit sheet and tests share the
 * exact arithmetic (no floating clock — the caller passes the HH:MM strings).
 *
 * SINGLE SOURCE OF TRUTH: every consumer (cockpit, morning-briefing route,
 * ops startBriefing) must read the rate from this module via rateForCity — no
 * rate is hardcoded elsewhere, so the promise can never drift (plan §12 Q3).
 */

/** Fallback overtime rate when the city is unknown (also Jeju's rate). */
export const OVERTIME_RATE_KRW_PER_HOUR = 30000;
export const DEFAULT_BASE_HOURS = 8;

/**
 * Free overtime window: the first 20 minutes beyond the base hours are not
 * billed. Billing rule (owner-confirmed 2026-07-24, "20분 지난 시점부터 한시간
 * 으로 쳐"): the grace is NOT prorated/subtracted — once overtime passes the
 * 20-min grace it is billed in WHOLE HOURS, rounded UP, counted from the grace
 * mark: `overtimeHours = raw ≤ 20 ? 0 : ceil((raw − 20) / 60)`. So 21–80 min of
 * overtime = 1 hour, 81–140 min = 2 hours, etc. (Changing the block size or the
 * grace is a one-line change in `computeOvertime` below.)
 */
export const OVERTIME_GRACE_MINUTES = 20;

const BASE_HOURS_BY_CITY: Array<{ match: RegExp; hours: number }> = [
  { match: /jeju|제주/i, hours: 9 },
  { match: /busan|부산/i, hours: 8 },
];

/** Per-city overtime rate (₩/h). Mirrors BASE_HOURS_BY_CITY's regex pattern. */
const RATE_BY_CITY: Array<{ match: RegExp; rate: number }> = [
  { match: /jeju|제주/i, rate: 30000 },
  { match: /busan|부산/i, rate: 40000 },
];

/** Base included hours for the tour's city (defaults to 8 when unknown). */
export function baseHoursForCity(city?: string | null): number {
  if (city) {
    for (const entry of BASE_HOURS_BY_CITY) {
      if (entry.match.test(city)) return entry.hours;
    }
  }
  return DEFAULT_BASE_HOURS;
}

/**
 * Overtime rate (₩/h) for the tour's city, falling back to the flat
 * OVERTIME_RATE_KRW_PER_HOUR (₩30,000) when the city is unknown.
 */
export function rateForCity(city?: string | null): number {
  if (city) {
    for (const entry of RATE_BY_CITY) {
      if (entry.match.test(city)) return entry.rate;
    }
  }
  return OVERTIME_RATE_KRW_PER_HOUR;
}

/** Parse an "HH:MM" wall-clock string to minutes-of-day, or null if malformed. */
export function parseHm(hm?: string | null): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes worked between two same-day HH:MM strings (end ≤ start → 0). */
export function minutesBetween(startHm?: string | null, endHm?: string | null): number | null {
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start == null || end == null) return null;
  return Math.max(0, end - start);
}

/** Round hours to the nearest half hour (30-minute billing granularity). */
export function roundHalfHour(hours: number): number {
  return Math.round(hours * 2) / 2;
}

/** Cash owed for a given number of overtime hours (never negative). */
export function overtimeAmount(
  overtimeHours: number,
  rate: number = OVERTIME_RATE_KRW_PER_HOUR,
): number {
  return Math.round(Math.max(0, overtimeHours) * rate);
}

export interface OvertimeResult {
  /** Minutes between start and end, or null when times are missing/invalid. */
  workedMinutes: number | null;
  /** Raw overtime minutes beyond base, BEFORE the grace deduction (display). */
  rawOvertimeMinutes: number;
  /** Billable overtime beyond base AFTER the 20-min grace, in whole hours (ceil). */
  overtimeHours: number;
  /** Cash owed for the grace-applied billable hours at the city's rate. */
  amountKrw: number;
}

/**
 * Compute overtime from base hours + start/end wall-clock strings.
 *
 * Formula (owner-confirmed 2026-07-24 — whole-hour blocks from the grace mark,
 * NOT prorated):
 *   rawOvertimeMinutes = max(0, workedMinutes − baseHours×60)
 *   overtimeHours      = rawOvertimeMinutes ≤ 20 ? 0 : ceil((raw − 20) / 60)
 *   amountKrw          = overtimeHours × rateForCity(city)
 *
 * So ≤20 min overtime ⇒ free; 21–80 min ⇒ 1h ⇒ ₩30,000 (Jeju) / ₩40,000 (Busan);
 * 81–140 min ⇒ 2h; etc. `opts.city` picks both base handling and the rate and
 * stays optional so pre-existing callers keep the default rate (₩30,000) — but
 * note the grace + whole-hour billing applies unconditionally, so
 * `overtimeHours`/`amountKrw` reflect the billable figure even without a city.
 */
export function computeOvertime(
  baseHours: number,
  startHm?: string | null,
  endHm?: string | null,
  opts?: { city?: string | null },
): OvertimeResult {
  const workedMinutes = minutesBetween(startHm, endHm);
  if (workedMinutes == null) {
    return { workedMinutes: null, rawOvertimeMinutes: 0, overtimeHours: 0, amountKrw: 0 };
  }
  const rawOvertimeMinutes = Math.max(0, workedMinutes - baseHours * 60);
  const overtimeHours =
    rawOvertimeMinutes <= OVERTIME_GRACE_MINUTES
      ? 0
      : Math.ceil((rawOvertimeMinutes - OVERTIME_GRACE_MINUTES) / 60);
  const rate = rateForCity(opts?.city ?? null);
  return { workedMinutes, rawOvertimeMinutes, overtimeHours, amountKrw: overtimeAmount(overtimeHours, rate) };
}
