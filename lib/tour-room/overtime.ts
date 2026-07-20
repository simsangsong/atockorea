/**
 * T1-1 — driver overtime settlement (real-world money rule).
 *
 * A private charter includes a base number of hours (user-confirmed 2026-07-20:
 * Jeju 9h, Busan 8h); beyond that the guest pays the driver ₩30,000 per hour in
 * cash on the day. Pure + injectable so the cockpit sheet and tests share the
 * exact arithmetic (no floating clock — the caller passes the HH:MM strings).
 */

export const OVERTIME_RATE_KRW_PER_HOUR = 30000;
export const DEFAULT_BASE_HOURS = 8;

const BASE_HOURS_BY_CITY: Array<{ match: RegExp; hours: number }> = [
  { match: /jeju|제주/i, hours: 9 },
  { match: /busan|부산/i, hours: 8 },
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
export function overtimeAmount(overtimeHours: number): number {
  return Math.round(Math.max(0, overtimeHours) * OVERTIME_RATE_KRW_PER_HOUR);
}

export interface OvertimeResult {
  /** Minutes between start and end, or null when times are missing/invalid. */
  workedMinutes: number | null;
  /** Overtime beyond base, rounded to the nearest half hour. */
  overtimeHours: number;
  /** Cash owed at the fixed hourly rate. */
  amountKrw: number;
}

/** Compute overtime from base hours + start/end wall-clock strings. */
export function computeOvertime(
  baseHours: number,
  startHm?: string | null,
  endHm?: string | null,
): OvertimeResult {
  const workedMinutes = minutesBetween(startHm, endHm);
  if (workedMinutes == null) {
    return { workedMinutes: null, overtimeHours: 0, amountKrw: 0 };
  }
  const overtimeHours = roundHalfHour(Math.max(0, workedMinutes / 60 - baseHours));
  return { workedMinutes, overtimeHours, amountKrw: overtimeAmount(overtimeHours) };
}
