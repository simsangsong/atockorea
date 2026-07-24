/**
 * Opening hours — Google Places (New) `regularOpeningHours.periods` → "is it
 * open today, and until when?" for a KST moment (§5.7 R-4 openNowPenalty).
 *
 * 🔴 `null` means UNKNOWN and must never be rendered as either open or closed.
 * Most cached rows have no Google match at all, and a card that guesses "open
 * until 21:00" for a place that shut at 15:00 is worse than a card that says
 * nothing. The ranking treats null as "no penalty" for the same reason.
 *
 * Google's shape (all times local to the place, which for us is always KST):
 *   periods: [{ open: { day: 0..6, hour, minute }, close?: { day, hour, minute } }]
 *   day 0 = Sunday. A 24/7 place is ONE period with open {day:0,hour:0,minute:0}
 *   and NO close. An overnight period has close.day != open.day.
 *
 * Pure and client-safe.
 */

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
/** Korea has no DST, so a fixed offset is exact. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface OpeningTimePoint {
  day?: number | null;
  hour?: number | null;
  minute?: number | null;
  [key: string]: unknown;
}

export interface OpeningPeriod {
  open?: OpeningTimePoint | null;
  close?: OpeningTimePoint | null;
  [key: string]: unknown;
}

/** The raw jsonb we store in `ops_kakao_place_cache.open_hours`. */
export interface RegularOpeningHours {
  periods?: OpeningPeriod[] | null;
  weekdayDescriptions?: string[] | null;
  openNow?: boolean | null;
  [key: string]: unknown;
}

export interface DayHours {
  /**
   * true  — the place is open at this moment;
   * false — it is closed at this moment (and, when `closedAllDay`, all day);
   * null  — unknown (no usable periods).
   */
  openToday: boolean | null;
  /** "HH:MM" the current period ends, or null when unknown / 24h / closed. */
  closesAt: string | null;
  /** true when NO period covers any part of this KST calendar day. */
  closedAllDay: boolean;
  /** true when the place is open around the clock. */
  open24h: boolean;
}

export const UNKNOWN_HOURS: DayHours = {
  openToday: null,
  closesAt: null,
  closedAllDay: false,
  open24h: false,
};

/** KST weekday (0 = Sunday) and minute-of-day for an epoch ms. */
export function kstWeekMinutes(nowMs: number): { weekday: number; minuteOfDay: number } {
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  return {
    weekday: shifted.getUTCDay(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function pointMinutes(point: OpeningTimePoint | null | undefined): number | null {
  if (!point || typeof point !== 'object') return null;
  const day = Number(point.day);
  const hour = Number(point.hour ?? 0);
  const minute = Number(point.minute ?? 0);
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 24) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  return day * MINUTES_PER_DAY + hour * 60 + minute;
}

function formatHm(absoluteWeekMinute: number): string {
  const minuteOfDay = ((absoluteWeekMinute % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface NormalizedPeriod {
  /** Minute-of-week the period opens. */
  start: number;
  /** Minute-of-week it closes; always > start (overnight periods wrap +week). */
  end: number;
}

/**
 * Normalize the raw periods into non-wrapping [start, end) week intervals.
 * Returns null when nothing usable is present (→ UNKNOWN_HOURS) and the
 * special marker `'always'` for a 24/7 place.
 */
export function normalizePeriods(hours: RegularOpeningHours | null | undefined): NormalizedPeriod[] | 'always' | null {
  const periods = hours?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;

  const out: NormalizedPeriod[] = [];
  let sawOpen = false;

  for (const period of periods) {
    const start = pointMinutes(period?.open);
    if (start === null) continue;
    sawOpen = true;

    // Google's 24/7 convention: a single open with no close.
    if (!period?.close) return 'always';

    const rawEnd = pointMinutes(period.close);
    if (rawEnd === null) continue;
    // Overnight (close before open in week order) wraps to the next week.
    const end = rawEnd > start ? rawEnd : rawEnd + MINUTES_PER_WEEK;
    out.push({ start, end });
  }

  if (out.length === 0) return sawOpen ? 'always' : null;
  return out;
}

/**
 * Evaluate the hours payload at a KST moment.
 *
 * `closesAt` is only populated while the place is actually open — a card that
 * says "open until 21:00" about a place that is currently shut would read as an
 * invitation to walk over there now.
 */
export function evaluateHours(hours: RegularOpeningHours | null | undefined, nowMs: number): DayHours {
  const normalized = normalizePeriods(hours);
  if (normalized === null) return UNKNOWN_HOURS;
  if (normalized === 'always') {
    return { openToday: true, closesAt: null, closedAllDay: false, open24h: true };
  }

  const { weekday, minuteOfDay } = kstWeekMinutes(nowMs);
  const now = weekday * MINUTES_PER_DAY + minuteOfDay;
  const dayStart = weekday * MINUTES_PER_DAY;
  const dayEnd = dayStart + MINUTES_PER_DAY;

  let latestEnd: number | null = null;
  let coversToday = false;

  // Each period is checked at its own week position and one week earlier, so a
  // Saturday-night → Sunday-morning period is seen from the Sunday side too.
  for (const period of normalized) {
    for (const shift of [0, -MINUTES_PER_WEEK]) {
      const start = period.start + shift;
      const end = period.end + shift;
      // Overlapping/adjacent periods: the latest applicable close is the one
      // the guest can actually stay until.
      if (now >= start && now < end && (latestEnd === null || end > latestEnd)) latestEnd = end;
      if (start < dayEnd && end > dayStart) coversToday = true;
    }
  }

  return {
    openToday: latestEnd !== null,
    closesAt: latestEnd !== null ? formatHm(latestEnd) : null,
    closedAllDay: !coversToday,
    open24h: false,
  };
}

/**
 * The compact pair the card meta carries (`open_today` / `closes_at`).
 * A place that is closed right now but opens again later today still reads as
 * `open_today: false` — the guest cares about "can I walk in now".
 */
export function servingHours(
  hours: RegularOpeningHours | null | undefined,
  nowMs: number,
): { open_today: boolean | null; closes_at: string | null } {
  const evaluated = evaluateHours(hours, nowMs);
  return { open_today: evaluated.openToday, closes_at: evaluated.closesAt };
}
