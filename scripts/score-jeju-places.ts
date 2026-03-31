/**
 * Batch: recompute heuristic region/tags + popularity/data_quality/base_score for jeju_kor_tourapi_places.
 * Does not modify import pipeline. Requires migration 20250322170000_jeju_kor_tourapi_places_scoring.sql.
 *
 * npm run score:jeju:places
 */

import * as fs from 'fs';
import * as path from 'path';
import { createServiceSupabase } from './jeju-tourapi/supabase-upsert';
import {
  buildReadcountStats,
  calcBaseScore,
  calcDataQualityScore,
  calcPopularityScore,
  inferFreePaid,
  inferIndoorOutdoor,
  inferRegionGroup,
  type JejuPlaceScoringInput,
} from './jeju-tourapi/scoring';

const SCORING_VERSION = 'v1';

function loadEnvFiles(): void {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      const cur = process.env[key];
      if (cur === undefined || String(cur).trim() === '') process.env[key] = val;
    }
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

type DbRow = JejuPlaceScoringInput;

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function numStrOrNull(v: unknown): number | string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v;
  return null;
}

function boolOrNull(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

/**
 * `select('*')` 결과를 스키마에 맞춤. 점수 마이그레이션 전이면 수동 컬럼은 undefined → null.
 */
function normalizeRow(r: Record<string, unknown>): JejuPlaceScoringInput {
  const id = Number(r.id);
  if (!Number.isFinite(id)) {
    throw new Error(`[fetch] invalid id: ${String(r.id)}`);
  }
  return {
    id,
    title: strOrNull(r.title),
    addr1: strOrNull(r.addr1),
    addr2: strOrNull(r.addr2),
    overview: strOrNull(r.overview),
    first_image: strOrNull(r.first_image),
    first_image2: strOrNull(r.first_image2),
    mapx: numStrOrNull(r.mapx),
    mapy: numStrOrNull(r.mapy),
    tel: strOrNull(r.tel),
    readcount: numOrNull(r.readcount),
    use_time_text: strOrNull(r.use_time_text),
    fee_text: strOrNull(r.fee_text),
    intro_raw_json:
      r.intro_raw_json != null && typeof r.intro_raw_json === 'object'
        ? (r.intro_raw_json as Record<string, unknown>)
        : null,
    detail_info_raw_json:
      r.detail_info_raw_json != null && typeof r.detail_info_raw_json === 'object'
        ? (r.detail_info_raw_json as Record<string, unknown>)
        : null,
    travel_value_score: numStrOrNull(r.travel_value_score),
    photo_score: numStrOrNull(r.photo_score),
    manual_priority: numStrOrNull(r.manual_priority),
    manual_hidden: boolOrNull(r.manual_hidden),
  };
}

async function fetchAllRows(supabase: ReturnType<typeof createServiceSupabase>): Promise<DbRow[]> {
  const pageSize = 1000;
  let from = 0;
  const out: DbRow[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`[fetch] ${error.message}`);
    const raw = (data ?? []) as Record<string, unknown>[];
    if (raw.length === 0) break;
    for (const row of raw) {
      out.push(normalizeRow(row));
    }
    if (raw.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

type ScoredRecord = DbRow & {
  region_group: string;
  is_indoor: boolean | null;
  is_outdoor: boolean | null;
  is_free: boolean | null;
  is_paid: boolean | null;
  popularity_score: number | null;
  data_quality_score: number;
  base_score: number;
  scoring_version: string;
  scored_at: string;
};

async function main(): Promise<void> {
  loadEnvFiles();
  const t0 = Date.now();
  const skipSupabase =
    (process.env.JEJU_SCORE_SKIP_SUPABASE || '').trim() === '1' ||
    (process.env.JEJU_SCORE_DRY_RUN || '').trim() === '1';
  const supabase = createServiceSupabase();

  const rows = await fetchAllRows(supabase);
  const stats = buildReadcountStats(rows);
  const scoredAt = new Date().toISOString();

  const scored: ScoredRecord[] = rows.map((row) => {
    const region_group = inferRegionGroup(row);
    const io = inferIndoorOutdoor(row);
    const fp = inferFreePaid(row);
    const popularity_score = calcPopularityScore(row, stats);
    const data_quality_score = calcDataQualityScore(row);
    const base_score = calcBaseScore({
      popularity_score,
      data_quality_score,
      travel_value_score: row.travel_value_score,
      photo_score: row.photo_score,
      manual_priority: row.manual_priority,
      manual_hidden: row.manual_hidden,
    });
    return {
      ...row,
      region_group,
      is_indoor: io.is_indoor,
      is_outdoor: io.is_outdoor,
      is_free: fp.is_free,
      is_paid: fp.is_paid,
      popularity_score,
      data_quality_score,
      base_score,
      scoring_version: SCORING_VERSION,
      scored_at: scoredAt,
    };
  });

  let supabaseUpdated = 0;
  let supabaseErrors = 0;
  let migrationHintPrinted = false;
  const maxUpdateErrorLines = 5;
  let updateErrorLines = 0;

  const chunkSize = Math.max(
    1,
    Math.min(100, parseInt(process.env.JEJU_SCORE_UPDATE_CHUNK || '25', 10) || 25),
  );

  if (!skipSupabase) {
    for (let i = 0; i < scored.length; i += chunkSize) {
      const chunk = scored.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (rec) => {
          const patch = {
            region_group: rec.region_group,
            is_indoor: rec.is_indoor,
            is_outdoor: rec.is_outdoor,
            is_free: rec.is_free,
            is_paid: rec.is_paid,
            popularity_score: rec.popularity_score,
            data_quality_score: rec.data_quality_score,
            base_score: rec.base_score,
            scoring_version: SCORING_VERSION,
            scored_at: scoredAt,
          };
          const { error } = await supabase
            .from('jeju_kor_tourapi_places')
            .update(patch)
            .eq('id', rec.id);
          if (error) {
            const msg = error.message;
            if (
              !migrationHintPrinted &&
              (/column|schema cache/i.test(msg) || /does not exist/i.test(msg))
            ) {
              migrationHintPrinted = true;
              console.error(
                '\n[hint] Scoring columns missing. Apply SQL migration:\n' +
                  '  supabase/migrations/20250322170000_jeju_kor_tourapi_places_scoring.sql\n' +
                  'Or set JEJU_SCORE_SKIP_SUPABASE=1 to write JSON only.\n',
              );
            }
            if (updateErrorLines < maxUpdateErrorLines) {
              console.error(`[update] id=${rec.id}`, msg);
              updateErrorLines += 1;
            } else if (updateErrorLines === maxUpdateErrorLines) {
              console.error('[update] … (further errors suppressed)');
              updateErrorLines += 1;
            }
            return false;
          }
          return true;
        }),
      );
      for (const ok of results) {
        if (ok) supabaseUpdated += 1;
        else supabaseErrors += 1;
      }
    }
  }

  const outDir = path.join(process.cwd(), 'data', 'output');
  ensureDir(outDir);
  const jsonPath = path.join(outDir, 'jeju-all-places-scored.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        meta: {
          scoring_version: SCORING_VERSION,
          scored_at: scoredAt,
          total_places: rows.length,
          readcount_min: stats.nonNullCount ? stats.min : null,
          readcount_max: stats.nonNullCount ? stats.max : null,
          supabase_skipped: skipSupabase,
          supabase_updated: supabaseUpdated,
          supabase_errors: supabaseErrors,
        },
        places: scored,
      },
      null,
      2,
    ),
    'utf8',
  );

  const missingReadcount = rows.filter((r) => r.readcount == null).length;
  const missingOverview = rows.filter((r) => !r.overview || String(r.overview).trim() === '').length;
  const missingImage = rows.filter(
    (r) => (!r.first_image || String(r.first_image).trim() === '') &&
      (!r.first_image2 || String(r.first_image2).trim() === ''),
  ).length;
  const hiddenCount = rows.filter((r) => r.manual_hidden === true).length;

  console.log('\n=== Jeju place scoring (batch) ===');
  if (skipSupabase) {
    console.log('Supabase updates: skipped (JEJU_SCORE_SKIP_SUPABASE=1 or JEJU_SCORE_DRY_RUN=1)');
  }
  console.log(`total places: ${rows.length}`);
  console.log(`scored count (computed rows): ${scored.length}`);
  console.log(
    `readcount min/max (non-null): ${stats.nonNullCount ? `${stats.min} / ${stats.max}` : 'n/a'}`,
  );
  console.log(`Supabase rows updated: ${supabaseUpdated}`);
  console.log(`update errors: ${supabaseErrors}`);
  console.log(`manual_hidden count: ${hiddenCount}`);
  console.log(`missing readcount: ${missingReadcount}`);
  console.log(`missing overview: ${missingOverview}`);
  console.log(`missing first image: ${missingImage}`);
  console.log(`JSON output: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  if (supabaseErrors > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
