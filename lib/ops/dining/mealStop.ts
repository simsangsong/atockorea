/**
 * "Is this stop a meal?" (§5.7 R-2 trigger 1/2).
 *
 * The dining card must fire at the meal stop and nowhere else — an unprompted
 * restaurant list while the group is walking around a waterfall is noise, and
 * noise is what makes guests stop reading the room.
 *
 * Three independent signals, in confidence order:
 *   1. `stop_type` — the planner explicitly said 'meal' / 'lunch' / 'dinner'.
 *      Trustworthy, but only /plan-authored stops carry it.
 *   2. TIME — the stop lands in 11:00–14:00 or 17:00–20:00 KST. Catches the
 *      legacy `tours.schedule` stops that have a time and nothing else.
 *   3. KEYWORDS — the title or poi_key says 시장 / 맛집 / lunch / …. Catches
 *      "Dongmun Market" style stops that are a meal in practice.
 *
 * Pure and client-safe.
 */

/** Korea has no DST, so a fixed offset is exact. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type MealKind = 'lunch' | 'dinner' | 'snack';
export type MealReason = 'stop_type' | 'time_window' | 'keyword' | 'none';

/** Anything schedule-like: a DayPlanStop, a ScheduleItemLike, an arrival row. */
export interface MealStopLike {
  stop_type?: string | null;
  arrival_planned?: string | null;
  time?: string | null;
  title?: string | null;
  name?: string | null;
  poi_key?: string | null;
  [key: string]: unknown;
}

export interface MealStopResult {
  isMeal: boolean;
  meal: MealKind;
  reason: MealReason;
  /** Minute-of-day the judgement used, when one was available. */
  minuteOfDay: number | null;
}

/** Explicit planner vocabulary. */
const MEAL_STOP_TYPES = new Set(['meal', 'lunch', 'dinner', 'breakfast', 'brunch', 'restaurant']);

/** Windows that mean "this is when people eat" (spec R-2). */
export const LUNCH_WINDOW = { start: 11 * 60, end: 14 * 60 } as const;
export const DINNER_WINDOW = { start: 17 * 60, end: 20 * 60 } as const;

/**
 * Meal-ish titles. Korean entries match as plain substrings; latin entries are
 * matched on word boundaries so "food" does not fire on "seafood cliff" and
 * "market" does not fire inside a longer unrelated word.
 */
const MEAL_KEYWORDS_KO = [
  '시장', '맛집', '식당', '먹거리', '점심', '저녁', '아침', '식사', '먹자골목',
  '음식', '분식', '카페거리', '횟집', '올레시장',
];
const MEAL_KEYWORDS_LATIN = [
  'lunch', 'dinner', 'brunch', 'breakfast', 'meal', 'food', 'foodie',
  'market', 'restaurant', 'eatery', 'dining', 'cafe', 'street food',
];

function parseHm(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Minute-of-day in KST for an epoch ms (Korea has no DST). */
function kstMinuteOfDay(nowMs: number): number {
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function inWindow(minute: number, window: { start: number; end: number }): boolean {
  return minute >= window.start && minute <= window.end;
}

/**
 * Which meal a minute-of-day belongs to. Wider than the *detection* windows on
 * purpose: once we already know it IS a meal stop, a 20:30 dinner should still
 * be labelled dinner rather than falling through to "snack".
 */
export function mealForMinute(minuteOfDay: number | null): MealKind {
  if (minuteOfDay === null) return 'snack';
  if (minuteOfDay >= 10 * 60 + 30 && minuteOfDay < 15 * 60) return 'lunch';
  if (minuteOfDay >= 16 * 60 + 30 && minuteOfDay < 22 * 60) return 'dinner';
  return 'snack';
}

function matchesKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  for (const keyword of MEAL_KEYWORDS_KO) {
    if (lower.includes(keyword)) return true;
  }
  for (const keyword of MEAL_KEYWORDS_LATIN) {
    // \b is unreliable next to CJK; a manual boundary check keeps "food" from
    // matching "seafood" while still hitting "food street" and "Food_Market".
    const pattern = new RegExp(`(^|[^a-z])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (pattern.test(lower)) return true;
  }
  return false;
}

/**
 * Judge one stop.
 *
 * `nowMsOrTime` is the fallback clock/time used when the stop itself carries no
 * time: pass the current epoch ms (arrival hooks) or an "HH:MM" string. The
 * stop's own `arrival_planned` / `time` always wins over it.
 */
export function isMealStop(stop: MealStopLike | null | undefined, nowMsOrTime?: number | string): MealStopResult {
  const fallbackMinute =
    typeof nowMsOrTime === 'number' && Number.isFinite(nowMsOrTime)
      ? kstMinuteOfDay(nowMsOrTime)
      : parseHm(nowMsOrTime);

  if (!stop || typeof stop !== 'object') {
    return { isMeal: false, meal: mealForMinute(fallbackMinute), reason: 'none', minuteOfDay: fallbackMinute };
  }

  const stopMinute = parseHm(stop.arrival_planned) ?? parseHm(stop.time);
  const minuteOfDay = stopMinute ?? fallbackMinute;
  const meal = mealForMinute(minuteOfDay);

  // ① explicit planner type
  const stopType = typeof stop.stop_type === 'string' ? stop.stop_type.trim().toLowerCase() : '';
  if (stopType && MEAL_STOP_TYPES.has(stopType)) {
    const explicit: MealKind = stopType === 'lunch' ? 'lunch' : stopType === 'dinner' ? 'dinner' : meal;
    return { isMeal: true, meal: explicit, reason: 'stop_type', minuteOfDay };
  }

  // ② time window (only the stop's own time — "it is 12:30 right now" must not
  //    turn a waterfall stop into a meal stop)
  if (stopMinute !== null && (inWindow(stopMinute, LUNCH_WINDOW) || inWindow(stopMinute, DINNER_WINDOW))) {
    return { isMeal: true, meal, reason: 'time_window', minuteOfDay };
  }

  // ③ keywords on the title / poi_key
  const haystack = [stop.title, stop.name, stop.poi_key]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ')
    .replace(/_/g, ' ');
  if (haystack && matchesKeyword(haystack)) {
    return { isMeal: true, meal, reason: 'keyword', minuteOfDay };
  }

  return { isMeal: false, meal, reason: 'none', minuteOfDay };
}
