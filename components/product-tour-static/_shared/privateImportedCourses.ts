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
 * Host product slug → imported courses. The private charters opt in; every
 * other product returns null. `incheon-seoul-private-car-shore-excursion-cruise`
 * is deliberately absent — it has a real fixed shore-excursion itinerary of
 * its own, not invented meta routes.
 */
const PRIVATE_IMPORTED_COURSES: Record<string, readonly ImportedCourse[]> = {
  "jeju-island-private-car-charter-tour": JEJU_COURSES,
  "seoul-suburbs-private-chartered-car-10hr": SEOUL_COURSES,
  "busan-private-car-charter-cruise-shore": BUSAN_COURSES,
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
