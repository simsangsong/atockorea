/**
 * Supabase places 테이블에서 관광지 이름/주소로 image_url, overview 조회 (일정 보강용).
 * 서버 전용: createServerClient()로 호출.
 */

const OVERVIEW_MAX_LENGTH = 350;

function escapeIlike(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim();
}

export interface PlaceEnrichment {
  image_url: string | null;
  overview: string | null;
  /** 개폐장시간 (LOD open_time) */
  open_time?: string | null;
  /** 이용요금 (LOD use_fee) */
  use_fee?: string | null;
  /** 연락처 (LOD tel) */
  tel?: string | null;
  /** 위도 (places.mapy) */
  mapy?: number | null;
  /** 경도 (places.mapx) */
  mapx?: number | null;
  /** 요청 언어에 없어서 국문(ko)으로 찾은 경우. 이때 overview는 국문이므로 요청 언어로 번역해 출력 권장 */
  from_fallback_lang?: 'ko';
  /** 매칭된 places 행의 id (번역 저장 시 동일 id로 요청 언어 행 upsert용) */
  place_id?: number;
  /** 매칭된 행의 title/address (번역 행 저장 시 사용) */
  place_title?: string | null;
  place_address?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof import('@supabase/supabase-js').createClient<any, any, any>>;

/** 괄호 앞 메인 이름. "아르떼뮤지엄 제주 (ARTE Museum Jeju)" → "아르떼뮤지엄 제주" */
function getPrimaryName(name: string): string {
  const trimmed = name.trim();
  const paren = trimmed.indexOf(' (');
  if (paren > 0) return trimmed.slice(0, paren).trim();
  return trimmed;
}

/** 괄호 안 이름(영문 등). "오설록 티뮤지엄 (O'sulloc Tea Museum)" → "O'sulloc Tea Museum" */
function getSecondaryName(name: string): string {
  const trimmed = name.trim();
  const start = trimmed.indexOf(' (');
  const end = trimmed.lastIndexOf(')');
  if (start >= 0 && end > start) return trimmed.slice(start + 2, end).trim();
  return '';
}

/**
 * places 테이블에서 title 또는 address로 매칭해 image_url, overview 반환.
 * lang_type: 'en' | 'ko' | 'ja' | 'chs' | 'cht'. ko 검색 실패 시 en 폴백.
 * 영문(en) 검색 시 괄호 안 영문 이름으로도 검색.
 */
export async function getPlaceEnrichment(
  supabase: SupabaseClient,
  name: string,
  address: string,
  langType: string = 'en'
): Promise<PlaceEnrichment> {
  const result: PlaceEnrichment = { image_url: null, overview: null };
  const safeLang = ['en', 'ko', 'ja', 'chs', 'cht', 'es'].includes(langType) ? langType : 'en';
  const fullName = escapeIlike(name).slice(0, 80);
  const primaryName = escapeIlike(getPrimaryName(name)).slice(0, 80);
  const secondaryName = escapeIlike(getSecondaryName(name)).slice(0, 80);
  const addrPart = escapeIlike(address).slice(0, 120);

  const baseCandidates = primaryName && primaryName !== fullName ? [primaryName, fullName] : [fullName].filter(Boolean);
  if (baseCandidates.length === 0 && !secondaryName && !addrPart) return result;

  /** 요청 언어 우선, 없으면 국문(ko) 폴백 — 사진·상세 등 다른 언어에 없을 때 국문에서 찾기 위함 */
  const langsToTry: string[] =
    safeLang === 'ko'
      ? ['ko', 'en', 'ja', 'chs', 'cht']
      : [safeLang, 'ko'];

  try {
    let rows: { id?: unknown; title?: unknown; address?: unknown; image_url?: unknown; overview?: unknown; open_time?: unknown; use_fee?: unknown; tel?: unknown; mapx?: unknown; mapy?: unknown } | null = null;
    let foundLang: string | null = null;

    for (const lang of langsToTry) {
      const nameCandidates =
        lang === 'en' && secondaryName
          ? [secondaryName, ...baseCandidates]
          : baseCandidates;

      for (const namePart of nameCandidates) {
        if (!namePart) continue;
        const { data } = await supabase
          .from('places')
          .select('id, title, address, image_url, overview, open_time, use_fee, tel, mapx, mapy')
          .eq('lang_type', lang)
          .ilike('title', `%${namePart}%`)
          .limit(1);
        rows = data?.[0] ?? null;
        if (rows) {
          foundLang = lang;
          break;
        }
      }
      if (rows) break;

      if (addrPart) {
        const { data: byAddr } = await supabase
          .from('places')
          .select('id, title, address, image_url, overview, open_time, use_fee, tel, mapx, mapy')
          .eq('lang_type', lang)
          .ilike('address', `%${addrPart}%`)
          .limit(1);
        rows = byAddr?.[0] ?? null;
        if (rows) {
          foundLang = lang;
          break;
        }
      }
      if (rows) break;

      if (addrPart.length > 10) {
        const shortAddr = addrPart.slice(0, 40);
        const { data: byShortAddr } = await supabase
          .from('places')
          .select('id, title, address, image_url, overview, open_time, use_fee, tel, mapx, mapy')
          .eq('lang_type', lang)
          .ilike('address', `%${shortAddr}%`)
          .limit(1);
        rows = byShortAddr?.[0] ?? null;
        if (rows) foundLang = lang;
      }
    }

    if (rows) {
      if (foundLang === 'ko' && safeLang !== 'ko') result.from_fallback_lang = 'ko';
      const url = rows.image_url ? String(rows.image_url).trim() : '';
      result.image_url = url || null;
      const raw = rows.overview ? String(rows.overview).trim() : '';
      if (raw) {
        result.overview =
          raw.length <= OVERVIEW_MAX_LENGTH
            ? raw
            : raw.slice(0, OVERVIEW_MAX_LENGTH).replace(/\s+\S*$/, '') + '…';
      }
      if (typeof rows.id === 'number') result.place_id = rows.id;
      if (rows.title != null) result.place_title = rows.title ? String(rows.title).trim() : null;
      if (rows.address != null) result.place_address = rows.address ? String(rows.address).trim() : null;
      if (rows.open_time != null && String(rows.open_time).trim()) result.open_time = String(rows.open_time).trim();
      if (rows.use_fee != null && String(rows.use_fee).trim()) result.use_fee = String(rows.use_fee).trim();
      if (rows.tel != null && String(rows.tel).trim()) result.tel = String(rows.tel).trim();
      const numMapx = rows.mapx != null && rows.mapx !== '' ? Number(rows.mapx) : NaN;
      const numMapy = rows.mapy != null && rows.mapy !== '' ? Number(rows.mapy) : NaN;
      if (!Number.isNaN(numMapx)) result.mapx = numMapx;
      if (!Number.isNaN(numMapy)) result.mapy = numMapy;
    }
  } catch {
    // 조회 실패 시 빈 값 반환
  }
  return result;
}

/**
 * 번역한 overview를 places 테이블에 저장. 같은 id + lang_type으로 다음 요청 시 조회됨.
 * embedding은 null로 두고, 필요 시 파이프라인에서 backfill 가능.
 */
/** Map app locale to `places.lang_type` column values. */
export function localeToPlaceLang(locale?: string): string {
  const raw = (locale || 'en').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'ko') return 'ko';
  if (raw === 'ja') return 'ja';
  if (raw === 'zh-tw' || raw === 'zh-hant') return 'cht';
  if (raw === 'zh' || raw === 'zh-cn' || raw === 'zh-hans') return 'chs';
  if (raw === 'es') return 'es';
  return 'en';
}

type PlaceDetailOpts = { mapx?: number; mapy?: number; placeId?: number };

/**
 * Full `places` row when possible; otherwise enrichment fields (for itinerary “View details”).
 */
export async function getPlaceDetailFull(
  supabase: SupabaseClient,
  name: string,
  address: string,
  langType: string,
  opts?: PlaceDetailOpts
): Promise<Record<string, unknown> | null> {
  const safeLang = ['en', 'ko', 'ja', 'chs', 'cht', 'es'].includes(langType) ? langType : 'en';

  if (opts?.placeId != null && Number.isFinite(opts.placeId)) {
    const { data: byId } = await supabase
      .from('places')
      .select('*')
      .eq('id', opts.placeId)
      .eq('lang_type', safeLang)
      .maybeSingle();
    if (byId) return byId as Record<string, unknown>;
    const { data: byIdKo } = await supabase
      .from('places')
      .select('*')
      .eq('id', opts.placeId)
      .eq('lang_type', 'ko')
      .maybeSingle();
    if (byIdKo) return byIdKo as Record<string, unknown>;
  }

  const enrichment = await getPlaceEnrichment(supabase, name, address, safeLang);
  if (enrichment.place_id != null) {
    const { data: full } = await supabase
      .from('places')
      .select('*')
      .eq('id', enrichment.place_id)
      .eq('lang_type', safeLang)
      .maybeSingle();
    if (full) return full as Record<string, unknown>;
    const { data: fullKo } = await supabase
      .from('places')
      .select('*')
      .eq('id', enrichment.place_id)
      .eq('lang_type', 'ko')
      .maybeSingle();
    if (fullKo) return fullKo as Record<string, unknown>;
  }

  if (!enrichment.image_url && !enrichment.overview && enrichment.place_id == null) {
    return null;
  }

  return {
    id: enrichment.place_id ?? null,
    title: enrichment.place_title ?? name,
    address: enrichment.place_address ?? address,
    image_url: enrichment.image_url,
    overview: enrichment.overview,
    open_time: enrichment.open_time ?? null,
    use_fee: enrichment.use_fee ?? null,
    tel: enrichment.tel ?? null,
    mapx: enrichment.mapx ?? null,
    mapy: enrichment.mapy ?? null,
    lang_type: safeLang,
    from_fallback_lang: enrichment.from_fallback_lang ?? null,
  };
}

export async function savePlaceTranslation(
  supabase: SupabaseClient,
  payload: {
    id: number;
    lang_type: string;
    title: string;
    address: string | null;
    image_url: string | null;
    overview: string;
  }
): Promise<void> {
  try {
    await supabase.from('places').upsert(
      {
        id: payload.id,
        lang_type: payload.lang_type,
        title: payload.title.slice(0, 200),
        address: payload.address?.slice(0, 500) ?? null,
        image_url: payload.image_url?.slice(0, 1000) ?? null,
        overview: payload.overview.slice(0, 5000),
      },
      { onConflict: 'id,lang_type', ignoreDuplicates: false }
    );
  } catch {
    // 저장 실패 시 무시 (다음 요청에 다시 번역)
  }
}
