import {
  bucketTimeseries,
  OVERVIEW_METRICS,
  type OverviewTimeseriesRow,
} from '@/lib/admin/analytics-overview';

function row(day: string, n: number): OverviewTimeseriesRow {
  return {
    day,
    event_count: n,
    session_count: n * 2,
    visitor_count: n * 3,
    conversion_count: n * 4,
  };
}

function series(days: number): OverviewTimeseriesRow[] {
  return Array.from({ length: days }, (_, i) =>
    row(`2026-04-${String((i % 28) + 1).padStart(2, '0')}`, i + 1),
  );
}

describe('bucketTimeseries (overview §8.4 / §5.3)', () => {
  it('returns the input untouched when it fits within maxBars', () => {
    const s = series(7);
    expect(bucketTimeseries(s)).toBe(s);
    expect(bucketTimeseries(series(30))).toHaveLength(30);
  });

  it('collapses a 90-day series into ~13 weekly buckets', () => {
    const buckets = bucketTimeseries(series(90));
    expect(buckets).toHaveLength(Math.ceil(90 / 7)); // 13
  });

  it('sums each metric within a bucket and inherits the first day label', () => {
    // 14 days > default 30? no — force a small maxBars to exercise bucketing.
    const s = series(14);
    const buckets = bucketTimeseries(s, 7);
    expect(buckets).toHaveLength(2);

    // Week 1 = days 1..7, event_count = 1+2+…+7 = 28.
    expect(buckets[0].day).toBe(s[0].day);
    expect(buckets[0].event_count).toBe(28);
    expect(buckets[0].session_count).toBe(28 * 2);
    expect(buckets[0].visitor_count).toBe(28 * 3);
    expect(buckets[0].conversion_count).toBe(28 * 4);

    // Week 2 = days 8..14, event_count = 8+9+…+14 = 77.
    expect(buckets[1].day).toBe(s[7].day);
    expect(buckets[1].event_count).toBe(77);
  });

  it('leaves a short final partial week as its own bucket', () => {
    const buckets = bucketTimeseries(series(16), 7); // 7 + 7 + 2
    expect(buckets).toHaveLength(3);
    expect(buckets[2].event_count).toBe(15 + 16);
  });

  it('exposes the four overview metrics in display order', () => {
    expect(OVERVIEW_METRICS.map((m) => m.key)).toEqual([
      'event_count',
      'session_count',
      'visitor_count',
      'conversion_count',
    ]);
  });
});
