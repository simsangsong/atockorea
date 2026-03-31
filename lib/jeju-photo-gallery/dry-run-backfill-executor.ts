/**
 * Jeju photo gallery backfill executor: Step 3 target set + Step 4 match/fetch/merge.
 * DB writes only when `applyWrites: true` and `dryRun: false` (explicit write mode).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_MATCH_FETCH_CONFIG,
  matchFetchAndMergeForPoi,
  type LookupPathUsed,
  type MatchFetchForPoiConfig,
  type RequestBudget,
} from '@/lib/jeju-photo-gallery/match-fetch-for-poi';
import { buildJejuPhotoGalleryWritePayload, type JejuPhotoGalleryWritePayload } from '@/lib/jeju-photo-gallery/write-payload';
import {
  resolveJejuPhotoTargetSet,
  type JejuPhotoTargetSetEntry,
  type JejuPhotoTargetSetRow,
} from '@/lib/jeju-photo-gallery/resolve-target-set';
import type { JejuPhotoTargetSetConfig } from '@/lib/jeju-photo-gallery/target-set-config';
import { JejuPhotoGalleryTourApiClient } from '@/lib/jeju-photo-gallery/tour-api';
import { computeMissingGallerySlots, countStoredGalleryPhotos } from '@/lib/jeju-photo-gallery/photo-storage-count';

export function getTourApiServiceKeyFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): string | null {
  const k = env.TOUR_API_SERVICE_KEY?.trim() || env.TOUR_API_KEY?.trim();
  return k ? k : null;
}

export type JejuPhotoDryRunPoiLog = {
  rank: number;
  poiId: number;
  contentId: string;
  contentTypeId: number;
  title: string | null;
  currentPhotoCount: number;
  missingSlots: number;
  lookupPath: LookupPathUsed;
  requestCount: number;
  candidateCountFetched: number;
  detailRowCount: number;
  searchListRowCount: number;
  selectedNewCount: number;
  finalMergedCount: number;
  skipReason?: string;
  confidenceSummary: string;
  lowConfidenceRejected: boolean;
  errorMessages: string[];
  /** Merge-ready payload when new photos were selected (dry-run still skips DB). */
  writePayloadPreview: JejuPhotoGalleryWritePayload | null;
  /** Set when `applyWrites && !dryRun`. */
  writeDbAction?: 'written' | 'skipped';
  writeDbReason?: string;
};

export type JejuPhotoDryRunAggregate = {
  totalTargetPois: number;
  alreadyComplete: number;
  attempted: number;
  fillable: number;
  noMatch: number;
  lowConfidenceRejected: number;
  wouldCompleteThisRun: number;
  stillIncompleteAfter: number;
  totalRequestsConsumed: number;
  skippedBudget: number;
  stoppedEarlyReason?: string;
  /** Write mode: rows updated with merged JSON change. */
  rowsWritten: number;
  /** Write mode: would update but stable JSON matched DB (no-op). */
  rowsSkippedNoop: number;
  /** Write mode: Supabase update failed after attempting. */
  rowsWriteFailed: number;
};

export type JejuPhotoGalleryBackfillExecutorResult = {
  ok: boolean;
  fatalError?: string;
  /** Mirrors options — DB writes only when `applyWrites` is enabled in Step 6. */
  dryRun: boolean;
  aggregate: JejuPhotoDryRunAggregate;
  poiLogs: JejuPhotoDryRunPoiLog[];
  configUsed: {
    targetSet: JejuPhotoTargetSetConfig;
    matchFetch: MatchFetchForPoiConfig;
  };
};

export type JejuPhotoGalleryBackfillExecutorOptions = {
  targetSetConfig: JejuPhotoTargetSetConfig;
  matchFetch?: Partial<MatchFetchForPoiConfig>;
  maxPoisToProcess?: number;
  /** Global cap on Tour API HTTP calls (each list/detail invocation). */
  maxRequests?: number;
  /** Default true — no Supabase updates. */
  dryRun?: boolean;
  /** Persist merged gallery to `jeju_kor_tourapi_places` when combined with `dryRun: false`. */
  applyWrites?: boolean;
  serviceKey?: string | null;
  tourApi?: JejuPhotoGalleryTourApiClient;
};

function buildMatchConfig(
  ts: JejuPhotoTargetSetConfig,
  partial?: Partial<MatchFetchForPoiConfig>,
): MatchFetchForPoiConfig {
  return {
    ...DEFAULT_MATCH_FETCH_CONFIG,
    targetPhotoCount: ts.targetPhotoCount,
    ...partial,
  };
}

export async function runJejuPhotoGalleryBackfillExecutor(
  supabase: SupabaseClient<any, any, any>,
  opts: JejuPhotoGalleryBackfillExecutorOptions,
): Promise<JejuPhotoGalleryBackfillExecutorResult> {
  const dryRun = opts.dryRun !== false;
  const applyWrites = opts.applyWrites === true;
  const doWrite = applyWrites && !dryRun;

  const targetSetConfig = opts.targetSetConfig;
  const matchFetch = buildMatchConfig(targetSetConfig, opts.matchFetch);

  const emptyAggregate = (): JejuPhotoDryRunAggregate => ({
    totalTargetPois: 0,
    alreadyComplete: 0,
    attempted: 0,
    fillable: 0,
    noMatch: 0,
    lowConfidenceRejected: 0,
    wouldCompleteThisRun: 0,
    stillIncompleteAfter: 0,
    totalRequestsConsumed: 0,
    skippedBudget: 0,
    rowsWritten: 0,
    rowsSkippedNoop: 0,
    rowsWriteFailed: 0,
  });

  const serviceKey = opts.serviceKey ?? getTourApiServiceKeyFromEnv();
  if (!serviceKey && !opts.tourApi) {
    return {
      ok: false,
      dryRun,
      fatalError:
        'Missing TOUR_API_SERVICE_KEY / TOUR_API_KEY — cannot call PhotoGalleryService1.',
      aggregate: emptyAggregate(),
      poiLogs: [],
      configUsed: { targetSet: targetSetConfig, matchFetch },
    };
  }

  const client =
    opts.tourApi ??
    new JejuPhotoGalleryTourApiClient({
      serviceKey: serviceKey as string,
    });

  let resolve;
  try {
    resolve = await resolveJejuPhotoTargetSet(supabase, targetSetConfig);
  } catch (e) {
    return {
      ok: false,
      dryRun,
      fatalError: e instanceof Error ? e.message : String(e),
      aggregate: emptyAggregate(),
      poiLogs: [],
      configUsed: { targetSet: targetSetConfig, matchFetch },
    };
  }

  const rowById = new Map<number, JejuPhotoTargetSetRow>();
  for (const r of resolve.rankedAfterSkips) {
    rowById.set(r.id, r);
  }

  const maxPois = opts.maxPoisToProcess ?? resolve.entries.length;
  const maxReq = opts.maxRequests ?? Number.MAX_SAFE_INTEGER;
  const globalBudget: RequestBudget = { used: 0, max: maxReq };

  const poiLogs: JejuPhotoDryRunPoiLog[] = [];
  const agg = emptyAggregate();
  agg.totalTargetPois = resolve.entries.length;

  let stoppedEarlyReason: string | undefined;

  for (let i = 0; i < Math.min(maxPois, resolve.entries.length); i++) {
    if (globalBudget.used >= globalBudget.max) {
      stoppedEarlyReason = 'maxRequests';
      break;
    }

    const entry = resolve.entries[i] as JejuPhotoTargetSetEntry;
    const row = rowById.get(entry.poiId);
    if (!row) {
      poiLogs.push({
        rank: entry.rank,
        poiId: entry.poiId,
        contentId: entry.contentId,
        contentTypeId: entry.contentTypeId,
        title: entry.title,
        currentPhotoCount: entry.currentPhotoCount,
        missingSlots: entry.missingSlots,
        lookupPath: 'error',
        requestCount: 0,
        candidateCountFetched: 0,
        detailRowCount: 0,
        searchListRowCount: 0,
        selectedNewCount: 0,
        finalMergedCount: entry.currentPhotoCount,
        confidenceSummary: 'row missing from rankedAfterSkips map',
        lowConfidenceRejected: false,
        errorMessages: ['internal: row not found'],
        writePayloadPreview: null,
      });
      continue;
    }

    const currentPhotoCount = countStoredGalleryPhotos(row);
    const missingSlots = computeMissingGallerySlots(row, targetSetConfig.targetPhotoCount);

    if (missingSlots <= 0) {
      agg.alreadyComplete += 1;
      poiLogs.push({
        rank: entry.rank,
        poiId: entry.poiId,
        contentId: entry.contentId,
        contentTypeId: entry.contentTypeId,
        title: entry.title,
        currentPhotoCount,
        missingSlots,
        lookupPath: 'skipped_complete',
        requestCount: 0,
        candidateCountFetched: 0,
        detailRowCount: 0,
        searchListRowCount: 0,
        selectedNewCount: 0,
        finalMergedCount: currentPhotoCount,
        skipReason: 'already_complete',
        confidenceSummary: `complete (${currentPhotoCount}/${targetSetConfig.targetPhotoCount})`,
        lowConfidenceRejected: false,
        errorMessages: [],
        writePayloadPreview: null,
      });
      continue;
    }

    agg.attempted += 1;

    let mf;
    try {
      const perPoiBudget: RequestBudget = {
        used: globalBudget.used,
        max: globalBudget.max,
      };
      mf = await matchFetchAndMergeForPoi({
        client,
        row,
        budget: perPoiBudget,
        config: matchFetch,
      });
      globalBudget.used = perPoiBudget.used;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      poiLogs.push({
        rank: entry.rank,
        poiId: entry.poiId,
        contentId: entry.contentId,
        contentTypeId: entry.contentTypeId,
        title: entry.title,
        currentPhotoCount,
        missingSlots,
        lookupPath: 'error',
        requestCount: 0,
        candidateCountFetched: 0,
        detailRowCount: 0,
        searchListRowCount: 0,
        selectedNewCount: 0,
        finalMergedCount: currentPhotoCount,
        confidenceSummary: 'exception',
        lowConfidenceRejected: false,
        errorMessages: [msg],
        writePayloadPreview: null,
      });
      continue;
    }

    const writePayloadPreview =
      mf.mergeResult && mf.selectedNewCount > 0 && mf.mergeResult.mergedGallery
        ? buildJejuPhotoGalleryWritePayload({
            poiId: entry.poiId,
            contentId: entry.contentId,
            contentTypeId: entry.contentTypeId,
            title: entry.title,
            mergedGallery: mf.mergeResult.mergedGallery,
            selectedNewPhotos: mf.mergeResult.selectedNewItems,
          })
        : null;

    let writeDbAction: 'written' | 'skipped' | undefined;
    let writeDbReason: string | undefined;
    const errMsgs = [...mf.errorMessages];

    if (doWrite && writePayloadPreview) {
      const beforeJson = row.photo_gallery_detail_json;
      const afterJson = writePayloadPreview.photo_gallery_detail_json;
      if (stableStringifyJson(beforeJson) === stableStringifyJson(afterJson)) {
        writeDbAction = 'skipped';
        writeDbReason = 'no_merged_change';
        agg.rowsSkippedNoop += 1;
      } else {
        const { error } = await supabase
          .from('jeju_kor_tourapi_places')
          .update({
            photo_gallery_detail_json: afterJson,
            photo_gallery_fetched_at: writePayloadPreview.photo_gallery_fetched_at,
          })
          .eq('id', entry.poiId);
        if (error) {
          writeDbAction = 'skipped';
          writeDbReason = error.message;
          agg.rowsWriteFailed += 1;
          errMsgs.push(`db write: ${error.message}`);
        } else {
          writeDbAction = 'written';
          writeDbReason = 'updated';
          agg.rowsWritten += 1;
        }
      }
    } else if (doWrite && !writePayloadPreview) {
      writeDbAction = 'skipped';
      writeDbReason = 'no_new_unique_photos';
    }

    poiLogs.push({
      rank: entry.rank,
      poiId: entry.poiId,
      contentId: entry.contentId,
      contentTypeId: entry.contentTypeId,
      title: entry.title,
      currentPhotoCount,
      missingSlots,
      lookupPath: mf.lookupPath,
      requestCount: mf.requestCount,
      candidateCountFetched: mf.candidateCountFetched,
      detailRowCount: mf.detailRowCount,
      searchListRowCount: mf.searchListRowCount,
      selectedNewCount: mf.selectedNewCount,
      finalMergedCount: mf.finalMergedCount,
      skipReason: mf.skipReason,
      confidenceSummary: mf.confidenceSummary,
      lowConfidenceRejected: mf.lowConfidenceRejected,
      errorMessages: errMsgs,
      writePayloadPreview,
      writeDbAction,
      writeDbReason,
    });

    if (mf.selectedNewCount > 0) agg.fillable += 1;
    if (mf.lookupPath === 'no_match') agg.noMatch += 1;
    if (mf.lowConfidenceRejected) agg.lowConfidenceRejected += 1;
    if (mf.lookupPath === 'skipped_budget') {
      agg.skippedBudget += 1;
    } else if (mf.finalMergedCount >= targetSetConfig.targetPhotoCount) {
      agg.wouldCompleteThisRun += 1;
    } else {
      agg.stillIncompleteAfter += 1;
    }

    agg.totalRequestsConsumed += mf.requestCount;
  }

  if (stoppedEarlyReason) {
    agg.stoppedEarlyReason = stoppedEarlyReason;
  }

  return {
    ok: true,
    dryRun,
    aggregate: agg,
    poiLogs,
    configUsed: { targetSet: targetSetConfig, matchFetch },
  };
}

/**
 * Compact multi-line summary for logs / manual inspection of a sample of POIs.
 */
export function formatJejuPhotoDryRunSummaryText(result: JejuPhotoGalleryBackfillExecutorResult): string {
  const a = result.aggregate;
  const lines: string[] = [
    '=== Jeju photo gallery backfill aggregate ===',
    `totalTargetPois=${a.totalTargetPois}`,
    `alreadyComplete=${a.alreadyComplete}`,
    `attempted=${a.attempted}`,
    `fillable=${a.fillable}`,
    `noMatch=${a.noMatch}`,
    `lowConfidenceRejected=${a.lowConfidenceRejected}`,
    `wouldCompleteThisRun=${a.wouldCompleteThisRun}`,
    `stillIncompleteAfter=${a.stillIncompleteAfter}`,
    `skippedBudget=${a.skippedBudget}`,
    `totalRequestsConsumed=${a.totalRequestsConsumed}`,
    `rowsWritten=${a.rowsWritten}`,
    `rowsSkippedNoop=${a.rowsSkippedNoop}`,
    `rowsWriteFailed=${a.rowsWriteFailed}`,
    a.stoppedEarlyReason ? `stoppedEarly=${a.stoppedEarlyReason}` : '',
    '',
  ].filter(Boolean);

  for (const p of result.poiLogs) {
    lines.push(
      [
        `[#${p.rank}] id=${poiIdStr(p)} cid=${p.contentId}@${p.contentTypeId}`,
        `"${p.title ?? ''}"`,
        `photos=${p.currentPhotoCount} missing=${p.missingSlots}`,
        `path=${p.lookupPath} req=${p.requestCount}`,
        `cand=${p.candidateCountFetched} new=${p.selectedNewCount} final=${p.finalMergedCount}`,
        `conf=${p.confidenceSummary}`,
        p.skipReason ? `skip=${p.skipReason}` : '',
        p.writeDbAction ? `db=${p.writeDbAction}` : '',
        p.writeDbReason ? `dbReason=${p.writeDbReason}` : '',
        p.errorMessages.length ? `err=${p.errorMessages.join(';')}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }

  return lines.join('\n');
}

function poiIdStr(p: JejuPhotoDryRunPoiLog): string {
  return String(p.poiId);
}

/** Deterministic JSON compare for skip-no-op writes (sorted object keys). */
function stableStringifyJson(value: unknown): string {
  return stableStringify(value === undefined ? null : value);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  const keys = Object.keys(value as object).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') +
    '}'
  );
}
