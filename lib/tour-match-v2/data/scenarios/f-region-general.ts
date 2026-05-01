/**
 * Category F — Region + general intent (10 scenarios).
 *
 * Tests that region-anchored queries with no temporal signal produce the
 * region's evergreen products and never leak seasonal Jeju tours.
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop, top1Region } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const F_REGION_GENERAL: Scenario[] = [
  {
    id: "S061",
    category: "region_general",
    query: "Jeju family day tour",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Jeju + family day → evergreen Jeju tour.",
  },
  {
    id: "S062",
    category: "region_general",
    query: "Seoul cultural one day private",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("seoul"),
    },
    rationale: "Seoul + cultural + private. No seasonal expected.",
  },
  {
    id: "S063",
    category: "region_general",
    query: "Busan beach private car",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Busan beach + format. No seasonal.",
  },
  {
    id: "S064",
    category: "region_general",
    query: "경주 역사 답사 1일",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Gyeongju historical tour day.",
  },
  {
    id: "S065",
    category: "region_general",
    query: "DMZ tour from Seoul",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "DMZ tour, year-round.",
  },
  {
    id: "S066",
    category: "region_general",
    query: "남이섬 가평 1일",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Nami island Gapyeong day.",
  },
  {
    id: "S067",
    category: "region_general",
    query: "Jeju east day trip private car",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Sub-region 'east Jeju' + private car. No seasonal.",
  },
  {
    id: "S068",
    category: "region_general",
    query: "수원 화성 행궁 가족",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Suwon Hwaseong fortress family. Cultural, evergreen.",
  },
  {
    id: "S069",
    category: "region_general",
    query: "韓國 首爾 文化體驗 半日",
    locale: "zh-TW",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Trad-Chinese: Seoul cultural half day.",
  },
  {
    id: "S070",
    category: "region_general",
    query: "Jeju southwest coast cafe scenic",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Sub-region + theme; no temporal signal → evergreen.",
  },
];
