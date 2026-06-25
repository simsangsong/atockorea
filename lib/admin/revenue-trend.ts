/**
 * 7-day revenue trend bucketing (dashboard §8.1 sparkline).
 *
 * Pure helper extracted from `/api/admin/stats` so the KST day-bucketing logic
 * is unit-testable without the DB. Buckets paid-booking rows into the last
 * `days` KST calendar days (inclusive of today), keeping USD and KRW separate
 * — the dashboard never mixes currencies (USD legacy vs KRW itinerary-builder).
 */
export interface RevenueTrendPoint {
  /** KST calendar day, `YYYY-MM-DD`. */
  date: string;
  usd: number;
  krw: number;
}

interface RevenueRow {
  created_at: string | null;
  final_price: number | string | null;
  currency?: string | null;
}

/** KST (UTC+9) calendar date string for a UTC instant. */
function kstDateString(instant: Date): string {
  return new Date(instant.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Bucket `rows` into a dense series of the last `days` KST days ending on the
 * KST day containing `now`. Days with no revenue are emitted as zero so the
 * sparkline has one point per day. Rows outside the window are ignored.
 */
export function buildRevenueTrend(rows: RevenueRow[], now: Date, days = 7): RevenueTrendPoint[] {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const buckets = new Map<string, { usd: number; krw: number }>();
  const dates: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - i),
    );
    const ds = d.toISOString().slice(0, 10);
    dates.push(ds);
    buckets.set(ds, { usd: 0, krw: 0 });
  }

  for (const row of rows) {
    if (!row.created_at) continue;
    const bucket = buckets.get(kstDateString(new Date(row.created_at)));
    if (!bucket) continue; // outside the window
    const ccy = row.currency === 'krw' ? 'krw' : 'usd';
    const amount = parseFloat(String(row.final_price ?? 0));
    if (Number.isFinite(amount)) bucket[ccy] += amount;
  }

  return dates.map((date) => ({ date, ...buckets.get(date)! }));
}
