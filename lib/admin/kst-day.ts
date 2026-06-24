const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * KST (UTC+9) calendar-day bounds (W3.2 / M-6). The admin dashboard's "today"
 * used `new Date().toISOString()` (UTC), so between 00:00–09:00 KST it counted
 * the wrong day and showed "0 orders today". The returned ISO bounds carry the
 * explicit +09:00 offset so the timestamptz comparison is unambiguous regardless
 * of the server timezone.
 */
export function kstDayBounds(now: Date = new Date()): {
  date: string;
  startIso: string;
  endIso: string;
} {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;
  return {
    date,
    startIso: `${date}T00:00:00+09:00`,
    endIso: `${date}T23:59:59.999+09:00`,
  };
}
