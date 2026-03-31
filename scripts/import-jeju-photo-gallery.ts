/**
 * Tour API PhotoGalleryService1 — 제주 POI별 관광사진 갤러리 백필 (최대 8장/POI, 재실행·멱등).
 *
 * 대상: `base_score` 상위 N(기본 200)개 POI 중 `manual_hidden` 이 아닌 행.
 * 전략: (1) POI `title` 로 `galleryDetailList1` 직접 호출 — `numOfRows` 는 부족 슬롯 수(최대 8)로 1회 호출 우선.
 *       (2) 부족하면 같은 갤러리 제목으로 페이지네이션.
 *       (3) 여전히 부족하면 `gallerySearchList1`(키워드=POI 제목)으로 후보를 찾은 뒤 상세 조회.
 *
 * 필요:
 * - 마이그레이션: supabase/migrations/20250327120000_jeju_photo_gallery_detail_json.sql
 * - TOUR_API_SERVICE_KEY 또는 TOUR_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * 환경:
 * - JEJU_PHOTO_GALLERY_MIN_SCORE=0.82 (검색 폴백 시 갤러리 목록 제목 ↔ POI 제목 유사도 하한)
 * - JEJU_PHOTO_GALLERY_MAX_CALLS=800 (검색+상세 합산)
 * - JEJU_PHOTO_GALLERY_MAX_DETAIL_PAGES=80 (갤러리당 상세 페이지 상한)
 * - JEJU_PHOTO_GALLERY_TOP_N=200 (0이면 전체 행 순회 — 비권장)
 * - JEJU_PHOTO_GALLERY_SKIP_TITLES=우도,삼성혈 (normalizeTitle 기준 제외)
 * - JEJU_PHOTO_GALLERY_MAX_PHOTOS_PER_POI=8
 * - JEJU_PHOTO_GALLERY_SEARCH_NUM_OF_ROWS=50 (검색 폴백 1페이지 행 수)
 * - JEJU_PHOTO_GALLERY_DISABLED=1
 * - JEJU_PHOTO_GALLERY_UPDATE_SUPABASE=1
 * - JEJU_PHOTO_GALLERY_DRY_RUN=1 (DB/API 없이 대상·슬롯만 로그)
 * - JEJU_PHOTO_GALLERY_SKIP_DETAIL=1 (API 호출 생략)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PhotoGalleryClient } from './jeju-tourapi/photo-gallery-client';
import { keyMapLoose, parseGenericItemsEnvelope } from './jeju-tourapi/parsers';

function envStr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v ? v : fallback;
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
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

function getServiceKey(): string {
  const k = process.env.TOUR_API_SERVICE_KEY?.trim() || process.env.TOUR_API_KEY?.trim();
  if (!k) {
    throw new Error('Set TOUR_API_SERVICE_KEY or TOUR_API_KEY (Tour API decoding key).');
  }
  return k;
}

function normalizeTitle(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]·\-_,.]/g, '')
    .replace(/^제주(특별자치도|도)?/u, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const cur = dp[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return dp[m];
}

function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function matchScore(galleryTitle: string, poiTitle: string): number {
  const x = normalizeTitle(poiTitle);
  const y = normalizeTitle(galleryTitle);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.93;
  return similarityRatio(x, y);
}

function parseSkipTitlePatterns(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => normalizeTitle(s.trim()))
    .filter(Boolean);
}

function isSkippedPoiTitle(title: string | null, patterns: string[]): boolean {
  if (!title || patterns.length === 0) return false;
  const n = normalizeTitle(title);
  for (const p of patterns) {
    if (!p) continue;
    if (n === p) return true;
  }
  return false;
}

type PoiRow = {
  id: number;
  content_id: string;
  content_type_id: number;
  title: string | null;
  photo_gallery_detail_json: unknown;
};

function pickGalleryListTitle(item: Record<string, unknown>): string | null {
  const lo = keyMapLoose(item);
  const keys = ['title', 'galtitle', 'gal_title', 'galtitl'];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickGalContentId(item: Record<string, unknown>): string | null {
  const lo = keyMapLoose(item);
  const keys = ['galcontentid', 'gal_content_id', 'contentid'];
  for (const k of keys) {
    const v = lo[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function pickHttpImage(raw: Record<string, unknown>): string | null {
  const lo = keyMapLoose(raw);
  const keys = [
    'originimgurl',
    'originimgurl2',
    'imgpath',
    'imageurl',
    'imagepath',
    'smallimageurl',
    'imgurl',
    'galwebviewimage',
  ];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const v of Object.values(lo)) {
    if (typeof v === 'string' && /^https?:\/\/.+\.(jpe?g|png|webp)(\?|$)/i.test(v)) {
      return v.trim();
    }
  }
  return null;
}

function pickThumb(raw: Record<string, unknown>): string | null {
  const lo = keyMapLoose(raw);
  const keys = ['smallimageurl', 'thumbpath', 'thumburl'];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}

function pickMonthLoc(raw: Record<string, unknown>): { month: string | null; loc: string | null } {
  const lo = keyMapLoose(raw);
  const monthKeys = ['galphotographymonth', 'photographymonth', 'month'];
  const locKeys = ['galphotographylocation', 'photographylocation', 'location', 'shootingplace'];
  let month: string | null = null;
  let loc: string | null = null;
  for (const k of monthKeys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) {
      month = v.trim();
      break;
    }
  }
  for (const k of locKeys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) {
      loc = v.trim();
      break;
    }
  }
  return { month, loc };
}

type CallBudget = { used: number; max: number };

function assertBudget(b: CallBudget): void {
  if (b.used >= b.max) {
    throw new Error(`Photo Gallery API call budget exceeded (${b.max}).`);
  }
}

function collectExistingImageUrls(json: unknown): Set<string> {
  const seen = new Set<string>();
  if (!json || typeof json !== 'object') return seen;
  const groups = (json as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) return seen;
  for (const g of groups) {
    if (!g || typeof g !== 'object') continue;
    const photos = (g as { photos?: unknown }).photos;
    if (!Array.isArray(photos)) continue;
    for (const p of photos) {
      if (!p || typeof p !== 'object') continue;
      const u = (p as { imageUrl?: unknown }).imageUrl;
      if (typeof u === 'string' && /^https?:\/\//i.test(u.trim())) seen.add(u.trim());
    }
  }
  return seen;
}

function countUniqueGalleryUrls(json: unknown): number {
  return collectExistingImageUrls(json).size;
}

type PhotoPayload = {
  imageUrl: string | null;
  thumbUrl: string | null;
  photographyMonth: string | null;
  photographyLocation: string | null;
  galTitle: string | null;
  galContentId: string | null;
  raw: Record<string, unknown>;
};

function rawToPhotoPayload(raw: Record<string, unknown>, galContentIdHint: string | null): PhotoPayload {
  const lo = keyMapLoose(raw);
  const { month, loc } = pickMonthLoc(raw);
  const gTitle =
    (typeof lo['title'] === 'string' && lo['title'].trim()) ||
    (typeof lo['galtitle'] === 'string' && lo['galtitle'].trim()) ||
    null;
  const gCid =
    lo['galcontentid'] != null ? String(lo['galcontentid']).trim() : galContentIdHint;
  return {
    imageUrl: pickHttpImage(raw),
    thumbUrl: pickThumb(raw),
    photographyMonth: month,
    photographyLocation: loc,
    galTitle: gTitle,
    galContentId: gCid,
    raw,
  };
}

function takeUniqueNewRaws(
  raws: Record<string, unknown>[],
  existingUrls: Set<string>,
  maxNew: number,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set(existingUrls);
  for (const raw of raws) {
    const url = pickHttpImage(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(raw);
    if (out.length >= maxNew) break;
  }
  return out;
}

function mergePayload(
  existingJson: unknown,
  keyword: string,
  importedAt: string,
  newGroups: Array<{
    galleryGroupTitle: string;
    matchScore: number;
    galContentId: string | null;
    photos: PhotoPayload[];
  }>,
): Record<string, unknown> {
  const base =
    existingJson && typeof existingJson === 'object' && 'groups' in (existingJson as object)
      ? (JSON.parse(JSON.stringify(existingJson)) as {
          groups: unknown[];
          source?: string;
          version?: number;
          keyword?: string;
          importedAt?: string;
        })
      : { version: 1, groups: [] as unknown[] };
  if (!Array.isArray(base.groups)) base.groups = [];
  base.source = 'PhotoGalleryService1';
  base.version = 1;
  base.keyword = keyword;
  base.importedAt = importedAt;
  for (const g of newGroups) {
    if (g.photos.length > 0) base.groups.push(g);
  }
  return base as Record<string, unknown>;
}

async function callGalleryDetailOnePage(
  client: PhotoGalleryClient,
  listTitle: string,
  galContentId: string | null,
  pageNo: number,
  numOfRows: number,
  budget: CallBudget,
  preferId: boolean,
): Promise<{ text: string; httpStatus: number }> {
  assertBudget(budget);
  budget.used += 1;
  if (preferId && galContentId) {
    return client.galleryDetailList1({
      pageNo,
      numOfRows,
      galContentId,
    });
  }
  return client.galleryDetailList1({
    pageNo,
    numOfRows,
    title: listTitle,
  });
}

/** `galleryDetailList1` — 부족 슬롯만큼만 채움. 슬롯당 최대 8행/호출. */
async function fetchDetailRowsForGallery(
  client: PhotoGalleryClient,
  listTitle: string,
  galContentId: string | null,
  existingUrls: Set<string>,
  maxNew: number,
  budget: CallBudget,
  maxDetailPages: number,
): Promise<{ raws: Record<string, unknown>[] }> {
  const collected: Record<string, unknown>[] = [];
  let pageNo = 1;
  let useIdPaging = false;

  while (collected.length < maxNew && pageNo <= maxDetailPages) {
    const need = maxNew - collected.length;
    const numOfRows = Math.min(8, need);

    let { text, httpStatus } = await callGalleryDetailOnePage(
      client,
      listTitle,
      galContentId,
      pageNo,
      numOfRows,
      budget,
      useIdPaging,
    );

    let env = parseGenericItemsEnvelope(text);
    if (
      !env.ok &&
      pageNo === 1 &&
      !useIdPaging &&
      galContentId &&
      (text.includes('INVALID_REQUEST_PARAMETER_ERROR') || env.parseError?.includes('파라미터'))
    ) {
      budget.used -= 1;
      useIdPaging = true;
      ({ text, httpStatus } = await callGalleryDetailOnePage(
        client,
        listTitle,
        galContentId,
        pageNo,
        numOfRows,
        budget,
        true,
      ));
      env = parseGenericItemsEnvelope(text);
    }

    if (httpStatus === 401 || httpStatus === 403) {
      throw new Error(`Photo Gallery detail HTTP ${httpStatus}. Check API key.`);
    }
    if (!env.ok) {
      if (pageNo === 1) {
        console.warn(`[detail] "${listTitle.slice(0, 40)}…" :`, env.parseError ?? env.resultMsg);
      }
      break;
    }

    const batch = takeUniqueNewRaws(env.items, existingUrls, need);
    for (const r of batch) {
      const u = pickHttpImage(r);
      if (u) existingUrls.add(u);
      collected.push(r);
      if (collected.length >= maxNew) break;
    }

    if (env.items.length < numOfRows) break;
    if (collected.length >= maxNew) break;
    pageNo += 1;
  }

  return { raws: collected };
}

async function searchBestGalleryRow(
  client: PhotoGalleryClient,
  searchKeyword: string,
  poiTitle: string,
  minScore: number,
  searchNumOfRows: number,
  budget: CallBudget,
): Promise<{ listTitle: string; galContentId: string | null; score: number } | null> {
  assertBudget(budget);
  budget.used += 1;
  const { text, httpStatus } = await client.gallerySearchList1({
    keyword: searchKeyword,
    pageNo: 1,
    numOfRows: searchNumOfRows,
  });
  if (httpStatus === 401 || httpStatus === 403) {
    throw new Error(`Photo Gallery search HTTP ${httpStatus}. Check TOUR_API_SERVICE_KEY / portal key.`);
  }
  const env = parseGenericItemsEnvelope(text);
  if (!env.ok) {
    console.warn(`[search] keyword="${searchKeyword}":`, env.parseError ?? env.resultMsg);
    return null;
  }
  let best: { listTitle: string; galContentId: string | null; score: number } | null = null;
  for (const it of env.items) {
    const row = it as Record<string, unknown>;
    const lt = pickGalleryListTitle(row);
    if (!lt) continue;
    const sc = matchScore(lt, poiTitle);
    if (sc < minScore) continue;
    if (!best || sc > best.score) {
      best = { listTitle: lt, galContentId: pickGalContentId(row), score: sc };
    }
  }
  return best;
}

async function loadPoisForGallery(
  supabase: SupabaseClient<any, any, any>,
  topN: number,
): Promise<PoiRow[]> {
  const selectCols = 'id,content_id,content_type_id,title,photo_gallery_detail_json';
  if (topN > 0) {
    const { data, error } = await supabase
      .from('jeju_kor_tourapi_places')
      .select(selectCols)
      .or('manual_hidden.eq.false,manual_hidden.is.null')
      .order('base_score', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(topN);
    if (error) throw error;
    return (data ?? []) as PoiRow[];
  }
  const pageSize = 1000;
  const out: PoiRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('jeju_kor_tourapi_places')
      .select(selectCols)
      .or('manual_hidden.eq.false,manual_hidden.is.null')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as PoiRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main(): Promise<void> {
  loadEnvFiles();
  if (envBool('JEJU_PHOTO_GALLERY_DISABLED')) {
    console.log('[PhotoGallery] JEJU_PHOTO_GALLERY_DISABLED=1 — exit without running.');
    return;
  }
  const keywordTag = envStr('JEJU_PHOTO_GALLERY_KEYWORD', '제주');
  const minScore = envNum('JEJU_PHOTO_GALLERY_MIN_SCORE', 0.82);
  const maxCalls = Math.max(10, Math.floor(envNum('JEJU_PHOTO_GALLERY_MAX_CALLS', 800)));
  const maxDetailPages = Math.min(500, Math.max(1, Math.floor(envNum('JEJU_PHOTO_GALLERY_MAX_DETAIL_PAGES', 80))));
  const topN = Math.max(0, Math.floor(envNum('JEJU_PHOTO_GALLERY_TOP_N', 200)));
  const maxPhotosPerPoi = Math.max(1, Math.floor(envNum('JEJU_PHOTO_GALLERY_MAX_PHOTOS_PER_POI', 8)));
  const skipTitlesRaw = envStr('JEJU_PHOTO_GALLERY_SKIP_TITLES', '우도,삼성혈');
  const skipTitlePatterns = parseSkipTitlePatterns(skipTitlesRaw);
  const searchNumOfRows = Math.min(100, Math.max(1, Math.floor(envNum('JEJU_PHOTO_GALLERY_SEARCH_NUM_OF_ROWS', 50))));
  const skipDetail = envBool('JEJU_PHOTO_GALLERY_SKIP_DETAIL');
  const updateDb = envBool('JEJU_PHOTO_GALLERY_UPDATE_SUPABASE');
  const dryRun = envBool('JEJU_PHOTO_GALLERY_DRY_RUN');
  if (!updateDb && !dryRun && !skipDetail) {
    console.warn(
      'JEJU_PHOTO_GALLERY_UPDATE_SUPABASE is not set — will call API but not write DB. Set JEJU_PHOTO_GALLERY_SKIP_DETAIL=1 to skip API.',
    );
  }

  const key = getServiceKey();
  const client = new PhotoGalleryClient({
    serviceKey: key,
    requestDelayMs: envNum('TOUR_API_REQUEST_DELAY_MS', 150),
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (load POIs from jeju_kor_tourapi_places).',
    );
  }
  const supabase = createClient<any, any, any>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let pois = await loadPoisForGallery(supabase, topN);
  pois = pois.filter((p) => !isSkippedPoiTitle(p.title, skipTitlePatterns));
  if (pois.length === 0) {
    console.warn('No POIs after top-N / skip-title filter; nothing to do.');
    return;
  }

  const budget: CallBudget = { used: 0, max: maxCalls };
  console.log(
    `[PhotoGallery] keywordTag="${keywordTag}" minScore=${minScore} maxCalls=${maxCalls} maxDetailPages=${maxDetailPages} topN=${topN || 'all'} maxPhotosPerPoi=${maxPhotosPerPoi} searchRows=${searchNumOfRows} skipTitles=${skipTitlesRaw}`,
  );

  if (dryRun) {
    for (const p of pois) {
      const n = countUniqueGalleryUrls(p.photo_gallery_detail_json);
      const missing = Math.max(0, maxPhotosPerPoi - n);
      console.log(`[dry-run] ${p.content_id} "${p.title ?? ''}" — have ${n}/${maxPhotosPerPoi}, missing ${missing}`);
    }
    return;
  }

  if (skipDetail) {
    console.log('JEJU_PHOTO_GALLERY_SKIP_DETAIL=1 — exit (no API).');
    return;
  }

  const importedAt = new Date().toISOString();
  let updated = 0;
  let skippedBudget = 0;

  for (const poi of pois) {
    if (budget.used >= budget.max) {
      console.warn(`[PhotoGallery] Call budget exhausted (${budget.used}/${budget.max}); stop until next run.`);
      skippedBudget += 1;
      break;
    }

    if (!poi.title?.trim()) continue;

    const existingJson = poi.photo_gallery_detail_json;
    const existingUrls = collectExistingImageUrls(existingJson);
    let slots = maxPhotosPerPoi - existingUrls.size;
    if (slots <= 0) continue;

    const newGroups: Array<{
      galleryGroupTitle: string;
      matchScore: number;
      galContentId: string | null;
      photos: PhotoPayload[];
    }> = [];

    const urlWorking = new Set(existingUrls);

    // (1) Exact: POI title as gallery list title
    const exactTitle = poi.title.trim();
    const exactRaws = (
      await fetchDetailRowsForGallery(
        client,
        exactTitle,
        null,
        urlWorking,
        slots,
        budget,
        maxDetailPages,
      )
    ).raws;
    if (exactRaws.length > 0) {
      const photos = exactRaws.map((raw) => rawToPhotoPayload(raw, null));
      newGroups.push({
        galleryGroupTitle: exactTitle,
        matchScore: 1,
        galContentId: null,
        photos,
      });
      slots = maxPhotosPerPoi - urlWorking.size;
    }

    // (2) Search fallback (gallerySearchList1) — exact title/detail만으로 부족할 때
    if (slots > 0 && budget.used < budget.max) {
      const hit = await searchBestGalleryRow(
        client,
        exactTitle,
        exactTitle,
        minScore,
        searchNumOfRows,
        budget,
      );
      if (hit) {
        const alreadyFetchedSameList = hit.listTitle === exactTitle && exactRaws.length > 0;
        if (!alreadyFetchedSameList) {
          const raws = (
            await fetchDetailRowsForGallery(
              client,
              hit.listTitle,
              hit.galContentId,
              urlWorking,
              slots,
              budget,
              maxDetailPages,
            )
          ).raws;
          if (raws.length > 0) {
            const photos = raws.map((raw) => rawToPhotoPayload(raw, hit.galContentId));
            newGroups.push({
              galleryGroupTitle: hit.listTitle,
              matchScore: hit.score,
              galContentId: hit.galContentId,
              photos,
            });
          }
        }
      }
    }

    if (newGroups.length === 0) continue;

    const photo_gallery_detail_json = mergePayload(existingJson, keywordTag, importedAt, newGroups);

    if (!updateDb) {
      const added = newGroups.reduce((n, g) => n + g.photos.length, 0);
      console.log(`[no-db] ${poi.content_id} (${poi.title}) +${added} photos (groups=${newGroups.length})`);
      continue;
    }

    const { error } = await supabase
      .from('jeju_kor_tourapi_places')
      .update({
        photo_gallery_detail_json,
        photo_gallery_fetched_at: importedAt,
      })
      .eq('content_id', poi.content_id);

    if (error) {
      console.error(`[Supabase] update failed for ${poi.content_id}:`, error.message);
    } else {
      updated += 1;
      const total = countUniqueGalleryUrls(photo_gallery_detail_json);
      console.log(`[Supabase] ${poi.content_id} (${poi.title}) — now ${total} unique gallery URLs`);
    }
  }

  console.log(
    `Done. API calls used: ${budget.used}/${maxCalls}. Rows updated: ${updated}. Stopped early (budget): ${skippedBudget}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
