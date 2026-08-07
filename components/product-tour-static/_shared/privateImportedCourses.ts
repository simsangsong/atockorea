/**
 * Private-charter "imported course itineraries" config.
 *
 * The private charters' own itinerary sections were invented content: text-only
 * meta stops ("Route 1: …") plus placeholder sample slots (`privateSampleItinerary.ts`
 * — "일단 일정 슬롯만 만들고 import는 나중에"). This module is that import: the
 * charter pages now show REAL course products' rich itineraries (photo stop
 * cards + the shared TourStopDetailDrawer) behind a course pill switch, loaded
 * by slug from the static bundle registry. Because the import is by slug,
 * edits to the course products (their own pages) flow into the charter pages
 * with no copy step — and only tours that actually exist are offered.
 *
 * The old sample-itinerary config stays in code (per direction "내리고, 삭제는
 * 말고") — products absent from THIS map keep rendering it unchanged.
 */

import type { PrivateLocale } from "./privateSampleItinerary";
import { STATIC_TOUR_PRODUCT_BUNDLE_SLUGS } from "./tourProductBundleSlugs";

export type ImportedCourse = {
  /** Stable per-host course id — the pill switch's value. */
  id: string;
  /**
   * Registered static-bundle slug whose itinerary (stops + drawer content) is
   * imported as-is. Must exist in `tourProductBundleSlugs.ts` — the unit test
   * enforces this so a renamed course product fails loudly instead of
   * rendering an empty course tab.
   */
  slug: string;
  /** Course-switch pill label, per content locale. Kept short — 3–4 pills must fit. */
  chipLabel: Record<PrivateLocale, string>;
};

const JEJU_COURSES: readonly ImportedCourse[] = [
  {
    id: "south",
    slug: "jeju-southern-top-unesco-spots-tour",
    chipLabel: {
      ko: "남부",
      en: "South",
      ja: "南部",
      zh: "南部",
      "zh-TW": "南部",
      es: "Sur",
    },
  },
  {
    id: "southwest",
    slug: "southwest-hallasan-osulloc-aewol",
    chipLabel: {
      ko: "서남부",
      en: "Southwest",
      ja: "南西部",
      zh: "西南部",
      "zh-TW": "西南部",
      es: "Suroeste",
    },
  },
  {
    id: "east",
    slug: "east-signature-nature-core",
    chipLabel: {
      ko: "동부",
      en: "East",
      ja: "東部",
      zh: "东部",
      "zh-TW": "東部",
      es: "Este",
    },
  },
];

const SEOUL_COURSES: readonly ImportedCourse[] = [
  {
    id: "gapyeong",
    slug: "seoul-private-nami-morning-calm-petite-france",
    chipLabel: {
      ko: "가평",
      en: "Gapyeong",
      ja: "加平",
      zh: "加平",
      "zh-TW": "加平",
      es: "Gapyeong",
    },
  },
  {
    id: "dmz",
    slug: "seoul-dmz-private-3rd-tunnel-suspension-bridge",
    chipLabel: {
      ko: "DMZ",
      en: "DMZ",
      ja: "DMZ",
      zh: "非军事区",
      "zh-TW": "非軍事區",
      es: "DMZ",
    },
  },
  {
    id: "suwon",
    slug: "seoul-suwon-hwaseong-folk-village-starfield-library",
    chipLabel: {
      ko: "수원·민속촌",
      en: "Suwon",
      ja: "水原",
      zh: "水原",
      "zh-TW": "水原",
      es: "Suwon",
    },
  },
  {
    id: "pocheon",
    slug: "pocheon-sanjeong-lake-herb-island-art-valley",
    chipLabel: {
      ko: "포천",
      en: "Pocheon",
      ja: "抱川",
      zh: "抱川",
      "zh-TW": "抱川",
      es: "Pocheon",
    },
  },
];

const BUSAN_COURSES: readonly ImportedCourse[] = [
  {
    // Owner 2026-08-07: the charter should offer the tours we already sell —
    // "일일투어, 스몰그룹투어, 기항지 투어 등등". The day tour, Gyeongju and
    // Tongdosa were here; the shore excursion and the small-group tour, the two
    // the charter's own buyers are most likely to be comparing against, were not.
    id: "cruise-shore",
    slug: "busan-cruise-shore-excursion-bus-tour",
    chipLabel: {
      ko: "기항지",
      en: "Shore day",
      ja: "寄港地",
      zh: "岸上观光",
      "zh-TW": "岸上觀光",
      es: "Escala",
    },
  },
  {
    // The Yonggungsa / Sky Capsule / Gamcheon course. Deliberately NOT
    // `busan-small-group-sightseeing-tour-cruise-passengers`: since the listing
    // alignment that product runs the identical nine stops as the shore
    // excursion above, so it would render a duplicate tab.
    id: "small-group",
    slug: "busan-small-group-yonggungsa-skycapsule-gamcheon-tour",
    chipLabel: {
      ko: "스몰그룹",
      en: "Small group",
      ja: "少人数",
      zh: "小团",
      "zh-TW": "小團",
      es: "Grupo reducido",
    },
  },
  {
    id: "busan-city",
    slug: "busan-top-attractions-day-tour",
    chipLabel: {
      ko: "부산 시내",
      en: "Busan city",
      ja: "釜山市内",
      zh: "釜山市区",
      "zh-TW": "釜山市區",
      es: "Ciudad de Busan",
    },
  },
  {
    id: "gyeongju",
    slug: "from-busan-gyeongju-ancient-capital-day-tour",
    chipLabel: {
      ko: "경주",
      en: "Gyeongju",
      ja: "慶州",
      zh: "庆州",
      "zh-TW": "慶州",
      es: "Gyeongju",
    },
  },
  {
    id: "outskirts",
    slug: "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour",
    chipLabel: {
      ko: "통도사·근교",
      en: "Tongdosa",
      ja: "通度寺",
      zh: "通度寺",
      "zh-TW": "通度寺",
      es: "Tongdosa",
    },
  },
];

/**
 * Owner 2026-08-07, on the Incheon shore charter: *"인천크루즈터미널에서 픽업,
 * 광화문, 인사동, 광장시장 그리고 다시 인천 복귀 혹은 서울시내 호텔 드롭"*.
 *
 * That is the course our own Incheon shore excursion already runs — terminal
 * pickup, Gyeongbokgung (whose main gate is Gwanghwamun), Bukchon and Insa-dong,
 * lunch at Gwangjang Market, back to the terminal — so it is imported rather
 * than retyped. Until now this product fell through to `seoulConfig()`, which
 * opens with "Hotel pickup (default)" and five "Stop to be added" slots: wrong
 * twice over on a cruise SKU, and only visible by opening the page.
 */
const INCHEON_COURSES: readonly ImportedCourse[] = [
  {
    id: "seoul-classic",
    slug: "from-incheon-seoul-day-tour-cruise-guests",
    chipLabel: {
      ko: "서울 도심",
      en: "Seoul city",
      ja: "ソウル都心",
      zh: "首尔市区",
      "zh-TW": "首爾市區",
      es: "Centro de Seúl",
    },
  },
];

/**
 * Host product slug → imported courses. The private charters opt in; every
 * other product returns null.
 */
const PRIVATE_IMPORTED_COURSES: Record<string, readonly ImportedCourse[]> = {
  "jeju-island-private-car-charter-tour": JEJU_COURSES,
  "seoul-suburbs-private-chartered-car-10hr": SEOUL_COURSES,
  "busan-private-car-charter-cruise-shore": BUSAN_COURSES,
  "incheon-seoul-private-car-shore-excursion-cruise": INCHEON_COURSES,
};

export function getPrivateImportedCourses(
  slug: string,
): readonly ImportedCourse[] | null {
  const courses = PRIVATE_IMPORTED_COURSES[slug] ?? null;
  if (!courses) return null;
  // Fail-closed at the config layer: a course whose bundle slug disappeared
  // (product renamed/removed) is dropped rather than rendered as a dead tab.
  const alive = courses.filter((c) => STATIC_TOUR_PRODUCT_BUNDLE_SLUGS.has(c.slug));
  return alive.length > 0 ? alive : null;
}
