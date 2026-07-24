/**
 * Seed planning — which cells we pre-collect, in what order, what we skip
 * (§5.7 R-8: "제주 주요 POI 30곳 … 셀당 수집 1회").
 *
 * Why this is a module and not just script code: everything here decides how
 * external quota gets spent. "Collect this POI, skip that one, stop at 70 %" is
 * exactly the logic a unit test must be able to pin, and it is exactly the
 * logic you cannot exercise without a live Kakao key if it lives inside the
 * script's main(). So the script does the io (load rows, call `collectCell`,
 * pace, print) and this file decides.
 *
 * Pure and client-safe by the same rule as places.ts/geohash.ts: no supabase,
 * no fetch, no `node:*`, no clock. `cellFor` is INJECTED rather than imported
 * from cache.server.ts — that keeps the single implementation of the cell
 * identity (there must never be two) without dragging the io modules in here.
 */

/** §R-8 — "제주 주요 POI 30곳". */
export const DEFAULT_SEED_LIMIT = 30;
/** The pilot region. `--region=` overrides. */
export const DEFAULT_SEED_REGION = 'jeju';

/** The `match_pois` columns the plan reads. Numeric columns arrive as strings. */
export interface SeedPoiRow {
  poi_key: string;
  name_en?: string | null;
  name_ko?: string | null;
  region?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  is_attraction?: boolean | null;
  stop_role?: string | null;
  /**
   * ⚠ GENERATED column — `poi_key LIKE 'OPS_%'`. It means "this is a logistics
   * row" (a pickup point, a hotel, an airport desk), NOT "this POI is in
   * operation". Those are never meal stops, so they are excluded rather than
   * required. See the deviation note in scripts/seed-dining-cells.ts.
   */
  is_operational?: boolean | null;
}

/** One POI that survived the filter, with its cell and its ordering signal. */
export interface SeedCandidate {
  poi_key: string;
  label: string;
  lat: number;
  lng: number;
  cell: string;
  /** Times this POI appears on a real itinerary — the visit-frequency proxy. */
  visits: number;
}

/**
 * Why a candidate will not be collected.
 *   `cached`         — a live `ops_kakao_cell_index` row already covers it.
 *   `duplicate-cell` — an earlier POI in this run resolves to the same cell,
 *                      so collecting again would buy nothing and cost quota.
 */
export type SeedSkipReason = 'cached' | 'duplicate-cell';

export interface SeedTarget extends SeedCandidate {
  skip: SeedSkipReason | null;
  /** `expires_at` of the live index row, when `skip === 'cached'`. */
  cachedUntil: string | null;
}

export interface SeedPlan {
  /** In collection order. Never longer than `limit`. */
  collect: SeedTarget[];
  /** Candidates walked past on the way — reported so the operator sees why. */
  skipped: SeedTarget[];
  limit: number;
}

export interface SeedOptions {
  /** Default posture: nothing is collected unless `--apply` is passed. */
  dry: boolean;
  apply: boolean;
  force: boolean;
  region: string | null;
  limit: number | null;
  poiKeys: string[];
  radiusM: number | null;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** Korean name first — this is an operator-facing log, and ops read Korean. */
export function poiLabel(row: SeedPoiRow): string {
  return (row.name_ko?.trim() || row.name_en?.trim() || row.poi_key) ?? row.poi_key;
}

/**
 * `[{ poi_key }, …]` from `match_itinerary_stops` → per-POI appearance counts.
 *
 * This is the honest reading of the spec's "방문빈도순": how often a POI is on
 * an itinerary we actually sell. There is no visit counter in the schema, and
 * inventing one from bookings would be a much heavier query for the same order.
 */
export function visitCountsFromStops(
  stops: Array<{ poi_key?: unknown }> | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(stops)) return out;
  for (const stop of stops) {
    const key = typeof stop?.poi_key === 'string' ? stop.poi_key.trim() : '';
    if (!key) continue;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/**
 * Filter + order the catalogue into collection candidates.
 *
 * Order (highest value first, so a `--limit` cut keeps the best stops):
 *   1. itinerary appearances — the visit-frequency signal §R-8 asks for
 *   2. `stop_role === 'attraction'` — a real timetabled stop
 *   3. `is_attraction`
 *   4. `poi_key` — a deterministic tiebreak, so two runs plan identically
 *
 * An explicit `poiKeys` list replaces the region filter entirely and keeps the
 * caller's order: naming a POI is an operator's explicit intent, and second-
 * guessing it with the catalogue's own ranking would be surprising.
 */
export function seedCandidates(
  rows: SeedPoiRow[] | null | undefined,
  opts: { region?: string | null; poiKeys?: string[]; visitCounts?: Record<string, number> },
  cellFor: (lat: number, lng: number) => string,
): SeedCandidate[] {
  const visitCounts = opts.visitCounts ?? {};
  const wanted = (opts.poiKeys ?? []).map((key) => key.trim()).filter(Boolean);
  const region = opts.region?.trim().toLowerCase() || null;

  const usable: Array<{ row: SeedPoiRow; lat: number; lng: number }> = [];
  for (const row of rows ?? []) {
    if (!row || typeof row.poi_key !== 'string' || !row.poi_key.trim()) continue;
    const lat = num(row.lat);
    const lng = num(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (wanted.length === 0) {
      // OPS_ rows are pickup logistics, never a meal stop.
      if (row.is_operational === true) continue;
      if (region && (row.region ?? '').trim().toLowerCase() !== region) continue;
    } else if (!wanted.includes(row.poi_key)) {
      continue;
    }
    usable.push({ row, lat, lng });
  }

  const toCandidate = ({ row, lat, lng }: { row: SeedPoiRow; lat: number; lng: number }): SeedCandidate => ({
    poi_key: row.poi_key,
    label: poiLabel(row),
    lat,
    lng,
    cell: cellFor(lat, lng),
    visits: visitCounts[row.poi_key] ?? 0,
  });

  if (wanted.length > 0) {
    const byKey = new Map(usable.map((entry) => [entry.row.poi_key, entry]));
    return wanted
      .map((key) => byKey.get(key))
      .filter((entry): entry is { row: SeedPoiRow; lat: number; lng: number } => Boolean(entry))
      .map(toCandidate);
  }

  return usable
    .map((entry) => ({ entry, candidate: toCandidate(entry) }))
    .sort((a, b) => {
      if (b.candidate.visits !== a.candidate.visits) return b.candidate.visits - a.candidate.visits;
      const aStop = a.entry.row.stop_role === 'attraction' ? 1 : 0;
      const bStop = b.entry.row.stop_role === 'attraction' ? 1 : 0;
      if (bStop !== aStop) return bStop - aStop;
      const aAttr = a.entry.row.is_attraction ? 1 : 0;
      const bAttr = b.entry.row.is_attraction ? 1 : 0;
      if (bAttr !== aAttr) return bAttr - aAttr;
      return a.candidate.poi_key.localeCompare(b.candidate.poi_key);
    })
    .map(({ candidate }) => candidate);
}

/**
 * Mark skips and cut to `limit`.
 *
 * 🔴 `limit` caps the number of POIs we will actually COLLECT, not the number
 * we look at. Skipping is free (no call, no write), so a cached cell must not
 * consume the run's budget — otherwise a second run over an already-warm
 * catalogue would collect nothing while claiming it did 30.
 *
 * `cachedCells` holds only cells whose index row is still alive; the caller
 * does the `expires_at > now` comparison in the query, so this stays clockless.
 */
export function planSeed(
  candidates: SeedCandidate[] | null | undefined,
  opts: { cachedCells?: Record<string, string | null>; limit?: number | null; force?: boolean } = {},
): SeedPlan {
  const cached = opts.cachedCells ?? {};
  const limit = Number.isFinite(opts.limit) && (opts.limit as number) > 0 ? Math.floor(opts.limit as number) : DEFAULT_SEED_LIMIT;

  const collect: SeedTarget[] = [];
  const skipped: SeedTarget[] = [];
  const claimed = new Set<string>();

  for (const candidate of candidates ?? []) {
    if (collect.length >= limit) break;

    if (claimed.has(candidate.cell)) {
      skipped.push({ ...candidate, skip: 'duplicate-cell', cachedUntil: null });
      continue;
    }
    if (!opts.force && Object.prototype.hasOwnProperty.call(cached, candidate.cell)) {
      skipped.push({ ...candidate, skip: 'cached', cachedUntil: cached[candidate.cell] ?? null });
      claimed.add(candidate.cell);
      continue;
    }
    claimed.add(candidate.cell);
    collect.push({ ...candidate, skip: null, cachedUntil: cached[candidate.cell] ?? null });
  }

  return { collect, skipped, limit };
}

/**
 * The quota brake (§R-3 "일일 쿼터 70% 도달 시 알림", §R-8 "쿼터 70% 도달 시 중단").
 *
 * Checked BEFORE each POI, not once at the start: a 30-POI run spends up to
 * ~150 calls, which can cross the line mid-run. Stopping leaves the remaining
 * POIs to a later run — every collected cell is independently useful, so a
 * partial seed is a real result, not a failure.
 */
export function shouldAbortForQuota(ratio: number, threshold: number): boolean {
  if (!Number.isFinite(ratio) || !Number.isFinite(threshold) || threshold <= 0) return false;
  return ratio >= threshold;
}

function collectFlagValues(argv: string[], name: string): string[] {
  const prefix = `--${name}=`;
  return argv
    .filter((entry) => entry.startsWith(prefix))
    .flatMap((entry) => entry.slice(prefix.length).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function firstFlagValue(argv: string[], name: string): string | null {
  const values = collectFlagValues(argv, name);
  return values.length > 0 ? values[0] : null;
}

function positiveInt(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * CLI parsing, in the house `arg()` idiom but repeat-aware for `--poi=`.
 *
 * Dry is the default posture (same as collect-facility-pins.mjs) and an
 * explicit `--dry` always wins over `--apply`: a run that spends real quota
 * should never be something you got by accident.
 */
export function parseSeedArgs(argv: string[]): SeedOptions {
  const explicitDry = argv.includes('--dry');
  const apply = argv.includes('--apply') && !explicitDry;
  return {
    dry: !apply,
    apply,
    force: argv.includes('--force'),
    region: firstFlagValue(argv, 'region') ?? DEFAULT_SEED_REGION,
    limit: positiveInt(firstFlagValue(argv, 'limit')),
    poiKeys: collectFlagValues(argv, 'poi'),
    radiusM: positiveInt(firstFlagValue(argv, 'radius')),
  };
}

/** `--limit` when given, else the number of named POIs, else 30. */
export function resolveSeedLimit(opts: Pick<SeedOptions, 'limit' | 'poiKeys'>): number {
  if (opts.limit && opts.limit > 0) return opts.limit;
  if (opts.poiKeys.length > 0) return opts.poiKeys.length;
  return DEFAULT_SEED_LIMIT;
}
