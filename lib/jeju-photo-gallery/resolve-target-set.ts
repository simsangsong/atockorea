/**
 * Resolves the ranked Jeju POI target set for photo backfill (DB load only — no Tour API).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sortJejuPoisByCanonicalRank, type CanonicalSortablePoiRow } from './canonical-poi-sort';
import { computeMissingGallerySlots, countStoredGalleryPhotos, isPoiGalleryComplete } from './photo-storage-count';
import type { JejuPhotoTargetSetConfig } from './target-set-config';
import { buildPhotoBackfillSkipContext, shouldSkipPoiForPhotoBackfill, type PoiRowForSkipCheck } from './skip-rules';

export type JejuPhotoTargetSetRow = CanonicalSortablePoiRow &
  PoiRowForSkipCheck & {
    photo_gallery_detail_json?: unknown;
  };

export type JejuPhotoTargetSetEntry = {
  /** 1-based rank within the returned target slice. */
  rank: number;
  poiId: number;
  contentId: string;
  contentTypeId: number;
  title: string | null;
  currentPhotoCount: number;
  missingSlots: number;
  isComplete: boolean;
};

export type ResolveJejuPhotoTargetSetResult = {
  config: JejuPhotoTargetSetConfig;
  /** Rows considered for ranking after DB load + skip rules (before incomplete filter + slice). */
  rankedAfterSkips: JejuPhotoTargetSetRow[];
  /** Final work queue: at most `config.topN` entries. */
  entries: JejuPhotoTargetSetEntry[];
  stats: {
    loadedFromDb: number;
    skippedByRules: number;
    afterIncompleteFilter: number;
    /** POIs in ranked pool with missingSlots === 0 (for summaries). */
    alreadyCompleteInPool: number;
  };
};

async function fetchAllEligibleRows(
  supabase: SupabaseClient<any, any, any>,
): Promise<JejuPhotoTargetSetRow[]> {
  const pageSize = 1000;
  const out: JejuPhotoTargetSetRow[] = [];
  let from = 0;
  for (;;) {
    // Select all columns so the query succeeds even when optional ranking columns (e.g. manual_boost_score)
    // are not yet migrated on the connected DB. Canonical sort treats missing fields as neutral (see canonical-poi-sort).
    const { data, error } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*')
      .or('manual_hidden.eq.false,manual_hidden.is.null')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`jeju photo target set: ${error.message}`);
    const rows = (data ?? []) as JejuPhotoTargetSetRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/**
 * Pure resolver: given all eligible rows from DB (Jeju table), apply skip rules, canonical sort,
 * incomplete filter, and top-N slice. No I/O.
 */
export function resolveJejuPhotoTargetSetFromRows(
  rows: JejuPhotoTargetSetRow[],
  config: JejuPhotoTargetSetConfig,
): ResolveJejuPhotoTargetSetResult {
  const skipCtx = buildPhotoBackfillSkipContext(
    config.skipTitlesCsv,
    config.skipAliasesCsv,
    config.skipPoiIdsCsv,
    config.useDefaultIslandExclusions,
  );

  let skippedByRules = 0;
  const afterSkip: JejuPhotoTargetSetRow[] = [];
  for (const row of rows) {
    const { skip } = shouldSkipPoiForPhotoBackfill(row, skipCtx);
    if (skip) {
      skippedByRules += 1;
      continue;
    }
    afterSkip.push(row);
  }

  const sorted = sortJejuPoisByCanonicalRank(afterSkip);

  const includeIncompleteOnly = config.onlyIncomplete && !config.forceRefresh;

  let alreadyCompleteInPool = 0;
  const pool: JejuPhotoTargetSetRow[] = [];
  for (const row of sorted) {
    const complete = isPoiGalleryComplete(row, config.targetPhotoCount);
    if (complete) alreadyCompleteInPool += 1;
    if (includeIncompleteOnly && complete) continue;
    pool.push(row);
  }

  const afterIncompleteFilter = pool.length;
  const sliced = pool.slice(0, config.topN);

  const entries: JejuPhotoTargetSetEntry[] = sliced.map((row, i) => {
    const currentPhotoCount = countStoredGalleryPhotos(row);
    const missingSlots = computeMissingGallerySlots(row, config.targetPhotoCount);
    return {
      rank: i + 1,
      poiId: row.id,
      contentId: row.content_id,
      contentTypeId: row.content_type_id,
      title: row.title,
      currentPhotoCount,
      missingSlots,
      isComplete: missingSlots <= 0,
    };
  });

  return {
    config,
    rankedAfterSkips: sorted,
    entries,
    stats: {
      loadedFromDb: rows.length,
      skippedByRules,
      afterIncompleteFilter,
      alreadyCompleteInPool,
    },
  };
}

/**
 * Loads `jeju_kor_tourapi_places` (hidden filtered), then resolves the target set.
 * **No Tour API** — Supabase only.
 */
export async function resolveJejuPhotoTargetSet(
  supabase: SupabaseClient<any, any, any>,
  config: JejuPhotoTargetSetConfig,
): Promise<ResolveJejuPhotoTargetSetResult> {
  const rows = await fetchAllEligibleRows(supabase);
  return resolveJejuPhotoTargetSetFromRows(rows, config);
}
