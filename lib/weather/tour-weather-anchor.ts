/**
 * 투어 슬러그 → 대표 명소 좌표 매핑.
 * `/api/weather/forecast?slug=<slug>` 요청 시 해당 지역의 실시간 날씨를 가져온다.
 *
 * 좌표는 각 투어의 대표 명소(또는 시·군 중심)이며, areaLabel은 라이브 날씨 띠에
 * 노출되는 지역명. KO와 EN 라벨을 함께 보관해 locale에 맞게 응답한다.
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
  latitude: 33.4594,
  longitude: 126.9427,
  areaLabel: "East Jeju region",
  areaLabelKo: "제주 동쪽 지역",
}

/** 한림읍 일대 (서남쪽 투어 기준점) */
export const WEATHER_ANCHOR_SOUTHWEST_HALLIM: TourWeatherAnchor = {
  latitude: 33.4097,
  longitude: 126.2716,
  areaLabel: "Hallim area",
  areaLabelKo: "한림 일대",
}

/** Slug → 대표 명소 좌표. 신규 투어 추가 시 이 맵만 갱신하면 된다. */
export const TOUR_WEATHER_ANCHORS: Record<string, TourWeatherAnchor> = {
  // ── Jeju ────────────────────────────────────────────────
  "east-signature-nature-core": WEATHER_ANCHOR_EAST_SEONGSAN,
  "jeju-eastern-unesco-spots-day-tour": {
    latitude: 33.4594,
    longitude: 126.9427,
    areaLabel: "East Jeju region",
    areaLabelKo: "제주 동쪽 지역",
  },
  "jeju-cherry-blossom-tour-east-route": {
    latitude: 33.4594,
    longitude: 126.9427,
    areaLabel: "East Jeju region",
    areaLabelKo: "제주 동쪽 지역",
  },
  "jeju-hydrangea-festival-tour-east-route": {
    latitude: 33.4594,
    longitude: 126.9427,
    areaLabel: "East Jeju region",
    areaLabelKo: "제주 동쪽 지역",
  },
  "jeju-cruise-shore-excursion-bus-tour": {
    latitude: 33.5184,
    longitude: 126.5219,
    areaLabel: "Jeju City",
    areaLabelKo: "제주시",
  },
  "jeju-cruise-shore-excursion-small-group-tour": {
    latitude: 33.5184,
    longitude: 126.5219,
    areaLabel: "Jeju City",
    areaLabelKo: "제주시",
  },
  "jeju-grand-highlights-loop": {
    latitude: 33.4996,
    longitude: 126.5312,
    areaLabel: "Jeju Island",
    areaLabelKo: "제주 전역",
  },
  "jeju-island-private-car-charter-tour": {
    latitude: 33.4996,
    longitude: 126.5312,
    areaLabel: "Jeju Island",
    areaLabelKo: "제주 전역",
  },
  "jeju-southern-top-unesco-spots-tour": {
    latitude: 33.2541,
    longitude: 126.5601,
    areaLabel: "Seogwipo",
    areaLabelKo: "서귀포",
  },
  "jeju-west-south-full-day-authentic-tour": {
    latitude: 33.3942,
    longitude: 126.2400,
    areaLabel: "Hallim · Hyeopjae",
    areaLabelKo: "한림·협재 일대",
  },
  "jeju-hydrangea-festival-tour-southwest-route": {
    latitude: 33.3942,
    longitude: 126.2400,
    areaLabel: "Hallim · Hyeopjae",
    areaLabelKo: "한림·협재 일대",
  },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": {
    latitude: 33.3092,
    longitude: 126.3000,
    areaLabel: "Southwest Jeju",
    areaLabelKo: "제주 서남쪽",
  },
  "southwest-hallasan-osulloc-aewol": {
    latitude: 33.4082,
    longitude: 126.3245,
    areaLabel: "West Jeju · Aewol",
    areaLabelKo: "제주 서쪽·애월",
  },

  // ── Busan · Gyeongju · Yangsan ──────────────────────────
  "busan-gyeongju-unesco-legacy-tour-national-museum": {
    latitude: 35.8285,
    longitude: 129.2271,
    areaLabel: "Gyeongju",
    areaLabelKo: "경주",
  },
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": {
    latitude: 35.8480,
    longitude: 129.2543,
    areaLabel: "Gyeongju",
    areaLabelKo: "경주",
  },
  "from-busan-gyeongju-ancient-capital-day-tour": {
    latitude: 35.7898,
    longitude: 129.3320,
    areaLabel: "Gyeongju",
    areaLabelKo: "경주",
  },
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": {
    latitude: 35.4880,
    longitude: 129.0584,
    areaLabel: "Yangsan",
    areaLabelKo: "양산",
  },
  "busan-private-car-charter-cruise-shore": {
    latitude: 35.0975,
    longitude: 129.0388,
    areaLabel: "Busan",
    areaLabelKo: "부산",
  },
  "busan-small-group-sightseeing-tour-cruise-passengers": {
    latitude: 35.1586,
    longitude: 129.1604,
    areaLabel: "Busan",
    areaLabelKo: "부산",
  },
  "busan-top-attractions-day-tour": {
    latitude: 35.1586,
    longitude: 129.1604,
    areaLabel: "Busan",
    areaLabelKo: "부산",
  },

  // ── Seoul · Incheon · Gyeonggi · Gangwon ────────────────
  "from-incheon-seoul-day-tour-cruise-guests": {
    latitude: 37.5780,
    longitude: 126.9770,
    areaLabel: "Seoul",
    areaLabelKo: "서울",
  },
  "incheon-seoul-private-car-shore-excursion-cruise": {
    latitude: 37.5780,
    longitude: 126.9770,
    areaLabel: "Seoul",
    areaLabelKo: "서울",
  },
  "seoul-suburbs-private-chartered-car-10hr": {
    latitude: 37.5780,
    longitude: 126.9770,
    areaLabel: "Seoul",
    areaLabelKo: "서울",
  },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": {
    latitude: 37.9650,
    longitude: 126.6936,
    areaLabel: "Paju DMZ",
    areaLabelKo: "파주 DMZ",
  },
  "seoul-private-nami-morning-calm-petite-france": {
    latitude: 37.7895,
    longitude: 127.5256,
    areaLabel: "Nami Island",
    areaLabelKo: "남이섬",
  },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": {
    latitude: 38.1196,
    longitude: 128.4655,
    areaLabel: "Seoraksan · Sokcho",
    areaLabelKo: "설악산·속초",
  },
  "seoul-suwon-hwaseong-folk-village-starfield-library": {
    latitude: 37.2851,
    longitude: 127.0094,
    areaLabel: "Suwon",
    areaLabelKo: "수원",
  },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": {
    latitude: 37.2851,
    longitude: 127.0094,
    areaLabel: "Suwon · Gwangmyeong",
    areaLabelKo: "수원·광명",
  },
  "seoul-suwon-hwaseong-waujeongsa-starfield": {
    latitude: 37.2851,
    longitude: 127.0094,
    areaLabel: "Suwon · Yongin",
    areaLabelKo: "수원·용인",
  },
  "pocheon-sanjeong-lake-herb-island-art-valley": {
    latitude: 38.0319,
    longitude: 127.3243,
    areaLabel: "Pocheon",
    areaLabelKo: "포천",
  },
}

/** Slug 기반 조회. 모르는 슬러그는 동쪽 앵커로 폴백(기존 동작 유지). */
export function resolveTourWeatherAnchorBySlug(
  slug: string | null | undefined,
): TourWeatherAnchor {
  if (!slug) return WEATHER_ANCHOR_EAST_SEONGSAN
  return TOUR_WEATHER_ANCHORS[slug] ?? WEATHER_ANCHOR_EAST_SEONGSAN
}

/** locale에 맞는 areaLabel 선택. */
export function localizedAreaLabel(
  anchor: TourWeatherAnchor,
  locale: string,
): string {
  return locale === "ko" ? anchor.areaLabelKo : anchor.areaLabel
}
