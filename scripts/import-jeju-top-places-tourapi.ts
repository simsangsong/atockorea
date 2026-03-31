/**
 * KorService2 areaBasedList2 → 제주 관광지 상위 N건 → detailCommon2 + detailIntro2 (+ detailInfo2 보조)
 * 결과: data/output/jeju-top-places.json + (옵션) Supabase jeju_kor_tourapi_places upsert
 *
 * 정렬 arrange 기본 B(조회순·인기). C=수정일순 등은 TOUR_API_ARRANGE 로 변경.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TourApiClient, type TourApiRequestMeta } from './jeju-tourapi/api-client';
import type { TourApiSearchItem } from './jeju-tourapi/types';
import { parseItemsEnvelope } from './jeju-tourapi/parsers';
import { bonusFromIntroPreview, mergeDetailCommonIntoItem } from './jeju-tourapi/scoring';
import { buildExtractedIntroFields, parseIntroBody } from './jeju-tourapi/intro-extractors';

const SOURCE_API = 'KorService2';
const BODY_PREVIEW_LEN = 1600;

/** 제주 areaCode 39 → 법정동 시도코드 (data_pipeline.py AREA_TO_LDONG_REGION) */
const DEFAULT_LDONG_REGN_CD_JEJU = 50;
/** KorService2 관광지 contentTypeId (공공데이터 구분 12) */
const DEFAULT_CONTENT_TYPE_ATTRACTION = 12;

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

type OutputRow = {
  listRank: number | null;
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
};

function buildOutputRow(args: {
  listRank: number | null;
  sourceName: string;
  item: TourApiSearchItem | null;
  extracted: ReturnType<typeof buildExtractedIntroFields>;
  introRawJson: string | null;
  score: number | null;
  matchReason: string[];
}): OutputRow {
  const it = args.item;
  const fetchedAt = new Date().toISOString();
  return {
    listRank: args.listRank,
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

  const targetLimit = Math.min(
    500,
    Math.max(1, parseInt(process.env.JEJU_TOP_LIMIT || '200', 10) || 200),
  );
  const arrange = (process.env.TOUR_API_ARRANGE || 'B').trim().slice(0, 1).toUpperCase();
  const contentTypeId = parseInt(process.env.TOUR_API_CONTENT_TYPE_ID || String(DEFAULT_CONTENT_TYPE_ATTRACTION), 10);
  const useLegacyAreaCode = (process.env.TOUR_API_USE_AREA_CODE || '').trim() === '1';
  const lDongRegnCd = parseInt(
    process.env.JEJU_LDONG_REGN_CD || String(DEFAULT_LDONG_REGN_CD_JEJU),
    10,
  );
  const lDongSignguRaw = process.env.JEJU_LDONG_SIGNGU_CD?.trim();
  const lDongSignguCd =
    lDongSignguRaw && /^\d+$/.test(lDongSignguRaw) ? parseInt(lDongSignguRaw, 10) : undefined;
  const upsertSupabase = (process.env.JEJU_TOP_UPSERT_SUPABASE || '').trim() === '1';
  const skipDetailInfo2 = (process.env.JEJU_TOP_SKIP_DETAIL_INFO2 || '').trim() === '1';
  const requestDelayMs = Math.max(
    0,
    parseInt(process.env.TOUR_API_REQUEST_DELAY_MS || '120', 10) || 120,
  );

  const client = new TourApiClient({ serviceKey, requestDelayMs });

  const collected: TourApiSearchItem[] = [];
  const seen = new Set<string>();
  let pageNo = 1;
  let totalCount: number | undefined;
  const maxPage = 20;

  while (collected.length < targetLimit && pageNo <= maxPage) {
    const { text, httpStatus, requestMeta } = useLegacyAreaCode
      ? await client.areaBasedList2({
          pageNo,
          numOfRows: 100,
          arrange,
          contentTypeId,
          areaCode: 39,
        })
      : await client.areaBasedList2({
          pageNo,
          numOfRows: 100,
          arrange,
          contentTypeId,
          lDongRegnCd,
          ...(lDongSignguCd !== undefined ? { lDongSignguCd } : {}),
        });

    const env = parseItemsEnvelope(text);
    if (httpStatus < 200 || httpStatus >= 300 || !env.ok) {
      console.error('[areaBasedList2] failed', {
        pageNo,
        httpStatus,
        resultCode: env.resultCode,
        resultMsg: env.resultMsg,
        requestMeta,
        bodyPreview: bodyPreview(text),
      });
      break;
    }
    if (pageNo === 1 && env.totalCount !== undefined) {
      totalCount = env.totalCount;
    }
    for (const item of env.items) {
      const k = dedupeKey(item);
      if (!item.contentid || !item.contenttypeid) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      collected.push(item);
      if (collected.length >= targetLimit) break;
    }
    if (env.items.length < 100) break;
    pageNo += 1;
  }

  console.log(
    `[areaBasedList2] collected ${collected.length} items (target ${targetLimit}, totalCount≈${totalCount ?? '?'}) arrange=${arrange} contentTypeId=${contentTypeId}`,
  );

  const rows: OutputRow[] = [];
  let idx = 0;

  for (const top of collected) {
    idx += 1;
    const sourceName = typeof top.title === 'string' ? top.title : `contentid:${top.contentid}`;
    const listRank = idx;
    const readCount = parseReadCount(top);
    const baseMatchReason = [
      `areaBasedList2:lDongRegnCd=${useLegacyAreaCode ? 'areaCode39' : lDongRegnCd}`,
      `arrange:${arrange}`,
      `contentTypeId:${contentTypeId}`,
      `list_rank:${listRank}`,
      readCount != null ? `readcount:${readCount}` : 'readcount:unknown',
    ];

    let working: TourApiSearchItem = { ...top };
    const matchReason: string[] = [...baseMatchReason];

    /** detailCommon2 */
    try {
      const { text: dText, httpStatus: dHttp } = await client.detailCommon2({
        contentId: String(top.contentid),
      });
      const dEnv = parseItemsEnvelope(dText);
      if (dHttp >= 200 && dHttp < 300 && dEnv.ok) {
        const detailItem = dEnv.items[0] as Record<string, unknown> | undefined;
        if (detailItem) {
          working = mergeDetailCommonIntoItem(working, detailItem);
          matchReason.push('detailCommon2:merged');
        }
      }
    } catch {
      /* keep list fields */
    }

    /** detailIntro2 */
    let introRawJson: string | null = null;
    let extracted = buildExtractedIntroFields(null);
    try {
      const { text: iText, httpStatus: iHttp } = await client.detailIntro2({
        contentId: String(top.contentid),
        contentTypeId: String(top.contenttypeid),
      });
      const iEnv = parseItemsEnvelope(iText);
      if (iHttp >= 200 && iHttp < 300 && iEnv.ok) {
        const parsed = parseIntroBody(iText);
        if (parsed.intro) {
          introRawJson = JSON.stringify(parsed.intro);
          extracted = buildExtractedIntroFields(parsed.intro);
        }
      }
    } catch {
      /* empty intro */
    }

    /** detailInfo2 — 선택(일일 호출 한도 절약 시 JEJU_TOP_SKIP_DETAIL_INFO2=1) */
    if (!skipDetailInfo2) {
      try {
        const { text: diText, httpStatus: diHttp } = await client.detailInfo2({
          contentId: String(top.contentid),
          contentTypeId: String(top.contenttypeid),
        });
        const diEnv = parseItemsEnvelope(diText);
        if (diHttp >= 200 && diHttp < 300 && diEnv.ok && diEnv.items.length) {
          matchReason.push('detailInfo2:ok');
        }
      } catch {
        /* optional */
      }
    } else {
      matchReason.push('detailInfo2:skipped');
    }

    const bonus = bonusFromIntroPreview({
      hasUseTime: Boolean(extracted.useTimeText),
      hasFee: Boolean(extracted.feeText),
    });
    matchReason.push(...bonus.reasons);
    matchReason.push(
      `openingHoursRaw_fields:${extracted.openingHoursSourceFields.join(',')}`,
      `admissionFeeRaw_fields:${extracted.admissionFeeSourceFields.join(',')}`,
    );

    const score = readCount;

    rows.push(
      buildOutputRow({
        listRank,
        sourceName,
        item: working,
        extracted,
        introRawJson,
        score,
        matchReason,
      }),
    );
  }

  const outDir = path.join(process.cwd(), 'data', 'output');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'jeju-top-places.json');
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`Wrote ${rows.length} rows → ${path.relative(process.cwd(), outPath)}`);

  if (upsertSupabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      console.error('JEJU_TOP_UPSERT_SUPABASE=1 requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }
    const supabase = createClient<any, any, any>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const syncBatchId = `jeju-top-${Date.now().toString(36)}`;
    const coord = (s: string | null): number | null => {
      if (!s) return null;
      const n = Number(String(s).trim());
      return Number.isFinite(n) ? n : null;
    };
    const dbRows = rows.map((r) => ({
      list_rank: r.listRank,
      title: r.matchedTitle ?? r.sourceName,
      content_id: r.contentId,
      content_type_id: r.contentTypeId ? parseInt(String(r.contentTypeId), 10) : 12,
      addr1: r.addr1,
      addr2: r.addr2,
      overview: r.overview,
      first_image: r.firstImage,
      first_image2: r.firstImage2,
      mapx: coord(r.mapx),
      mapy: coord(r.mapy),
      tel: r.tel,
      homepage: r.homepage,
      readcount: r.score,
      source_api: r.sourceApi,
      fetched_at: r.fetchedAt,
      opening_hours_raw: r.openingHoursRaw,
      admission_fee_raw: r.admissionFeeRaw,
      business_status_note: r.businessStatusNote,
      reservation_info: r.reservationInfo,
      parking_info: r.parkingInfo,
      rest_date: r.restDate,
      use_time_text: r.useTimeText,
      fee_text: r.feeText,
      intro_raw_json: (() => {
        if (!r.introRawJson) return null;
        try {
          return JSON.parse(r.introRawJson) as Record<string, unknown>;
        } catch {
          return null;
        }
      })(),
      detail_info_raw_json: null,
      sync_batch_id: syncBatchId,
    }));

    const { error } = await supabase.from('jeju_kor_tourapi_places').upsert(dbRows, {
      onConflict: 'content_id,content_type_id',
    });
    if (error) {
      console.error('Supabase upsert error:', error.message);
      process.exit(1);
    }
    console.log(`Upserted ${dbRows.length} rows into jeju_kor_tourapi_places`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
