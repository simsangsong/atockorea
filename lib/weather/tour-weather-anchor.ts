/**
 * 투어 슬러그 → 대표 명소 좌표 매핑.
 * `/api/weather/forecast?slug=<slug>` 요청 시 해당 지역의 실시간 날씨를 가져온다.
 *
 * 좌표는 각 투어 itineraryStops 의 대표 관광지(헤드라인 명소) 기준이며 match_pois 출처.
 * areaLabel 은 라이브 날씨 띠에 노출되는 지역명. KO와 EN 라벨을 함께 보관해 locale에 맞게 응답한다.
 */

export type TourWeatherAnchor = {
  latitude: number
  longitude: number
  /** 영문/기본 라벨 (en, es, ja, zh, zh-TW 공용). */
  areaLabel: string
  /** 한국어 라벨 (ko 전용). */
  areaLabelKo: string
}

/** 좌표는 성산일출봉 일대 — 표시용 라벨은 동쪽 일대(투어 구역)로 통일. 미지 슬러그 기본값. */
export const WEATHER_ANCHOR_EAST_SEONGSAN: TourWeatherAnchor = {
  latitude: 33.4581,
  longitude: 126.9425,
  areaLabel: "East Jeju region",
  areaLabelKo: "제주 동쪽 지역",
}

/**
 * Slug → 대표 관광지 좌표 (match_pois). 각 투어의 헤드라인 명소를 대표로 짚어 그 좌표 기준 날씨를 서빙.
 * 신규 투어 추가 시 이 맵만 갱신하면 된다.
 */
export const TOUR_WEATHER_ANCHORS: Record<string, TourWeatherAnchor> = {
  // ── Jeju ────────────────────────────────────────────────
  "east-signature-nature-core": { latitude: 33.4581, longitude: 126.9425, areaLabel: "East Jeju · Seongsan", areaLabelKo: "제주 동부·성산" },
  "jeju-eastern-unesco-spots-day-tour": { latitude: 33.4581, longitude: 126.9425, areaLabel: "East Jeju", areaLabelKo: "제주 동부" },
  "jeju-cherry-blossom-tour-east-route": { latitude: 33.4581, longitude: 126.9425, areaLabel: "East Jeju", areaLabelKo: "제주 동부" },
  "jeju-hydrangea-festival-tour-east-route": { latitude: 33.4581, longitude: 126.9425, areaLabel: "East Jeju", areaLabelKo: "제주 동부" },
  "jeju-cruise-shore-excursion-bus-tour": { latitude: 33.4581, longitude: 126.9425, areaLabel: "East Jeju", areaLabelKo: "제주 동부" },
  "jeju-cruise-shore-excursion-small-group-tour": { latitude: 33.4581, longitude: 126.9425, areaLabel: "East Jeju", areaLabelKo: "제주 동부" },
  "jeju-grand-highlights-loop": { latitude: 33.4996, longitude: 126.5312, areaLabel: "Jeju Island", areaLabelKo: "제주 전역" },
  "jeju-island-private-car-charter-tour": { latitude: 33.4996, longitude: 126.5312, areaLabel: "Jeju Island", areaLabelKo: "제주 전역" },
  "jeju-southern-top-unesco-spots-tour": { latitude: 33.2368, longitude: 126.4255, areaLabel: "Jungmun · Seogwipo", areaLabelKo: "중문·서귀포" },
  "jeju-west-south-full-day-authentic-tour": { latitude: 33.2368, longitude: 126.4255, areaLabel: "Southwest Jeju", areaLabelKo: "제주 서남부" },
  "jeju-hydrangea-festival-tour-southwest-route": { latitude: 33.3895, longitude: 126.2393, areaLabel: "Hallim · West Jeju", areaLabelKo: "한림·제주 서부" },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { latitude: 33.2898, longitude: 126.3683, areaLabel: "Southwest Jeju", areaLabelKo: "제주 서남부" },
  "southwest-hallasan-osulloc-aewol": { latitude: 33.3059, longitude: 126.2894, areaLabel: "West Jeju", areaLabelKo: "제주 서부" },

  // ── Busan · Gyeongju · Yangsan ──────────────────────────
  "busan-gyeongju-unesco-legacy-tour-national-museum": { latitude: 35.7899, longitude: 129.3319, areaLabel: "Gyeongju", areaLabelKo: "경주" },
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": { latitude: 35.8443, longitude: 129.2757, areaLabel: "Gyeongju", areaLabelKo: "경주" },
  "from-busan-gyeongju-ancient-capital-day-tour": { latitude: 35.7899, longitude: 129.3319, areaLabel: "Gyeongju", areaLabelKo: "경주" },
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": { latitude: 35.488, longitude: 129.0643, areaLabel: "Yangsan · Tongdosa", areaLabelKo: "양산·통도사" },
  "busan-top-attractions-day-tour": { latitude: 35.1885, longitude: 129.2231, areaLabel: "Busan", areaLabelKo: "부산" },
  "busan-cruise-shore-excursion-bus-tour": { latitude: 35.1885, longitude: 129.2231, areaLabel: "Busan", areaLabelKo: "부산" },
  "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": { latitude: 35.488, longitude: 129.0643, areaLabel: "Yangsan · Yeongnam", areaLabelKo: "양산·영남" },
  "busan-private-car-charter-cruise-shore": { latitude: 35.0975, longitude: 129.0388, areaLabel: "Busan", areaLabelKo: "부산" },
  "busan-small-group-sightseeing-tour-cruise-passengers": { latitude: 35.1885, longitude: 129.2231, areaLabel: "Busan", areaLabelKo: "부산" },

  // ── Seoul · Incheon · Gyeonggi · Gangwon ────────────────
  "from-incheon-seoul-day-tour-cruise-guests": { latitude: 37.5796, longitude: 126.977, areaLabel: "Seoul", areaLabelKo: "서울" },
  "incheon-seoul-private-car-shore-excursion-cruise": { latitude: 37.5796, longitude: 126.977, areaLabel: "Seoul", areaLabelKo: "서울" },
  "seoul-suburbs-private-chartered-car-10hr": { latitude: 37.578, longitude: 126.977, areaLabel: "Seoul", areaLabelKo: "서울" },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { latitude: 37.8922, longitude: 126.7431, areaLabel: "Paju · DMZ", areaLabelKo: "파주·DMZ" },
  "seoul-private-nami-morning-calm-petite-france": { latitude: 37.7917, longitude: 127.5255, areaLabel: "Nami · Gapyeong", areaLabelKo: "남이섬·가평" },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { latitude: 38.1574, longitude: 128.4355, areaLabel: "Seoraksan · Sokcho", areaLabelKo: "설악산·속초" },
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": { latitude: 38.1574, longitude: 128.4355, areaLabel: "Seoraksan · Yangyang", areaLabelKo: "설악산·양양" },
  "seoul-seoraksan-nami-island-morning-calm-day-tour": { latitude: 38.1574, longitude: 128.4355, areaLabel: "Seoraksan · Gangwon", areaLabelKo: "설악산·강원" },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { latitude: 37.2871, longitude: 127.0119, areaLabel: "Suwon", areaLabelKo: "수원" },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { latitude: 37.2871, longitude: 127.0119, areaLabel: "Suwon", areaLabelKo: "수원" },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { latitude: 37.2871, longitude: 127.0119, areaLabel: "Suwon · Yongin", areaLabelKo: "수원·용인" },
  "pocheon-sanjeong-lake-herb-island-art-valley": { latitude: 38.0706, longitude: 127.3204, areaLabel: "Pocheon", areaLabelKo: "포천" },
}

/** Slug 기반 조회. 모르는 슬러그는 동쪽 앵커로 폴백(기존 동작 유지). */
export function resolveTourWeatherAnchorBySlug(
  slug: string | null | undefined,
): TourWeatherAnchor {
  if (!slug) return WEATHER_ANCHOR_EAST_SEONGSAN
  return TOUR_WEATHER_ANCHORS[slug] ?? WEATHER_ANCHOR_EAST_SEONGSAN
}

// Deep-audit 2026-07-05 (L7): ja/zh/zh-TW forecasts used to inline the English
// areaLabel ("Jejuの天気…"). Translate the place/direction tokens so CJK
// replies read natively. Unknown tokens (e.g. DMZ) fall back to the original
// word, so a newly-added anchor degrades gracefully rather than breaking.
// es keeps the roman spelling by convention (Spanish speakers read "Jeju").
const AREA_TOKENS: Record<"ja" | "zh" | "zh-TW", Record<string, string>> = {
  ja: {
    Jeju: "済州", Seoul: "ソウル", Busan: "釜山", Gyeongju: "慶州", Suwon: "水原",
    Pocheon: "抱川", Seongsan: "城山", Hallim: "翰林", Jungmun: "中文", Seogwipo: "西帰浦",
    Nami: "南怡島", Gapyeong: "加平", Paju: "坡州", Seoraksan: "雪岳山", Gangwon: "江原",
    Sokcho: "束草", Yangyang: "襄陽", Yongin: "龍仁", Yangsan: "梁山", Tongdosa: "通度寺",
    Yeongnam: "嶺南", East: "東部", West: "西部", Southwest: "南西部", South: "南部",
    Island: "", region: "",
  },
  zh: {
    Jeju: "济州", Seoul: "首尔", Busan: "釜山", Gyeongju: "庆州", Suwon: "水原",
    Pocheon: "抱川", Seongsan: "城山", Hallim: "翰林", Jungmun: "中文", Seogwipo: "西归浦",
    Nami: "南怡岛", Gapyeong: "加平", Paju: "坡州", Seoraksan: "雪岳山", Gangwon: "江原",
    Sokcho: "束草", Yangyang: "襄阳", Yongin: "龙仁", Yangsan: "梁山", Tongdosa: "通度寺",
    Yeongnam: "岭南", East: "东部", West: "西部", Southwest: "西南部", South: "南部",
    Island: "岛", region: "地区",
  },
  "zh-TW": {
    Jeju: "濟州", Seoul: "首爾", Busan: "釜山", Gyeongju: "慶州", Suwon: "水原",
    Pocheon: "抱川", Seongsan: "城山", Hallim: "翰林", Jungmun: "中文", Seogwipo: "西歸浦",
    Nami: "南怡島", Gapyeong: "加平", Paju: "坡州", Seoraksan: "雪岳山", Gangwon: "江原",
    Sokcho: "束草", Yangyang: "襄陽", Yongin: "龍仁", Yangsan: "梁山", Tongdosa: "通度寺",
    Yeongnam: "嶺南", East: "東部", West: "西部", Southwest: "西南部", South: "南部",
    Island: "島", region: "地區",
  },
}

/** locale에 맞는 areaLabel 선택 (CJK는 지명 토큰 현지화, L7). */
export function localizedAreaLabel(
  anchor: TourWeatherAnchor,
  locale: string,
): string {
  if (locale === "ko") return anchor.areaLabelKo
  const tokens = AREA_TOKENS[locale as "ja" | "zh" | "zh-TW"]
  if (!tokens) return anchor.areaLabel // en, es
  const translated = anchor.areaLabel
    .split(" · ")
    .map((seg) =>
      seg
        .split(/\s+/)
        .map((w) => tokens[w] ?? w)
        .filter(Boolean)
        .join(""),
    )
    .filter(Boolean)
    .join(" · ")
  return translated || anchor.areaLabel
}
