/**
 * Canonical POI ordering — matches `lib/itinerary/candidate-query.ts` `fetchJejuPoiCandidates` sort:
 * manual_priority (desc) → manual_boost_score (desc) → base_score (desc) → data_quality_score (desc) → title (asc).
 */

export type CanonicalSortablePoiRow = {
  title: string | null;
  manual_priority?: unknown;
  manual_boost_score?: unknown;
  base_score?: unknown;
  data_quality_score?: unknown;
};

/** Missing column / undefined / null → 0 so ranking stays stable when the DB omits optional numeric columns. */
function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Comparator: return &lt; 0 if `a` should rank after `b` (i.e. `b` is better).
 */
export function compareJejuPoiRowsForCanonicalRank(
  a: CanonicalSortablePoiRow,
  b: CanonicalSortablePoiRow,
): number {
  const pri = num(b.manual_priority) - num(a.manual_priority);
  if (pri !== 0) return pri;
  const boost = num(b.manual_boost_score) - num(a.manual_boost_score);
  if (boost !== 0) return boost;
  const bs = num(b.base_score) - num(a.base_score);
  if (bs !== 0) return bs;
  const dq = num(b.data_quality_score) - num(a.data_quality_score);
  if (dq !== 0) return dq;
  return (a.title || '').localeCompare(b.title || '');
}

export function sortJejuPoisByCanonicalRank<T extends CanonicalSortablePoiRow>(rows: T[]): T[] {
  return [...rows].sort(compareJejuPoiRowsForCanonicalRank);
}
