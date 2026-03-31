import { TOUR_DETAIL_TEMPLATE_SLUGS } from "@/lib/tour-detail-template-slugs"

/** 성산일출봉 일대 (동쪽 투어 기준점) */
export const WEATHER_ANCHOR_EAST_SEONGSAN = {
  latitude: 33.4594,
  longitude: 126.9427,
  areaLabel: "Seongsan Ilchulbong area",
} as const

/** 한림읍 일대 (서남쪽 투어 기준점) */
export const WEATHER_ANCHOR_SOUTHWEST_HALLIM = {
  latitude: 33.4097,
  longitude: 126.2716,
  areaLabel: "Hallim area",
} as const

export type TourWeatherAnchorInput = {
  slug?: string | null
  city?: string | null
}

/** Slug fragment hints (ASCII + common romanizations). */
const SOUTHWEST_SLUG_RE =
  /southwest|hallim|hyeopjae|hyupjae|geumneung|west-south|west_south|southern-west|sw-jeju/i

const EAST_SLUG_RE =
  /east-signature|east_jeju|east-jeju|jeju-east|seongsan|ilchulbong|udo|dongbu|dong-bu/i

/** Free-text city / region labels from CMS or adapters. */
const SOUTHWEST_CITY_RE =
  /southwest|서남|hallim|한림|hyeopjae|협재|geumneung|금능|west\s+jeju|western\s+jeju|서쪽|서부/i

const EAST_CITY_RE = /east\s+jeju|동쪽|동부|seongsan|성산|우도|udo/i

/**
 * Pick Open-Meteo anchor: 동쪽 → 성산일출봉, 서남쪽 → 한림읍.
 * Slug hints first, then `city`; unknown → 동쪽 (기존 템플릿 기본).
 */
export function resolveTourWeatherAnchor(input: TourWeatherAnchorInput): {
  latitude: number
  longitude: number
  areaLabel: string
} {
  const slug = input.slug?.trim() ?? ""
  const slugLower = slug.toLowerCase()
  const cityLower = (input.city?.trim() ?? "").toLowerCase()

  if (slugLower && SOUTHWEST_SLUG_RE.test(slugLower)) {
    return { ...WEATHER_ANCHOR_SOUTHWEST_HALLIM }
  }
  if (slugLower && (EAST_SLUG_RE.test(slugLower) || TOUR_DETAIL_TEMPLATE_SLUGS.has(slug))) {
    return { ...WEATHER_ANCHOR_EAST_SEONGSAN }
  }

  if (cityLower && EAST_CITY_RE.test(cityLower)) {
    return { ...WEATHER_ANCHOR_EAST_SEONGSAN }
  }
  if (cityLower && SOUTHWEST_CITY_RE.test(cityLower)) {
    return { ...WEATHER_ANCHOR_SOUTHWEST_HALLIM }
  }

  return { ...WEATHER_ANCHOR_EAST_SEONGSAN }
}
