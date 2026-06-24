import { buildEventTimeseries } from '@/lib/analytics/event-detail';

const TODAY = '2026-06-25';

describe('buildEventTimeseries', () => {
  it('uses the matview for past days and raw for today (freshness fix)', () => {
    const matview = [
      { day: '2026-06-23', event_count: 100 },
      { day: '2026-06-24', event_count: 200 },
      { day: '2026-06-25', event_count: 5 }, // stale partial today (matview lags)
    ];
    // raw newest-first: 8 events today (incl. the last hour matview missed)
    const raw = Array.from({ length: 8 }, () => `${TODAY}T${'12'}:00:00Z`);
    const { timeseries, total_events } = buildEventTimeseries(matview, raw, TODAY);
    expect(timeseries).toEqual([
      { day: '2026-06-23', count: 100 },
      { day: '2026-06-24', count: 200 },
      { day: '2026-06-25', count: 8 }, // raw (8) wins over stale matview (5)
    ]);
    expect(total_events).toBe(308);
  });

  it('does NOT drop today when the matview already has a (partial) row for it', () => {
    // Regression for the inversion bug: old code skipped today because tsMap.has(today)
    const matview = [{ day: TODAY, event_count: 2 }];
    const raw = [`${TODAY}T01:00:00Z`, `${TODAY}T23:30:00Z`, `${TODAY}T23:45:00Z`];
    const { timeseries } = buildEventTimeseries(matview, raw, TODAY);
    expect(timeseries.find((t) => t.day === TODAY)!.count).toBe(3); // not 2
  });

  it('does not double-count past days (matview authoritative, raw ignored there)', () => {
    const matview = [{ day: '2026-06-24', event_count: 500 }];
    // raw also contains some of 2026-06-24 (sampled) — must NOT be added on top
    const raw = [`2026-06-24T10:00:00Z`, `2026-06-24T11:00:00Z`];
    const { timeseries, total_events } = buildEventTimeseries(matview, raw, TODAY);
    expect(timeseries).toEqual([{ day: '2026-06-24', count: 500 }]);
    expect(total_events).toBe(500);
  });

  it('falls back to matview for today when there are no raw events', () => {
    const matview = [{ day: TODAY, event_count: 7 }];
    const { timeseries } = buildEventTimeseries(matview, [], TODAY);
    expect(timeseries.find((t) => t.day === TODAY)!.count).toBe(7);
  });

  it('falls back to raw for a past day missing from the matview', () => {
    const raw = ['2026-06-20T10:00:00Z', '2026-06-20T11:00:00Z'];
    const { timeseries } = buildEventTimeseries([], raw, TODAY);
    expect(timeseries).toEqual([{ day: '2026-06-20', count: 2 }]);
  });

  it('sums multiple matview rows per day (locale/device buckets)', () => {
    const matview = [
      { day: '2026-06-24', event_count: 30 },
      { day: '2026-06-24', event_count: 70 },
    ];
    const { timeseries } = buildEventTimeseries(matview, [], TODAY);
    expect(timeseries).toEqual([{ day: '2026-06-24', count: 100 }]);
  });

  it('returns empty + zero total for no data', () => {
    expect(buildEventTimeseries([], [], TODAY)).toEqual({ timeseries: [], total_events: 0 });
  });
});
