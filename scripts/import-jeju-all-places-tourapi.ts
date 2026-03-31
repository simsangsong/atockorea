/**
 * KorService2 areaBasedList2 → 제주 관광지 전체 수집 → detailCommon2 + detailIntro2 (+ detailInfo2)
 * 결과: data/output/jeju-all-places.json + (옵션) Supabase jeju_kor_tourapi_places
 *
 * npm run import:jeju:all:tourapi
 */

import * as fs from 'fs';
import * as path from 'path';
import { TourApiClient } from './jeju-tourapi/api-client';
import type { TourApiSearchItem } from './jeju-tourapi/types';
import { normalizeItemList, parseItemsEnvelope } from './jeju-tourapi/parsers';
import { mergeDetailCommonIntoItem } from './jeju-tourapi/scoring';
import { buildExtractedIntroFields, parseIntroBody } from './jeju-tourapi/intro-extractors';
import { buildFieldProvenance, mergeDetailInfoTextHints } from './jeju-tourapi/normalizers';
import type { JejuPlaceUpsertRow } from './jeju-tourapi/supabase-upsert';
import { upsertJejuPlaces } from './jeju-tourapi/supabase-upsert';

const SOURCE_API = 'KorService2';
const BODY_PREVIEW_LEN = 1200;
const DEFAULT_LDONG_REGN_CD = 50;
const DEFAULT_CONTENT_TYPE_ID = 12;
const DEFAULT_NUM_OF_ROWS = 100;
const DEFAULT_ARRANGE = 'B';

export type JejuAllPlaceRecord = {
  contentId: string;
  contentTypeId: number;
  title: string | null;
  addr1: string | null;
  addr2: string | null;
  overview: string | null;
  firstImage: string | null;
  firstImage2: string | null;
  mapx: string | null;
  mapy: string | null;
  tel: string | null;
  homepage: string | null;
  readcount: number | null;
  listRank: number | null;
  openingHoursRaw: string | null;
  admissionFeeRaw: string | null;
  businessStatusNote: string | null;
  reservationInfo: string | null;
  parkingInfo: string | null;
  restDate: string | null;
  useTimeText: string | null;
  feeText: string | null;
  introRawJson: Record<string, unknown> | null;
  detailInfoRawJson: Record<string, unknown> | null;
  sourceApi: string;
  fetchedAt: string;
  syncBatchId: string;
  /** 추적용: 어떤 intro 필드에서 왔는지 */
  fieldProvenanceJson: Record<string, unknown> | null;
};

type JsonOutput = {
  meta: {
    syncBatchId: string;
    fetchedAt: string;
    totalCountFromApi: number | null;
    totalPages: number | null;
    numOfRows: number;
    sourceApi: string;
    contentTypeId: number;
    arrange: string;
    filter: Record<string, unknown>;
  };
  places: JejuAllPlaceRecord[];
};

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

function bodyPreview(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= BODY_PREVIEW_LEN ? t : `${t.slice(0, BODY_PREVIEW_LEN)}…`;
}

function dedupeKey(item: TourApiSearchItem): string {
  const id = item.contentid != null ? String(item.contentid) : '';
  const tid = item.contenttypeid != null ? String(item.contenttypeid) : '';
  return `${id}::${tid}`;
}

function parseReadCount(item: TourApiSearchItem): number | null {
  const raw =
    (item as Record<string, unknown>)['readcount'] ??
    (item as Record<string, unknown>)['readcnt'] ??
    (item as Record<string, unknown>)['ReadCnt'];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseCoord(s: string | null | undefined): number | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function randomBatchId(): string {
  return `jeju-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** p-limit style concurrency */
function createPLimit(concurrency: number) {
  let running = 0;
  type Task = { fn: () => Promise<void> };
  const queue: Task[] = [];

  const runNext = (): void => {
    if (running >= concurrency || queue.length === 0) return;
    running++;
    const { fn } = queue.shift()!;
    void Promise.resolve()
      .then(fn)
      .finally(() => {
        running--;
        runNext();
      });
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({
        fn: async () => {
          try {
            const v = await fn();
            resolve(v);
          } catch (e) {
            reject(e);
          }
        },
      });
      runNext();
    });
  };
}

function loadCheckpoint(cpPath: string): Set<string> {
  const done = new Set<string>();
  if (!fs.existsSync(cpPath)) return done;
  try {
    const j = JSON.parse(fs.readFileSync(cpPath, 'utf8')) as { completed?: string[] };
    for (const k of j.completed ?? []) done.add(String(k));
  } catch {
    /* ignore */
  }
  return done;
}

function saveCheckpoint(cpPath: string, completed: Set<string>, syncBatchId: string): void {
  const dir = path.dirname(cpPath);
  ensureDir(dir);
  fs.writeFileSync(
    cpPath,
    JSON.stringify({ completed: [...completed], syncBatchId, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

function loadPlacesMapFromOutputJson(outPath: string): Map<string, JejuAllPlaceRecord> {
  const m = new Map<string, JejuAllPlaceRecord>();
  if (!fs.existsSync(outPath)) return m;
  try {
    const j = JSON.parse(fs.readFileSync(outPath, 'utf8')) as JsonOutput;
    for (const p of j.places ?? []) {
      m.set(`${p.contentId}::${p.contentTypeId}`, p);
    }
  } catch {
    /* ignore */
  }
  return m;
}

async function fetchAreaPageWithRetry(
  client: TourApiClient,
  args: Parameters<TourApiClient['areaBasedList2']>[0],
  stats: { apiErrors: number },
): Promise<{ text: string; httpStatus: number }> {
  try {
    const r = await client.areaBasedList2(args);
    if (r.httpStatus < 200 || r.httpStatus >= 300) stats.apiErrors += 1;
    return r;
  } catch {
    stats.apiErrors += 1;
    throw new Error('areaBasedList2 failed after retries');
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const t0 = Date.now();
  const serviceKey =
    process.env.TOUR_API_SERVICE_KEY?.trim() || process.env.TOUR_API_KEY?.trim() || '';
  if (!serviceKey) {
    console.error('Missing TOUR_API_SERVICE_KEY (or TOUR_API_KEY).');
    process.exit(1);
  }

  const syncBatchId = process.env.JEJU_SYNC_BATCH_ID?.trim() || randomBatchId();
  const arrange = (process.env.TOUR_API_ARRANGE || DEFAULT_ARRANGE).trim().slice(0, 1).toUpperCase();
  const contentTypeId = parseInt(
    process.env.JEJU_CONTENT_TYPE_ID || String(DEFAULT_CONTENT_TYPE_ID),
    10,
  );
  const numOfRows = Math.min(
    1000,
    Math.max(1, parseInt(process.env.JEJU_NUM_OF_ROWS || String(DEFAULT_NUM_OF_ROWS), 10) || DEFAULT_NUM_OF_ROWS),
  );
  const useAreaCode = (process.env.TOUR_API_USE_AREA_CODE || '0').trim() === '1';
  const areaCode = parseInt(process.env.TOUR_API_AREA_CODE || '39', 10);
  const lDongRegnCd = parseInt(process.env.JEJU_LDONG_REGN_CD || String(DEFAULT_LDONG_REGN_CD), 10);
  const lDongSignguRaw = process.env.JEJU_LDONG_SIGNGU_CD?.trim();
  const lDongSignguCd =
    lDongSignguRaw && /^\d+$/.test(lDongSignguRaw) ? parseInt(lDongSignguRaw, 10) : undefined;

  const skipDetailInfo2 = (process.env.JEJU_SKIP_DETAIL_INFO2 || '1').trim() === '1';
  const upsertSupabase = (process.env.JEJU_UPSERT_SUPABASE || '0').trim() === '1';
  const requestDelayMs = Math.max(0, parseInt(process.env.TOUR_API_REQUEST_DELAY_MS || '120', 10) || 120);
  const requestTimeoutMs = Math.max(5000, parseInt(process.env.TOUR_API_REQUEST_TIMEOUT_MS || '60000', 10) || 60000);
  const maxRetries = Math.max(0, parseInt(process.env.TOUR_API_MAX_RETRIES || '5', 10) || 5);
  const detailConcurrency = Math.min(
    20,
    Math.max(1, parseInt(process.env.JEJU_DETAIL_CONCURRENCY || '3', 10) || 3),
  );
  const resumeFromJson = (process.env.JEJU_RESUME_FROM_JSON || '0').trim() === '1';
  const checkpointEvery = Math.max(1, parseInt(process.env.JEJU_CHECKPOINT_EVERY || '25', 10) || 25);

  const outDir = path.join(process.cwd(), 'data', 'output');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'jeju-all-places.json');
  const cpPath = path.join(outDir, 'jeju-import.checkpoint.json');

  const placesByKey = loadPlacesMapFromOutputJson(outPath);
  const completedKeys = new Set<string>([...loadCheckpoint(cpPath)]);
  if (resumeFromJson) {
    console.log(`[resume] resumeFromJson=true: ${placesByKey.size} rows loaded from JSON (skipped)`);
  } else if (completedKeys.size) {
    console.log(`[resume] checkpoint: ${completedKeys.size} keys`);
  }

  const stats = {
    apiErrors: 0,
    detailCommonOk: 0,
    detailCommonFail: 0,
    detailIntroOk: 0,
    detailIntroFail: 0,
    detailInfoOk: 0,
    detailInfoFail: 0,
    detailSkipped: 0,
  };

  const client = new TourApiClient({
    serviceKey,
    requestDelayMs,
    requestTimeoutMs,
    maxRetries,
    onApiError: () => {
      stats.apiErrors += 1;
    },
  });

  /** --- 1) 목록 전체 --- */
  const listArgsBase = useAreaCode
    ? {
        numOfRows,
        arrange,
        contentTypeId,
        areaCode,
        ...(lDongSignguCd !== undefined ? { sigunguCode: lDongSignguCd } : {}),
      }
    : {
        numOfRows,
        arrange,
        contentTypeId,
        lDongRegnCd,
        ...(lDongSignguCd !== undefined ? { lDongSignguCd } : {}),
      };

  const first = await fetchAreaPageWithRetry(client, { pageNo: 1, ...listArgsBase }, stats);
  const env1 = parseItemsEnvelope(first.text);
  if (!env1.ok || first.httpStatus < 200 || first.httpStatus >= 300) {
    console.error('[areaBasedList2] first page failed', {
      httpStatus: first.httpStatus,
      resultCode: env1.resultCode,
      resultMsg: env1.resultMsg,
      bodyPreview: bodyPreview(first.text),
    });
    process.exit(1);
  }

  const totalCount = env1.totalCount ?? null;
  if (totalCount === null) {
    console.error('[areaBasedList2] totalCount missing in response');
    process.exit(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / numOfRows));
  console.log(`[areaBasedList2] totalCount=${totalCount} numOfRows=${numOfRows} totalPages=${totalPages}`);

  const ordered: TourApiSearchItem[] = [];
  const seen = new Set<string>();

  const pushItems = (items: TourApiSearchItem[]) => {
    for (const it of items) {
      const k = dedupeKey(it);
      if (!it.contentid || !it.contenttypeid) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      ordered.push(it);
    }
  };

  pushItems(env1.items);

  for (let pageNo = 2; pageNo <= totalPages; pageNo++) {
    const { text, httpStatus } = await fetchAreaPageWithRetry(
      client,
      { pageNo, ...listArgsBase },
      stats,
    );
    const env = parseItemsEnvelope(text);
    if (httpStatus < 200 || httpStatus >= 300 || !env.ok) {
      console.error(`[areaBasedList2] page ${pageNo} failed`, {
        httpStatus,
        resultCode: env.resultCode,
        resultMsg: env.resultMsg,
        bodyPreview: bodyPreview(text),
      });
      stats.apiErrors += 1;
      continue;
    }
    pushItems(env.items);
  }

  const rawItemsCollected = ordered.length;
  console.log(`[areaBasedList2] unique places=${rawItemsCollected} (deduped)`);

  /** listRank: 목록 순서 */
  const listRankByKey = new Map<string, number>();
  ordered.forEach((it, i) => {
    listRankByKey.set(dedupeKey(it), i + 1);
  });

  const limit = createPLimit(detailConcurrency);
  let detailFetchedThisRun = 0;

  for (const top of ordered) {
    const key = dedupeKey(top);

    if (placesByKey.has(key) && (resumeFromJson || completedKeys.has(key))) {
      stats.detailSkipped += 1;
      continue;
    }

    await limit(async () => {
      const contentId = String(top.contentid);
      const contentTypeIdNum = parseInt(String(top.contenttypeid), 10);
      const readCount = parseReadCount(top);
      const listRank = listRankByKey.get(key) ?? null;

      let working: TourApiSearchItem = { ...top };

      /** detailCommon2 */
      try {
        const { text: dText, httpStatus: dHttp } = await client.detailCommon2({ contentId });
        const dEnv = parseItemsEnvelope(dText);
        if (dHttp >= 200 && dHttp < 300 && dEnv.ok && dEnv.items.length) {
          const detailItem = dEnv.items[0] as Record<string, unknown>;
          working = mergeDetailCommonIntoItem(working, detailItem);
          stats.detailCommonOk += 1;
        } else {
          stats.detailCommonFail += 1;
        }
      } catch {
        stats.detailCommonFail += 1;
      }

      /** detailIntro2 */
      let introObj: Record<string, unknown> | null = null;
      try {
        const { text: iText, httpStatus: iHttp } = await client.detailIntro2({
          contentId,
          contentTypeId: String(top.contenttypeid),
        });
        const iEnv = parseItemsEnvelope(iText);
        if (iHttp >= 200 && iHttp < 300 && iEnv.ok) {
          const parsed = parseIntroBody(iText);
          if (parsed.intro && typeof parsed.intro === 'object') {
            introObj = parsed.intro as Record<string, unknown>;
            stats.detailIntroOk += 1;
          } else {
            stats.detailIntroFail += 1;
          }
        } else {
          stats.detailIntroFail += 1;
        }
      } catch {
        stats.detailIntroFail += 1;
      }

      const extracted = buildExtractedIntroFields(introObj);
      let prov = buildFieldProvenance(extracted);

      /** detailInfo2 */
      let detailInfoPayload: Record<string, unknown> | null = null;
      if (!skipDetailInfo2) {
        try {
          const { text: diText, httpStatus: diHttp } = await client.detailInfo2({
            contentId,
            contentTypeId: String(top.contenttypeid),
          });
          const diEnv = parseItemsEnvelope(diText);
          if (diHttp >= 200 && diHttp < 300 && diEnv.ok) {
            const items = normalizeItemList<Record<string, unknown>>(diEnv.items as unknown[]);
            detailInfoPayload = { items };
            prov = mergeDetailInfoTextHints(items, prov);
            stats.detailInfoOk += 1;
          } else {
            stats.detailInfoFail += 1;
          }
        } catch {
          stats.detailInfoFail += 1;
        }
      }

      const fetchedAt = new Date().toISOString();
      const title =
        working.title != null ? String(working.title) : top.title != null ? String(top.title) : null;

      const rec: JejuAllPlaceRecord = {
        contentId,
        contentTypeId: Number.isFinite(contentTypeIdNum) ? contentTypeIdNum : contentTypeId,
        title,
        addr1: working.addr1 != null ? String(working.addr1) : null,
        addr2: working.addr2 != null ? String(working.addr2) : null,
        overview: working.overview != null ? String(working.overview) : null,
        firstImage: working.firstimage != null ? String(working.firstimage) : null,
        firstImage2: working.firstimage2 != null ? String(working.firstimage2) : null,
        mapx: working.mapx != null ? String(working.mapx) : null,
        mapy: working.mapy != null ? String(working.mapy) : null,
        tel: working.tel != null ? String(working.tel) : null,
        homepage: working.homepage != null ? String(working.homepage) : null,
        readcount: readCount,
        listRank,
        openingHoursRaw: prov.openingHoursRaw,
        admissionFeeRaw: prov.admissionFeeRaw,
        businessStatusNote: extracted.businessStatusNote,
        reservationInfo: extracted.reservationInfo,
        parkingInfo: extracted.parkingInfo,
        restDate: extracted.restDate,
        useTimeText: prov.useTimeText,
        feeText: prov.feeText,
        introRawJson: introObj,
        detailInfoRawJson: detailInfoPayload,
        sourceApi: SOURCE_API,
        fetchedAt,
        syncBatchId,
        fieldProvenanceJson: {
          useTimeSourceFieldNames: prov.useTimeSourceFieldNames,
          feeSourceFieldNames: prov.feeSourceFieldNames,
          openingHoursRawSourceFieldNames: prov.openingHoursRawSourceFieldNames,
          admissionFeeRawSourceFieldNames: prov.admissionFeeRawSourceFieldNames,
          restDateSourceFields: extracted.restDateSourceFields,
          parkingSourceFields: extracted.parkingSourceFields,
          reservationSourceFields: extracted.reservationSourceFields,
          businessStatusSourceFields: extracted.businessStatusSourceFields,
        },
      };

      placesByKey.set(key, rec);
      completedKeys.add(key);
      detailFetchedThisRun += 1;
      if (detailFetchedThisRun % checkpointEvery === 0) {
        saveCheckpoint(cpPath, completedKeys, syncBatchId);
      }
    });
  }

  /** 목록 순서 기준 listRank 재동기화 */
  for (const top of ordered) {
    const key = dedupeKey(top);
    const lr = listRankByKey.get(key) ?? null;
    const existing = placesByKey.get(key);
    if (existing) {
      placesByKey.set(key, { ...existing, listRank: lr });
    }
  }

  const mergedPlaces = [...placesByKey.values()].sort(
    (a, b) => (a.listRank ?? 0) - (b.listRank ?? 0),
  );

  const output: JsonOutput = {
    meta: {
      syncBatchId,
      fetchedAt: new Date().toISOString(),
      totalCountFromApi: totalCount,
      totalPages,
      numOfRows,
      sourceApi: SOURCE_API,
      contentTypeId,
      arrange,
      filter: useAreaCode
        ? { mode: 'areaCode', areaCode, lDongSignguCd: lDongSignguCd ?? null }
        : { mode: 'lDongRegnCd', lDongRegnCd, lDongSignguCd: lDongSignguCd ?? null },
    },
    places: mergedPlaces,
  };

  /** 검증 로그 */
  const missingTitle = mergedPlaces.filter((p) => !p.title?.trim()).length;
  const idDupCheck = new Set(mergedPlaces.map((p) => `${p.contentId}::${p.contentTypeId}`));
  console.log(`[validate] places=${mergedPlaces.length} missingTitle=${missingTitle} uniqueKeys=${idDupCheck.size}`);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  saveCheckpoint(cpPath, completedKeys, syncBatchId);
  console.log(`[json] saved → ${path.relative(process.cwd(), outPath)}`);

  let upsertSummary: { successRows: number; failedRows: number } | null = null;
  if (upsertSupabase) {
    const rows: JejuPlaceUpsertRow[] = mergedPlaces.map((r) => ({
      content_id: r.contentId,
      content_type_id: r.contentTypeId,
      title: r.title,
      addr1: r.addr1,
      addr2: r.addr2,
      overview: r.overview,
      first_image: r.firstImage,
      first_image2: r.firstImage2,
      mapx: parseCoord(r.mapx),
      mapy: parseCoord(r.mapy),
      tel: r.tel,
      homepage: r.homepage,
      readcount: r.readcount,
      list_rank: r.listRank,
      opening_hours_raw: r.openingHoursRaw,
      admission_fee_raw: r.admissionFeeRaw,
      business_status_note: r.businessStatusNote,
      reservation_info: r.reservationInfo,
      parking_info: r.parkingInfo,
      rest_date: r.restDate,
      use_time_text: r.useTimeText,
      fee_text: r.feeText,
      intro_raw_json: r.introRawJson,
      detail_info_raw_json: r.detailInfoRawJson,
      source_api: r.sourceApi,
      fetched_at: r.fetchedAt,
      sync_batch_id: r.syncBatchId,
    }));
    upsertSummary = await upsertJejuPlaces(rows);
  }

  const elapsedMs = Date.now() - t0;
  console.log('\n=== Summary ===');
  console.log(`totalCount (API): ${totalCount}`);
  console.log(`totalPages: ${totalPages}`);
  console.log(`raw items (unique): ${rawItemsCollected}`);
  console.log(`places in output: ${mergedPlaces.length}`);
  console.log(`detailCommon2 ok/fail: ${stats.detailCommonOk}/${stats.detailCommonFail}`);
  console.log(`detailIntro2 ok/fail: ${stats.detailIntroOk}/${stats.detailIntroFail}`);
  if (skipDetailInfo2) {
    console.log(`detailInfo2: skipped (JEJU_SKIP_DETAIL_INFO2=1)`);
  } else {
    console.log(`detailInfo2 ok/fail: ${stats.detailInfoOk}/${stats.detailInfoFail}`);
  }
  console.log(`detail resume skips (already in JSON/checkpoint): ${stats.detailSkipped}`);
  console.log(`JSON path: ${outPath}`);
  if (upsertSummary) {
    console.log(`Supabase upsert success/failed rows: ${upsertSummary.successRows}/${upsertSummary.failedRows}`);
  }
  console.log(`API error count (approx): ${stats.apiErrors}`);
  console.log(`elapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
