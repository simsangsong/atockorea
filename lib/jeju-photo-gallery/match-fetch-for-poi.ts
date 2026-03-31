/**
 * One POI: efficient Tour API path (direct detail when title confidence is high, else search→detail),
 * scoring, merge preview. Does not write DB.
 */

import { normalizeTitleForPhotoSkip } from '@/lib/jeju-photo-gallery/skip-rules';
import {
  normalizeGalleryDetailRowToCandidate,
  normalizeSearchListRowMeta,
  pickGalContentId,
  pickGalleryListTitle,
} from '@/lib/jeju-photo-gallery/gallery-candidate-normalize';
import {
  scoreGalleryCandidate,
  scoreSearchListGalleryTitle,
  shouldRejectWeakNonJeju,
  type PoiMatchContext,
} from '@/lib/jeju-photo-gallery/gallery-candidate-scoring';
import {
  computePoiTitleConfidenceForDirectDetail,
  JEJU_DIRECT_DETAIL_MIN_CONFIDENCE,
} from '@/lib/jeju-photo-gallery/title-confidence';
import {
  JejuPhotoGalleryTourApiClient,
  parseGenericItemsEnvelope,
} from '@/lib/jeju-photo-gallery/tour-api';
import type { JejuGalleryCandidate } from '@/lib/jeju-photo-gallery/gallery-candidate-types';
import type { ScoredCandidate } from '@/lib/jeju-photo-gallery/merge-gallery-selection';
import { mergeGallerySelection, sortScoredCandidatesDesc } from '@/lib/jeju-photo-gallery/merge-gallery-selection';
import { computeMissingGallerySlots, countStoredGalleryPhotos } from '@/lib/jeju-photo-gallery/photo-storage-count';
import type { PhotoGalleryCountRow } from '@/lib/jeju-photo-gallery/photo-storage-count';

export type LookupPathUsed =
  | 'skipped_complete'
  | 'skipped_no_title'
  | 'skipped_budget'
  | 'direct_detail'
  | 'search_then_detail'
  | 'direct_then_search'
  | 'no_match'
  | 'error';

export type MatchFetchForPoiConfig = {
  targetPhotoCount: number;
  minSearchListScore: number;
  minDetailPhotoScore: number;
  searchNumOfRows: number;
  directDetailMinConfidence: number;
};

export const DEFAULT_MATCH_FETCH_CONFIG: MatchFetchForPoiConfig = {
  targetPhotoCount: 8,
  minSearchListScore: 0.82,
  minDetailPhotoScore: 0.42,
  searchNumOfRows: 50,
  directDetailMinConfidence: JEJU_DIRECT_DETAIL_MIN_CONFIDENCE,
};

export type RequestBudget = {
  used: number;
  max: number;
};

export type MatchFetchForPoiResult = {
  lookupPath: LookupPathUsed;
  requestCount: number;
  candidateCountFetched: number;
  detailRowCount: number;
  searchListRowCount: number;
  selectedNewCount: number;
  finalMergedCount: number;
  mergeResult: ReturnType<typeof mergeGallerySelection> | null;
  confidenceSummary: string;
  skipReason?: string;
  lowConfidenceRejected: boolean;
  bestSearchScore?: number;
  errorMessages: string[];
};

function buildPoiContext(poiTitle: string): PoiMatchContext {
  return {
    poiTitle,
    poiTitleNorm: normalizeTitleForPhotoSkip(poiTitle),
  };
}

function detailEnvToScored(
  ctx: PoiMatchContext,
  text: string,
  httpStatus: number,
  sourceTitleQueried: string | null,
  galleryGroupHint: string | null,
  minDetailPhotoScore: number,
): { scored: ScoredCandidate[]; detailRowCount: number; parseError?: string } {
  const env = parseGenericItemsEnvelope(text, httpStatus);
  if (httpStatus === 401 || httpStatus === 403) {
    return { scored: [], detailRowCount: 0, parseError: `HTTP ${httpStatus} (auth)` };
  }
  if (httpStatus >= 500) {
    return { scored: [], detailRowCount: 0, parseError: `HTTP ${httpStatus}` };
  }
  if (!env.ok) {
    return {
      scored: [],
      detailRowCount: 0,
      parseError: env.parseError ?? env.resultMsg ?? 'parse',
    };
  }
  const scored: ScoredCandidate[] = [];
  for (const item of env.items) {
    const c = normalizeGalleryDetailRowToCandidate(item as Record<string, unknown>, {
      sourceTitleQueried,
      galleryGroupTitleHint: galleryGroupHint,
    });
    if (!c) continue;
    const br = scoreGalleryCandidate(ctx, c);
    if (shouldRejectWeakNonJeju(ctx, c, br)) continue;
    if (br.total < minDetailPhotoScore) continue;
    scored.push({ candidate: c, score: br });
  }
  return {
    scored: sortScoredCandidatesDesc(scored),
    detailRowCount: env.items.length,
  };
}

function assertBudget(b: RequestBudget): boolean {
  return b.used < b.max;
}

function spend(b: RequestBudget): void {
  b.used += 1;
}

type Row = PhotoGalleryCountRow & { title: string | null };

export async function matchFetchAndMergeForPoi(args: {
  client: JejuPhotoGalleryTourApiClient;
  row: Row;
  budget: RequestBudget;
  config: MatchFetchForPoiConfig;
}): Promise<MatchFetchForPoiResult> {
  const { client, row, budget, config } = args;
  const err: string[] = [];
  let requests = 0;
  let detailRowCount = 0;
  let searchListRowCount = 0;
  let candidateCountFetched = 0;
  let lowConfidenceRejected = false;
  let bestSearchScore: number | undefined;

  const targetPhotoCount = config.targetPhotoCount;
  const missingSlots = computeMissingGallerySlots(row, targetPhotoCount);
  const currentCount = countStoredGalleryPhotos(row);

  if (missingSlots <= 0) {
    return {
      lookupPath: 'skipped_complete',
      requestCount: 0,
      candidateCountFetched: 0,
      detailRowCount: 0,
      searchListRowCount: 0,
      selectedNewCount: 0,
      finalMergedCount: currentCount,
      mergeResult: null,
      confidenceSummary: `complete (${currentCount}/${targetPhotoCount})`,
      skipReason: 'already_complete',
      lowConfidenceRejected: false,
      errorMessages: [],
    };
  }

  const titleRaw = row.title?.trim();
  if (!titleRaw) {
    return {
      lookupPath: 'skipped_no_title',
      requestCount: 0,
      candidateCountFetched: 0,
      detailRowCount: 0,
      searchListRowCount: 0,
      selectedNewCount: 0,
      finalMergedCount: currentCount,
      mergeResult: null,
      confidenceSummary: 'no POI title',
      skipReason: 'no_title',
      lowConfidenceRejected: false,
      errorMessages: [],
    };
  }

  if (!assertBudget(budget)) {
    return {
      lookupPath: 'skipped_budget',
      requestCount: 0,
      candidateCountFetched: 0,
      detailRowCount: 0,
      searchListRowCount: 0,
      selectedNewCount: 0,
      finalMergedCount: currentCount,
      mergeResult: null,
      confidenceSummary: 'request budget exhausted before fetch',
      skipReason: 'budget',
      lowConfidenceRejected: false,
      errorMessages: [],
    };
  }

  const ctx = buildPoiContext(titleRaw);
  const titleConfidence = computePoiTitleConfidenceForDirectDetail(titleRaw);

  let workingRow: Row = row;
  let mergeResult: ReturnType<typeof mergeGallerySelection> | null = null;
  let lookupPath: LookupPathUsed = 'no_match';
  const accumulatedNew: JejuGalleryCandidate[] = [];

  const numOfRowsFor = (r: Row) =>
    Math.min(8, computeMissingGallerySlots(r, targetPhotoCount), targetPhotoCount);

  const mergeWith = (scored: ScoredCandidate[], newGroupTitle: string) =>
    mergeGallerySelection({
      existingPhotoGalleryJson: workingRow.photo_gallery_detail_json,
      newCandidatesOrdered: scored,
      targetPhotoCount,
      newGroupGalleryTitle: newGroupTitle,
    });

  const fetchDetailOnce = async (
    listTitle: string,
    galContentId: string | null,
    sourceQueried: string,
    groupHint: string,
    numOfRows: number,
  ): Promise<ScoredCandidate[]> => {
    if (!assertBudget(budget)) return [];
    spend(budget);
    requests += 1;
    let { text, httpStatus } = await client.galleryDetailList1({
      pageNo: 1,
      numOfRows,
      title: listTitle,
    });
    let r = detailEnvToScored(ctx, text, httpStatus, sourceQueried, groupHint, config.minDetailPhotoScore);
    if (
      galContentId &&
      r.scored.length === 0 &&
      (text.includes('INVALID_REQUEST_PARAMETER_ERROR') || (r.parseError?.includes('파라미터') ?? false))
    ) {
      if (!assertBudget(budget)) return [];
      spend(budget);
      requests += 1;
      const second = await client.galleryDetailList1({
        pageNo: 1,
        numOfRows,
        galContentId,
      });
      r = detailEnvToScored(
        ctx,
        second.text,
        second.httpStatus,
        sourceQueried,
        groupHint,
        config.minDetailPhotoScore,
      );
    }
    detailRowCount += r.detailRowCount;
    if (r.parseError) err.push(`detail(${listTitle.slice(0, 24)}…): ${r.parseError}`);
    candidateCountFetched += r.scored.length;
    return r.scored;
  };

  const runSearchPickBest = async (): Promise<{
    bestTitle: string;
    bestGalCid: string | null;
    bestScore: number;
  } | null> => {
    if (!assertBudget(budget)) return null;
    spend(budget);
    requests += 1;
    const { text, httpStatus } = await client.gallerySearchList1({
      keyword: titleRaw,
      pageNo: 1,
      numOfRows: config.searchNumOfRows,
    });
    const env = parseGenericItemsEnvelope(text, httpStatus);
    if (httpStatus === 401 || httpStatus === 403) {
      err.push(`search HTTP ${httpStatus}`);
      return null;
    }
    if (!env.ok) {
      err.push(env.parseError ?? env.resultMsg ?? 'search parse');
      return null;
    }
    searchListRowCount = env.items.length;
    let best: { bestTitle: string; bestGalCid: string | null; bestScore: number } | null = null;
    for (const it of env.items) {
      const rec = it as Record<string, unknown>;
      const meta = normalizeSearchListRowMeta(rec, titleRaw);
      const listTitle = meta.galleryTitle ?? pickGalleryListTitle(rec);
      if (!listTitle) continue;
      const sc = scoreSearchListGalleryTitle(ctx, listTitle);
      if (sc < config.minSearchListScore) continue;
      if (!best || sc > best.bestScore) {
        best = {
          bestTitle: listTitle,
          bestGalCid: meta.galContentId ?? pickGalContentId(rec),
          bestScore: sc,
        };
      }
    }
    if (!best) {
      lowConfidenceRejected = true;
      return null;
    }
    bestSearchScore = best.bestScore;
    return best;
  };

  try {
    const high = titleConfidence >= config.directDetailMinConfidence;

    if (high) {
      const n = numOfRowsFor(workingRow);
      const scored = await fetchDetailOnce(titleRaw, null, titleRaw, titleRaw, n);
      if (scored.length > 0) {
        mergeResult = mergeWith(scored, titleRaw);
        accumulatedNew.push(...mergeResult.selectedNewItems);
        workingRow = { ...workingRow, photo_gallery_detail_json: mergeResult.mergedGallery };
        lookupPath = 'direct_detail';
      }
    }

    if (computeMissingGallerySlots(workingRow, targetPhotoCount) > 0 && assertBudget(budget)) {
      const hit = await runSearchPickBest();
      if (hit) {
        const n = numOfRowsFor(workingRow);
        const scored = await fetchDetailOnce(hit.bestTitle, hit.bestGalCid, hit.bestTitle, hit.bestTitle, n);
        if (scored.length > 0) {
          const m2 = mergeWith(scored, hit.bestTitle);
          mergeResult = m2;
          accumulatedNew.push(...m2.selectedNewItems);
          workingRow = { ...workingRow, photo_gallery_detail_json: m2.mergedGallery };
          lookupPath = high ? 'direct_then_search' : 'search_then_detail';
        }
      }
    }

    if (accumulatedNew.length === 0) {
      lookupPath = 'no_match';
    }
  } catch (e) {
    err.push(e instanceof Error ? e.message : String(e));
    lookupPath = 'error';
  }

  const selectedNew = accumulatedNew.length;
  const finalMerged = mergeResult?.finalCount ?? currentCount;

  return {
    lookupPath,
    requestCount: requests,
    candidateCountFetched,
    detailRowCount,
    searchListRowCount,
    selectedNewCount: selectedNew,
    finalMergedCount: finalMerged,
    mergeResult: mergeResult
      ? {
          ...mergeResult,
          selectedNewItems: accumulatedNew,
        }
      : null,
    confidenceSummary: `titleConf=${titleConfidence.toFixed(2)} path=${lookupPath} bestSearch=${bestSearchScore?.toFixed(2) ?? 'n/a'}`,
    skipReason:
      lookupPath === 'no_match'
        ? lowConfidenceRejected
          ? 'low_confidence_search'
          : 'no_match'
        : undefined,
    lowConfidenceRejected,
    bestSearchScore,
    errorMessages: err,
  };
}
