/**
 * Pure helpers for the analytics overview page (spec §8.4).
 *
 * The overview timeseries can span up to 90 days. Rendering 90 bars at ~3.5px
 * each is unreadable on a 375px screen (§5.3), so when the series exceeds
 * `maxBars` we collapse it into weekly buckets (sum per metric, labelled by the
 * first day of the bucket). 7-day series stay untouched.
 */

export type OverviewTimeseriesRow = {
  day: string;
  event_count: number;
  session_count: number;
  visitor_count: number;
  conversion_count: number;
};

export type OverviewMetric = Exclude<keyof OverviewTimeseriesRow, 'day'>;

export const OVERVIEW_METRICS: ReadonlyArray<{ key: OverviewMetric; label: string }> = [
  { key: 'event_count', label: '이벤트' },
  { key: 'session_count', label: '세션' },
  { key: 'visitor_count', label: '방문자' },
  { key: 'conversion_count', label: '전환' },
];

/**
 * Collapse a daily series into weekly buckets when it is longer than `maxBars`.
 * Each bucket sums every numeric metric and inherits the `day` of its first row.
 * Returns the input untouched when it already fits.
 */
export function bucketTimeseries(
  rows: OverviewTimeseriesRow[],
  maxBars = 30,
): OverviewTimeseriesRow[] {
  if (rows.length <= maxBars) return rows;

  const buckets: OverviewTimeseriesRow[] = [];
  for (let i = 0; i < rows.length; i += 7) {
    const chunk = rows.slice(i, i + 7);
    buckets.push(
      chunk.reduce<OverviewTimeseriesRow>(
        (acc, row) => ({
          day: acc.day,
          event_count: acc.event_count + row.event_count,
          session_count: acc.session_count + row.session_count,
          visitor_count: acc.visitor_count + row.visitor_count,
          conversion_count: acc.conversion_count + row.conversion_count,
        }),
        {
          day: chunk[0].day,
          event_count: 0,
          session_count: 0,
          visitor_count: 0,
          conversion_count: 0,
        },
      ),
    );
  }
  return buckets;
}
