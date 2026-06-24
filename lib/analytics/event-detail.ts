// Pure timeseries/total reconstruction for the single-event detail route (D-15).
//
// Two bugs this fixes:
//  1. Freshness inversion: the route only folded raw events into days ENTIRELY
//     absent from the matview. "Today" is normally present in the matview (older
//     hours rolled up) but missing its last hour, so today's most recent events
//     were silently dropped.
//  2. Capped subset labelled as totals: total_events used the raw row count,
//     which is capped (50k) — a subset mislabelled as the true total.
//
// Rule: the hourly matview is authoritative & complete for fully-elapsed past
// days; the raw pull is fresh but capped + ordered newest-first, so it fully
// covers TODAY (the most recent slice) but may truncate older days. Therefore:
//  - past days  → matview count (fallback to raw if matview missing)
//  - today      → raw count     (fresh; fallback to matview if no raw)
//  - total_events = sum of the merged series (consistent with the chart)

export type MatviewDailyRow = { day: string; event_count?: number | null };

export type EventTimeseries = {
  timeseries: { day: string; count: number }[];
  total_events: number;
};

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function buildEventTimeseries(
  matviewDaily: MatviewDailyRow[],
  rawServerTimestamps: string[],
  todayUtc: string,
): EventTimeseries {
  const matviewByDay = new Map<string, number>();
  for (const r of matviewDaily) {
    const day = dayOf(String(r.day));
    matviewByDay.set(day, (matviewByDay.get(day) ?? 0) + Number(r.event_count ?? 0));
  }

  const rawByDay = new Map<string, number>();
  for (const ts of rawServerTimestamps) {
    const day = dayOf(ts);
    rawByDay.set(day, (rawByDay.get(day) ?? 0) + 1);
  }

  const days = new Set<string>([...matviewByDay.keys(), ...rawByDay.keys()]);
  const timeseries = Array.from(days)
    .map((day) => {
      const count =
        day === todayUtc
          ? rawByDay.get(day) ?? matviewByDay.get(day) ?? 0
          : matviewByDay.get(day) ?? rawByDay.get(day) ?? 0;
      return { day, count };
    })
    .sort((a, b) => a.day.localeCompare(b.day));

  const total_events = timeseries.reduce((acc, t) => acc + t.count, 0);
  return { timeseries, total_events };
}
