/**
 * KST-anchored time helpers for Tour Mode (master plan §B D-9, ticket T0.7).
 *
 * All "is this tour today / is this room live" judgements are fixed to
 * Asia/Seoul: the pre-existing UTC todayYmd() hid today's tour from customers
 * between 00:00 and 09:00 KST (live defect R-7). KST is UTC+9 with no DST, so
 * plain offset arithmetic is exact.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Post-tour window during which a room stays open (read-write), then closes. */
export const ROOM_GRACE_MS = 24 * 60 * 60 * 1000;

function ymdOf(msEpoch: number): string {
  const shifted = new Date(msEpoch + KST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Today's date (YYYY-MM-DD) in Asia/Seoul. */
export function kstToday(nowMs = Date.now()): string {
  return ymdOf(nowMs);
}

/** Ms epoch of `tourDate` 00:00:00 KST. Throws on malformed dates. */
export function kstStartOfDayMs(tourDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
    throw new Error(`Invalid tour date: ${tourDate}`);
  }
  const [y, m, d] = tourDate.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  if (Number.isNaN(utcMidnight)) throw new Error(`Invalid tour date: ${tourDate}`);
  return utcMidnight - KST_OFFSET_MS;
}

/** Ms epoch of `tourDate` 23:59:59.999 KST. */
export function kstEndOfDayMs(tourDate: string): number {
  return kstStartOfDayMs(tourDate) + 24 * 60 * 60 * 1000 - 1;
}

/**
 * Whole KST calendar days from `nowMs` until the tour date (0 = today,
 * 1 = tomorrow). Used by the lobby D-day countdown (§O-1 ⑥); never negative.
 */
export function kstDaysUntil(tourDate: string, nowMs = Date.now()): number {
  const days = Math.ceil((kstStartOfDayMs(tourDate) - nowMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

export type RoomLifecycle = 'lobby' | 'live' | 'ended';

/**
 * Lifecycle of a room anchored to its tour date (§O-1 ⑥: there is no error
 * state — before the day it's a lobby, during the day + grace it's live,
 * afterwards it's a read-only ended room).
 *
 * A room with no tour date is treated as live (legacy rows; access checks
 * still apply).
 */
export function roomLifecycle(tourDate: string | null | undefined, nowMs = Date.now()): RoomLifecycle {
  if (!tourDate) return 'live';
  if (nowMs < kstStartOfDayMs(tourDate)) return 'lobby';
  if (nowMs <= kstEndOfDayMs(tourDate) + ROOM_GRACE_MS) return 'live';
  return 'ended';
}

/** True when the room should be auto-transitioned to status='closed' (R-19). */
export function roomShouldBeClosed(tourDate: string | null | undefined, nowMs = Date.now()): boolean {
  return roomLifecycle(tourDate, nowMs) === 'ended';
}
