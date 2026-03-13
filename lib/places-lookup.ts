/**
 * Supabase places 테이블에서 관광지 이름/주소로 image_url, overview 조회 (일정 보강용).
 * 서버 전용: createServerClient()로 호출.
 */

const OVERVIEW_MAX_LENGTH = 150;

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
  const safeLang = ['en', 'ko', 'ja', 'chs', 'cht'].includes(langType) ? langType : 'en';
  const fullName = escapeIlike(name).slice(0, 80);
  const primaryName = escapeIlike(getPrimaryName(name)).slice(0, 80);
  const secondaryName = escapeIlike(getSecondaryName(name)).slice(0, 80);
  const addrPart = escapeIlike(address).slice(0, 120);

  const baseCandidates = primaryName && primaryName !== fullName ? [primaryName, fullName] : [fullName].filter(Boolean);
  if (baseCandidates.length === 0 && !secondaryName && !addrPart) return result;

  const langsToTry: string[] = safeLang === 'ko' ? ['ko', 'en', 'ja', 'chs', 'cht'] : [safeLang];

  try {
    let rows: { image_url: unknown; overview: unknown } | null = null;

    for (const lang of langsToTry) {
      const nameCandidates =
        lang === 'en' && secondaryName
          ? [secondaryName, ...baseCandidates]
          : baseCandidates;

      for (const namePart of nameCandidates) {
        if (!namePart) continue;
        const { data } = await supabase
          .from('places')
          .select('image_url, overview')
          .eq('lang_type', lang)
          .ilike('title', `%${namePart}%`)
          .limit(1);
        rows = data?.[0] ?? null;
        if (rows) break;
      }
      if (rows) break;

      if (addrPart) {
        const { data: byAddr } = await supabase
          .from('places')
          .select('image_url, overview')
          .eq('lang_type', lang)
          .ilike('address', `%${addrPart}%`)
          .limit(1);
        rows = byAddr?.[0] ?? null;
        if (rows) break;
      }
      if (rows) break;

      if (addrPart.length > 10) {
        const shortAddr = addrPart.slice(0, 40);
        const { data: byShortAddr } = await supabase
          .from('places')
          .select('image_url, overview')
          .eq('lang_type', lang)
          .ilike('address', `%${shortAddr}%`)
          .limit(1);
        rows = byShortAddr?.[0] ?? null;
      }
    }

    if (rows) {
      const url = rows.image_url ? String(rows.image_url).trim() : '';
      result.image_url = url || null;
      const raw = rows.overview && String(rows.overview).trim();
      if (raw) {
        result.overview =
          raw.length <= OVERVIEW_MAX_LENGTH
            ? raw
            : raw.slice(0, OVERVIEW_MAX_LENGTH).replace(/\s+\S*$/, '') + '…';
      }
    }
  } catch {
    // 조회 실패 시 빈 값 반환
  }
  return result;
}
