/**
 * Batch import: Jeju curated POIs via KorService2 (Tour API).
 * Does not import app code; safe to run standalone.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TourApiClient, type TourApiRequestMeta } from './jeju-tourapi/api-client';
import type { CuratedPlaceInput, TourApiSearchItem } from './jeju-tourapi/types';
import { buildSearchVariants, normalizeKoreanPlaceName } from './jeju-tourapi/normalize';
import { parseItemsEnvelope } from './jeju-tourapi/parsers';
import {
  bonusFromIntroPreview,
  computeTieStats,
  mergeDetailCommonIntoItem,
  scoreSearchCandidate,
} from './jeju-tourapi/scoring';
import {
  buildExtractedIntroFields,
  isAmbiguousShort,
  parseIntroBody,
} from './jeju-tourapi/intro-extractors';

const BODY_PREVIEW_LEN = 1600;

type ApiFailureRow = {
  path: string;
  keyword?: string;
  contentId?: string;
  contentTypeId?: string;
  httpStatus: number;
  resultCode: string | null;
  resultMsg: string | null;
  parseError?: string;
  bodyPreview: string;
  /** Present when INVALID_REQUEST_PARAMETER_ERROR is detected (or body contains it). */
  requestParams?: Record<string, string>;
  requestUrlRedacted?: string;
};

function isInvalidRequestParameterError(
  resultMsg: string | null,
  resultCode: string | null,
  bodyPreviewText: string,
): boolean {
  const blob = `${resultMsg ?? ''} ${resultCode ?? ''} ${bodyPreviewText}`;
  return blob.includes('INVALID_REQUEST_PARAMETER_ERROR');
}

function enrichFailureWithRequestMeta(
  row: ApiFailureRow,
  meta: TourApiRequestMeta | undefined,
  bodyPreviewText: string,
): ApiFailureRow {
  if (!meta) return row;
  if (
    isInvalidRequestParameterError(row.resultMsg, row.resultCode, bodyPreviewText) ||
    bodyPreviewText.includes('INVALID_REQUEST_PARAMETER_ERROR')
  ) {
    return {
      ...row,
      requestParams: meta.params,
      requestUrlRedacted: meta.urlRedacted,
    };
  }
  return row;
}

function bodyPreview(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= BODY_PREVIEW_LEN ? t : `${t.slice(0, BODY_PREVIEW_LEN)}…`;
}

const SOURCE_API = 'KorService2';

/** Optional: set TOUR_API_JEJU_AREA_CODE=39 to restrict keyword search to Jeju (may return 0 rows on some keys). */
function jejuAreaCodeFromEnv(): number | undefined {
  const raw = process.env.TOUR_API_JEJU_AREA_CODE?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

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

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readInput(): CuratedPlaceInput[] {
  const inputPath = path.join(process.cwd(), 'data', 'jeju-curated-places.json');
  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('data/jeju-curated-places.json must be a JSON array');
  return parsed as CuratedPlaceInput[];
}

function strId(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

function dedupeKey(item: TourApiSearchItem): string {
  const id = strId(item.contentid) ?? '';
  const tid = strId(item.contenttypeid) ?? '';
  return `${id}::${tid}`;
}

type Scored = TourApiSearchItem & { score: number; reasons: string[] };

function collectSearchVariants(place: CuratedPlaceInput): string[] {
  const base = buildSearchVariants(place.sourceName);
  const extra = (place.aliases ?? []).flatMap((a) => buildSearchVariants(a));
  const out: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const q of [...base, ...extra]) push(q);
  return out;
}

type IntroSample = { contentTypeId: string; keys: string[] };

function buildOutputRow(args: {
  sourceName: string;
  item: TourApiSearchItem | null;
  extracted: ReturnType<typeof buildExtractedIntroFields>;
  introRawJson: string | null;
  score: number | null;
  matchReason: string[];
  status: 'matched' | 'review' | 'unmatched';
  reviewReason?: string[];
}): {
  sourceName: string;
  matchedTitle: string | null;
  contentId: string | null;
  contentTypeId: string | null;
  addr1: string | null;
  addr2: string | null;
  overview: string | null;
  firstImage: string | null;
  firstImage2: string | null;
  mapx: string | null;
  mapy: string | null;
  tel: string | null;
  homepage: string | null;
  openingHoursRaw: string | null;
  admissionFeeRaw: string | null;
  businessStatusNote: string | null;
  reservationInfo: string | null;
  parkingInfo: string | null;
  restDate: string | null;
  useTimeText: string | null;
  feeText: string | null;
  introRawJson: string | null;
  score: number | null;
  matchReason: string[];
  sourceApi: string;
  fetchedAt: string;
  status: 'matched' | 'review' | 'unmatched';
  reviewReason?: string[];
} {
  const it = args.item;
  const fetchedAt = new Date().toISOString();
  return {
    sourceName: args.sourceName,
    matchedTitle: it?.title ? String(it.title) : null,
    contentId: it?.contentid ? String(it.contentid) : null,
    contentTypeId: it?.contenttypeid ? String(it.contenttypeid) : null,
    addr1: it?.addr1 ? String(it.addr1) : null,
    addr2: it?.addr2 ? String(it.addr2) : null,
    overview: it?.overview ? String(it.overview) : null,
    firstImage: it?.firstimage ? String(it.firstimage) : null,
    firstImage2: it?.firstimage2 ? String(it.firstimage2) : null,
    mapx: it?.mapx ? String(it.mapx) : null,
    mapy: it?.mapy ? String(it.mapy) : null,
    tel: it?.tel ? String(it.tel) : null,
    homepage: it?.homepage ? String(it.homepage) : null,
    openingHoursRaw: args.extracted.openingHoursRaw,
    admissionFeeRaw: args.extracted.admissionFeeRaw,
    businessStatusNote: args.extracted.businessStatusNote,
    reservationInfo: args.extracted.reservationInfo,
    parkingInfo: args.extracted.parkingInfo,
    restDate: args.extracted.restDate,
    useTimeText: args.extracted.useTimeText,
    feeText: args.extracted.feeText,
    introRawJson: args.introRawJson,
    score: args.score,
    matchReason: args.matchReason,
    sourceApi: SOURCE_API,
    fetchedAt,
    status: args.status,
    reviewReason: args.reviewReason,
  };
}

async function main(): Promise<void> {
  loadEnvFiles();
  const serviceKey =
    process.env.TOUR_API_SERVICE_KEY?.trim() || process.env.TOUR_API_KEY?.trim() || '';
  if (!serviceKey) {
    console.error(
      'Missing TOUR_API_SERVICE_KEY (or TOUR_API_KEY). Set in .env.local / .env — see .env.example.',
    );
    process.exit(1);
  }

  let apiErrorCount = 0;
  const apiFailures: ApiFailureRow[] = [];
  let consoleFailurePrinted = 0;
  const maxConsoleFailures = 12;

  const recordApiFailure = (row: ApiFailureRow): void => {
    apiFailures.push(row);
    if (consoleFailurePrinted < maxConsoleFailures) {
      consoleFailurePrinted += 1;
      console.error('\n[TourAPI failure]', JSON.stringify(row, null, 2));
    }
  };

  const client = new TourApiClient({
    serviceKey,
    onApiError: () => {
      apiErrorCount += 1;
    },
  });

  const places = readInput();
  const jejuAreaCode = jejuAreaCodeFromEnv();
  const normalizedSourceMap = new Map<string, string>();
  for (const p of places) {
    normalizedSourceMap.set(p.sourceName, normalizeKoreanPlaceName(p.sourceName));
  }

  const matched: ReturnType<typeof buildOutputRow>[] = [];
  const review: ReturnType<typeof buildOutputRow>[] = [];
  const unmatched: ReturnType<typeof buildOutputRow>[] = [];
  const detailInfoSupplement: {
    sourceName: string;
    contentId: string;
    contentTypeId: string;
    detailInfoRawJson: string;
  }[] = [];

  const introSamples: IntroSample[] = [];

  for (const place of places) {
    const sourceName = place.sourceName;
    const normalizedSource = normalizedSourceMap.get(sourceName) ?? normalizeKoreanPlaceName(sourceName);
    const queries = collectSearchVariants(place);
    const merged = new Map<string, Scored>();

    try {
      for (const q of queries) {
        const { text, httpStatus, requestMeta } = await client.searchKeyword2({
          keyword: q,
          numOfRows: 50,
          pageNo: 1,
          ...(jejuAreaCode !== undefined ? { areaCode: jejuAreaCode } : {}),
        });
        const env = parseItemsEnvelope(text);
        const httpBad = httpStatus < 200 || httpStatus >= 300;
        if (httpBad || !env.ok) {
          client.emitError('/searchKeyword2', env.parseError ?? env.resultMsg ?? `HTTP ${httpStatus}`);
          recordApiFailure(
            enrichFailureWithRequestMeta(
              {
                path: '/searchKeyword2',
                keyword: q,
                httpStatus,
                resultCode: env.resultCode,
                resultMsg: env.resultMsg,
                parseError: env.parseError,
                bodyPreview: bodyPreview(text),
              },
              requestMeta,
              text,
            ),
          );
        }
        for (const item of env.items) {
          const key = dedupeKey(item);
          const { score, reasons } = scoreSearchCandidate({
            item,
            sourceName,
            normalizedSource,
          });
          const prev = merged.get(key);
          const mergedReasons = [...reasons, `search_query:${q}`];
          if (!prev || score > prev.score) {
            merged.set(key, { ...item, score, reasons: mergedReasons });
          }
        }
      }
    } catch (e) {
      client.emitError('/searchKeyword2', e instanceof Error ? e.message : String(e));
    }

    const candidates = [...merged.values()].sort((a, b) => b.score - a.score);
    const scores = candidates.map((c) => c.score);
    const tie = computeTieStats(scores);
    const top = candidates[0];

    if (!top || !top.contentid || !top.contenttypeid) {
      unmatched.push(
        buildOutputRow({
          sourceName,
          item: null,
          extracted: buildExtractedIntroFields(null),
          introRawJson: null,
          score: null,
          matchReason: [`no_candidates_after_queries:${queries.join('|')}`],
          status: 'unmatched',
        }),
      );
      continue;
    }

    const topScoreGroup = candidates.filter((c) => c.score === top.score);
    const lowScore = top.score < 40;

    let working: TourApiSearchItem = { ...top };
    const matchReason: string[] = [...top.reasons];

    /** detailCommon2 */
    try {
      const { text: dText, httpStatus: dHttp, requestMeta: dMeta } = await client.detailCommon2({
        contentId: String(top.contentid),
      });
      const dEnv = parseItemsEnvelope(dText);
      const dHttpBad = dHttp < 200 || dHttp >= 300;
      if (dHttpBad || !dEnv.ok) {
        client.emitError('/detailCommon2', dEnv.parseError ?? dEnv.resultMsg ?? `HTTP ${dHttp}`);
        recordApiFailure(
          enrichFailureWithRequestMeta(
            {
              path: '/detailCommon2',
              contentId: String(top.contentid),
              contentTypeId: String(top.contenttypeid),
              httpStatus: dHttp,
              resultCode: dEnv.resultCode,
              resultMsg: dEnv.resultMsg,
              parseError: dEnv.parseError,
              bodyPreview: bodyPreview(dText),
            },
            dMeta,
            dText,
          ),
        );
      }
      const detailItem = dEnv.items[0] as Record<string, unknown> | undefined;
      if (detailItem) {
        working = mergeDetailCommonIntoItem(working, detailItem);
        matchReason.push('detailCommon2:merged');
      }
    } catch (e) {
      client.emitError('/detailCommon2', e instanceof Error ? e.message : String(e));
    }

    /** detailIntro2 */
    let introRawJson: string | null = null;
    let extracted = buildExtractedIntroFields(null);
    try {
      const { text: iText, httpStatus: iHttp, requestMeta: iMeta } = await client.detailIntro2({
        contentId: String(top.contentid),
        contentTypeId: String(top.contenttypeid),
      });
      const iEnv = parseItemsEnvelope(iText);
      const iHttpBad = iHttp < 200 || iHttp >= 300;
      if (iHttpBad || !iEnv.ok) {
        client.emitError('/detailIntro2', iEnv.parseError ?? iEnv.resultMsg ?? `HTTP ${iHttp}`);
        recordApiFailure(
          enrichFailureWithRequestMeta(
            {
              path: '/detailIntro2',
              contentId: String(top.contentid),
              contentTypeId: String(top.contenttypeid),
              httpStatus: iHttp,
              resultCode: iEnv.resultCode,
              resultMsg: iEnv.resultMsg,
              parseError: iEnv.parseError,
              bodyPreview: bodyPreview(iText),
            },
            iMeta,
            iText,
          ),
        );
      }
      const parsed = parseIntroBody(iText);
      if (parsed.intro) {
        introRawJson = JSON.stringify(parsed.intro);
        extracted = buildExtractedIntroFields(parsed.intro);
        if (introSamples.length < 10) {
          introSamples.push({
            contentTypeId: String(top.contenttypeid),
            keys: Object.keys(parsed.intro as Record<string, unknown>).sort(),
          });
        }
      } else if (parsed.error) {
        matchReason.push(`detailIntro2_parse:${parsed.error}`);
      }
    } catch (e) {
      client.emitError('/detailIntro2', e instanceof Error ? e.message : String(e));
    }

    /** detailInfo2 (optional merge into sidecar JSON) */
    let detailInfoRawJson: string | null = null;
    try {
      const { text: diText, httpStatus: diHttp, requestMeta: diMeta } = await client.detailInfo2({
        contentId: String(top.contentid),
        contentTypeId: String(top.contenttypeid),
      });
      const diEnv = parseItemsEnvelope(diText);
      const diHttpBad = diHttp < 200 || diHttp >= 300;
      if (diHttpBad || !diEnv.ok) {
        client.emitError('/detailInfo2', diEnv.parseError ?? diEnv.resultMsg ?? `HTTP ${diHttp}`);
        recordApiFailure(
          enrichFailureWithRequestMeta(
            {
              path: '/detailInfo2',
              contentId: String(top.contentid),
              contentTypeId: String(top.contenttypeid),
              httpStatus: diHttp,
              resultCode: diEnv.resultCode,
              resultMsg: diEnv.resultMsg,
              parseError: diEnv.parseError,
              bodyPreview: bodyPreview(diText),
            },
            diMeta,
            diText,
          ),
        );
      }
      if (diEnv.items.length) {
        detailInfoRawJson = JSON.stringify(diEnv.items);
        matchReason.push('detailInfo2:attached');
        detailInfoSupplement.push({
          sourceName,
          contentId: String(top.contentid),
          contentTypeId: String(top.contenttypeid),
          detailInfoRawJson,
        });
      }
    } catch (e) {
      client.emitError('/detailInfo2', e instanceof Error ? e.message : String(e));
    }

    const bonus = bonusFromIntroPreview({
      hasUseTime: Boolean(extracted.useTimeText),
      hasFee: Boolean(extracted.feeText),
    });
    const finalScore = top.score + bonus.add;
    matchReason.push(...bonus.reasons);
    matchReason.push(
      `openingHoursRaw_fields:${extracted.openingHoursSourceFields.join(',')}`,
      `admissionFeeRaw_fields:${extracted.admissionFeeSourceFields.join(',')}`,
    );

    const reviewReason: string[] = [];
    if (topScoreGroup.length > 1) reviewReason.push('multiple_candidates_same_top_score');
    if (
      candidates.length >= 2 &&
      tie.secondScore > 0 &&
      top.score - tie.secondScore < 5
    ) {
      reviewReason.push('top2_scores_within_5');
    }
    if (lowScore) reviewReason.push('low_search_score');
    if (!extracted.useTimeText) reviewReason.push('missing_useTimeText');
    if (!extracted.feeText) reviewReason.push('missing_feeText');
    if (isAmbiguousShort(extracted.useTimeText, 'time')) reviewReason.push('ambiguous_useTimeText');
    if (isAmbiguousShort(extracted.feeText, 'fee')) reviewReason.push('ambiguous_feeText');

    const needsReview = reviewReason.length > 0;

    const row = buildOutputRow({
      sourceName,
      item: working,
      extracted,
      introRawJson,
      score: finalScore,
      matchReason,
      status: needsReview ? 'review' : 'matched',
      reviewReason: needsReview ? reviewReason : undefined,
    });

    if (needsReview) {
      review.push(row);
    } else {
      matched.push(row);
    }
  }

  const outDir = path.join(process.cwd(), 'data', 'output');
  ensureDir(outDir);

  const strip = (rows: ReturnType<typeof buildOutputRow>[]) =>
    rows.map(({ status: _s, reviewReason, ...rest }) => ({
      ...rest,
      ...(reviewReason ? { reviewReason } : {}),
    }));

  fs.writeFileSync(
    path.join(outDir, 'jeju-matched.json'),
    JSON.stringify(strip(matched), null, 2),
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'jeju-review.json'),
    JSON.stringify(strip(review), null, 2),
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'jeju-unmatched.json'),
    JSON.stringify(strip(unmatched), null, 2),
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'jeju-detail-info-supplement.json'),
    JSON.stringify(detailInfoSupplement, null, 2),
    'utf8',
  );

  const errPath = path.join(outDir, 'jeju-import-api-errors.json');
  fs.writeFileSync(errPath, JSON.stringify(apiFailures, null, 2), 'utf8');

  const total = places.length;
  console.log('\n=== Jeju Tour API import summary ===');
  console.log(`total: ${total}`);
  console.log(`matched: ${matched.length}`);
  console.log(`review: ${review.length}`);
  console.log(`unmatched: ${unmatched.length}`);
  console.log(`API error count (logged): ${apiErrorCount}`);
  console.log(
    `API failure details: ${apiFailures.length} row(s) → ${path.relative(process.cwd(), errPath)}`,
  );
  if (apiFailures.length > maxConsoleFailures) {
    console.log(
      `(Only first ${maxConsoleFailures} failures printed above; see JSON file for full list.)`,
    );
  }
  console.log('\n--- detailIntro2 sample (up to 10): field keys by contentTypeId ---');
  introSamples.forEach((s, i) => {
    console.log(`[${i + 1}] contentTypeId=${s.contentTypeId}`);
    console.log(`    keys (${s.keys.length}): ${s.keys.join(', ')}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
