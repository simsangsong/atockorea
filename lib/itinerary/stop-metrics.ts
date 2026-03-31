import type { GeminiDraft, JejuPoiRow } from './types';

const num = (v: unknown) => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
};

/** Conservative default when model/DB omit dwell time */
const DEFAULT_STOP_MIN = 45;
const MIN_DWELL_MIN = 20;
const MAX_DWELL_MIN = 300;

/** Higher = more essential — used to drop weakest stops first */
export function stopStrength(row: JejuPoiRow | undefined): number {
  if (!row) return 0;
  return (
    num(row.manual_priority) * 1000 +
    num(row.manual_boost_score) +
    num(row.base_score) * 10 +
    num(row.data_quality_score) +
    num(row.travel_value_score) * 5 +
    num(row.route_efficiency_score) * 2
  );
}

/** Admin recommended vs model dwell — use the tighter bound when both exist (compress updates planned). */
export function dwellMinutesForStop(
  stop: GeminiDraft['stops'][number],
  row: JejuPoiRow | undefined,
): number {
  const rec = row?.recommended_duration_min;
  const p = stop.plannedDurationMin;
  if (rec != null && rec > 0 && p > 0) {
    const m = Math.min(Math.round(rec), Math.round(p));
    return Math.min(MAX_DWELL_MIN, Math.max(MIN_DWELL_MIN, m));
  }
  if (rec != null && rec > 0) {
    return Math.min(MAX_DWELL_MIN, Math.max(MIN_DWELL_MIN, Math.round(rec)));
  }
  if (p > 0) {
    return Math.min(MAX_DWELL_MIN, Math.max(MIN_DWELL_MIN, Math.round(p)));
  }
  return DEFAULT_STOP_MIN;
}
