/**
 * Category E — Season keyword only, no month (10 scenarios).
 *
 * The user named the phenomenon but gave no month. Behavior depends on today:
 *   - today is in the season's window → recommend the seasonal tour
 *   - today is off-season → reject (expect NO_MATCH or no seasonal in top-K)
 */

import { noSeasonalInTop, top1HasTag } from "./expectations-helpers";
import type { Scenario } from "./types";

export const E_SEASON_KEYWORD_ONLY: Scenario[] = [
  {
    id: "S051",
    category: "season_keyword_only",
    query: "벚꽃 보고싶어요",
    locale: "ko",
    today: { year: 2026, month: 4 },
    expectations: {
      must_include_one_of_tags: ["cherry_blossom"],
      top1_predicate: top1HasTag(["cherry_blossom", "spring_seasonal"]),
    },
    rationale: "April + cherry keyword (no month) → today fallback PASS.",
  },
  {
    id: "S052",
    category: "season_keyword_only",
    query: "벚꽃 보고싶어요",
    locale: "ko",
    today: { year: 2026, month: 7 },
    expectations: {
      must_not_include_tags: ["cherry_blossom"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "July + cherry keyword (no month) → today off-season → REJECT.",
  },
  {
    id: "S053",
    category: "season_keyword_only",
    query: "I want to see hydrangeas",
    locale: "en",
    today: { year: 2026, month: 6 },
    expectations: {
      must_include_one_of_tags: ["hydrangea", "hydrangea_festival"],
      top1_predicate: top1HasTag(["hydrangea", "hydrangea_festival"]),
    },
    rationale: "June + hydrangea (no month) → today fallback PASS.",
  },
  {
    id: "S054",
    category: "season_keyword_only",
    query: "I want to see hydrangeas",
    locale: "en",
    today: { year: 2026, month: 1 },
    expectations: {
      must_not_include_tags: ["hydrangea"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "January + hydrangea (no month) → today off-season → REJECT.",
  },
  {
    id: "S055",
    category: "season_keyword_only",
    query: "tangerine picking with kids",
    locale: "en",
    today: { year: 2026, month: 12 },
    expectations: {
      must_include_one_of_tags: ["tangerine", "tangerine_picking"],
      top1_predicate: top1HasTag(["tangerine", "tangerine_picking", "winter_seasonal"]),
    },
    rationale: "December + tangerine (no month) → today fallback PASS.",
  },
  {
    id: "S056",
    category: "season_keyword_only",
    query: "tangerine picking with kids",
    locale: "en",
    today: { year: 2026, month: 7 },
    expectations: {
      must_not_include_tags: ["tangerine"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "July + tangerine (no month) → today off-season → REJECT.",
  },
  {
    id: "S057",
    category: "season_keyword_only",
    query: "단풍 구경",
    locale: "ko",
    today: { year: 2026, month: 11 },
    expectations: {
      must_include_one_of_tags: ["autumn_foliage"],
      top1_predicate: top1HasTag(["autumn_foliage", "autumn_seasonal"]),
    },
    rationale: "November + foliage (no month) → today fallback PASS.",
  },
  {
    id: "S058",
    category: "season_keyword_only",
    query: "桜が見たい",
    locale: "ja",
    today: { year: 2026, month: 4 },
    expectations: {
      must_include_one_of_tags: ["cherry_blossom"],
      top1_predicate: top1HasTag(["cherry_blossom", "spring_seasonal"]),
    },
    rationale: "Japanese: 'want to see sakura' in April → PASS.",
  },
  {
    id: "S059",
    category: "season_keyword_only",
    query: "동백꽃 사진찍기",
    locale: "ko",
    today: { year: 2026, month: 1 },
    expectations: {
      must_include_one_of_tags: ["snow_camellia", "winter_camellia", "camellia"],
      top1_predicate: top1HasTag(["snow_camellia", "winter_camellia", "camellia", "winter_seasonal"]),
    },
    rationale: "January + camellia photoshoot → PASS.",
  },
  {
    id: "S060",
    category: "season_keyword_only",
    query: "桜",
    locale: "ja",
    today: { year: 2026, month: 8 },
    expectations: {
      must_not_include_tags: ["cherry_blossom"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "August + bare 桜 keyword → off-season REJECT.",
  },
];
