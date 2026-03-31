/**
 * Heuristic region / indoor-outdoor / free-paid + normalized scores for jeju_kor_tourapi_places.
 * Used by scripts/score-jeju-places.ts (batch). No UI / no payment logic.
 *
 * (Tour API search/detail merge helpers live in ./scoring.ts — do not mix.)
 */

export type RegionGroup = 'east' | 'west' | 'south' | 'city' | 'udo' | 'etc';

export type ReadcountStats = {
  min: number;
  max: number;
  nonNullCount: number;
};

/** Row shape from Supabase select (snake_case). */
export type JejuPlaceScoringInput = {
  id: number;
  title: string | null;
  addr1: string | null;
  addr2: string | null;
  overview: string | null;
  first_image: string | null;
  first_image2: string | null;
  mapx: number | string | null;
  mapy: number | string | null;
  tel: string | null;
  readcount: number | null;
  use_time_text: string | null;
  fee_text: string | null;
  intro_raw_json: Record<string, unknown> | null;
  detail_info_raw_json: Record<string, unknown> | null;
  travel_value_score: number | string | null;
  photo_score: number | string | null;
  manual_priority: number | string | null;
  manual_hidden: boolean | null;
};

function compactText(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function haystack(place: JejuPlaceScoringInput): string {
  const intro =
    place.intro_raw_json != null
      ? JSON.stringify(place.intro_raw_json).slice(0, 8000)
      : '';
  const detail =
    place.detail_info_raw_json != null
      ? JSON.stringify(place.detail_info_raw_json).slice(0, 4000)
      : '';
  return compactText([
    place.title,
    place.addr1,
    place.addr2,
    place.overview,
    intro,
    detail,
  ]).toLowerCase();
}

const UDO_MARKERS = ['우도'];
const EAST_MARKERS = ['성산', '구좌', '표선', '세화', '성읍', '조천', '월정'];
const WEST_MARKERS = ['협재', '한림', '애월', '금능', '곽지', '신창', '한경', '애월읍'];
const SOUTH_MARKERS = ['중문', '서귀포', '안덕', '대정', '송악산', '산방산', '남원'];
const CITY_MARKERS = ['제주시', '용두암', '동문시장', '노형', '도두', '제주특별자치도', '제주시청', '이도', '연동', '건입'];

/**
 * Rough region bucket from address/title/overview (Korean keywords).
 */
export function inferRegionGroup(place: JejuPlaceScoringInput): RegionGroup {
  const h = haystack(place);
  if (UDO_MARKERS.some((m) => h.includes(m))) return 'udo';
  if (EAST_MARKERS.some((m) => h.includes(m))) return 'east';
  if (WEST_MARKERS.some((m) => h.includes(m))) return 'west';
  if (SOUTH_MARKERS.some((m) => h.includes(m))) return 'south';
  if (CITY_MARKERS.some((m) => h.includes(m))) return 'city';
  return 'etc';
}

const INDOOR_HINTS = [
  '박물관',
  '미술관',
  '아쿠아플라넷',
  '아쿠아리움',
  '실내',
  '전시관',
  '난타',
  '수퍼마켓',
  '마트',
  '테마파크',
  '체험관',
  '박람회장',
];

const OUTDOOR_HINTS = [
  '해변',
  '오름',
  '폭포',
  '해안',
  '숲길',
  '등산',
  '산책',
  '공원',
  '해안도로',
  '절경',
  '일출',
  '일몰',
];

export type IndoorOutdoor = {
  is_indoor: boolean | null;
  is_outdoor: boolean | null;
};

/**
 * Heuristic indoor/outdoor flags; both may be true (mixed). Both null if no signal.
 */
export function inferIndoorOutdoor(place: JejuPlaceScoringInput): IndoorOutdoor {
  const h = haystack(place);
  let inHits = 0;
  let outHits = 0;
  for (const w of INDOOR_HINTS) {
    if (h.includes(w.toLowerCase())) inHits += 1;
  }
  for (const w of OUTDOOR_HINTS) {
    if (h.includes(w.toLowerCase())) outHits += 1;
  }
  if (inHits === 0 && outHits === 0) {
    return { is_indoor: null, is_outdoor: null };
  }
  return {
    is_indoor: inHits > 0 ? true : outHits > 0 ? false : null,
    is_outdoor: outHits > 0 ? true : inHits > 0 ? false : null,
  };
}

export type FreePaid = {
  is_free: boolean | null;
  is_paid: boolean | null;
};

/**
 * Uses fee_text heuristics; null when unknown.
 */
export function inferFreePaid(place: JejuPlaceScoringInput): FreePaid {
  const raw = place.fee_text;
  if (raw == null || String(raw).trim() === '') {
    return { is_free: null, is_paid: null };
  }
  const t = String(raw).trim();
  if (t.includes('무료')) {
    return { is_free: true, is_paid: false };
  }
  return { is_free: false, is_paid: true };
}

/**
 * Linear 0–100 from min–max; returns null if value is null.
 * If min===max and value is non-null, returns 100 (flat distribution).
 */
export function normalizeScore(value: number | null, min: number, max: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max < min) return null;
  if (max === min) return 100;
  const n = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, n));
}

/**
 * readcount min–max normalized to 0–100. Null readcount → null score.
 */
export function calcPopularityScore(
  place: JejuPlaceScoringInput,
  stats: ReadcountStats,
): number | null {
  const rc = place.readcount;
  if (rc == null || !Number.isFinite(rc)) return null;
  if (stats.nonNullCount === 0) return null;
  return normalizeScore(rc, stats.min, stats.max);
}

export function buildReadcountStats(places: JejuPlaceScoringInput[]): ReadcountStats {
  const vals = places
    .map((p) => p.readcount)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) {
    return { min: 0, max: 0, nonNullCount: 0 };
  }
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
    nonNullCount: vals.length,
  };
}

/**
 * 0–100 from field completeness (see spec weights).
 */
export function calcDataQualityScore(place: JejuPlaceScoringInput): number {
  let s = 0;
  if (place.first_image != null && String(place.first_image).trim() !== '') s += 20;
  if (place.overview != null && String(place.overview).trim() !== '') s += 20;
  if (place.use_time_text != null && String(place.use_time_text).trim() !== '') s += 20;
  if (place.fee_text != null && String(place.fee_text).trim() !== '') s += 15;
  const mx = place.mapx != null && String(place.mapx).trim() !== '';
  const my = place.mapy != null && String(place.mapy).trim() !== '';
  if (mx && my) s += 10;
  if (place.addr1 != null && String(place.addr1).trim() !== '') s += 10;
  if (place.tel != null && String(place.tel).trim() !== '') s += 5;
  return Math.min(100, s);
}

function numOr0(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export type BaseScoreInput = {
  popularity_score: number | null;
  data_quality_score: number | null;
  travel_value_score: number | string | null;
  photo_score: number | string | null;
  manual_priority: number | string | null;
  manual_hidden: boolean | null;
};

/**
 * v1: 35% popularity + 25% data quality + 20% travel + 10% photo + 10% manual_priority.
 * manual_hidden → 0. Coalesce manual dims to 0.
 */
export function calcBaseScore(input: BaseScoreInput): number {
  if (input.manual_hidden === true) return 0;
  const pop = input.popularity_score ?? 0;
  const dq = input.data_quality_score ?? 0;
  const tv = numOr0(input.travel_value_score);
  const ph = numOr0(input.photo_score);
  const mp = numOr0(input.manual_priority);
  const raw = 0.35 * pop + 0.25 * dq + 0.2 * tv + 0.1 * ph + 0.1 * mp;
  return Math.max(0, Math.min(100, raw));
}
