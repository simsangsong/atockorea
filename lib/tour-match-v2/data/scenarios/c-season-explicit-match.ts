/**
 * Category C — Explicit season + matching month (10 scenarios).
 *
 * The user named both the phenomenon AND a month inside its window.
 * Top-1 should be a seasonal tour matching the phenomenon.
 */

import { top1HasTag } from "./expectations-helpers";
import type { Scenario } from "./types";

export const C_SEASON_EXPLICIT_MATCH: Scenario[] = [
  {
    id: "S041",
    category: "season_explicit_match",
    query: "벚꽃 4월 제주",
    locale: "ko",
    today: { year: 2026, month: 4 },
    expectations: {
      must_include_one_of_tags: ["cherry_blossom"],
      top1_predicate: top1HasTag(["cherry_blossom", "spring_seasonal"]),
    },
    rationale: "April + cherry + Jeju → cherry tour expected as top-1.",
  },
  {
    id: "S042",
    category: "season_explicit_match",
    query: "March cherry blossom Korea family",
    locale: "en",
    today: { year: 2026, month: 3 },
    expectations: {
      must_include_one_of_tags: ["cherry_blossom"],
      top1_predicate: top1HasTag(["cherry_blossom", "spring_seasonal"]),
    },
    rationale: "March cherry — peak season.",
  },
  {
    id: "S043",
    category: "season_explicit_match",
    query: "hydrangea festival in late June",
    locale: "en",
    today: { year: 2026, month: 6 },
    expectations: {
      must_include_one_of_tags: ["hydrangea", "hydrangea_festival"],
      top1_predicate: top1HasTag(["hydrangea", "hydrangea_festival"]),
    },
    rationale: "June hydrangea peak.",
  },
  {
    id: "S044",
    category: "season_explicit_match",
    query: "12월 감귤 가족 제주",
    locale: "ko",
    today: { year: 2026, month: 12 },
    expectations: {
      must_include_one_of_tags: ["tangerine", "tangerine_picking"],
      top1_predicate: top1HasTag(["tangerine", "tangerine_picking", "winter_seasonal"]),
    },
    rationale: "December tangerine — winter harvest peak.",
  },
  {
    id: "S045",
    category: "season_explicit_match",
    query: "10월 단풍 한국 부모님",
    locale: "ko",
    today: { year: 2026, month: 10 },
    expectations: {
      must_include_one_of_tags: ["autumn_foliage"],
      top1_predicate: top1HasTag(["autumn_foliage", "autumn_seasonal"]),
    },
    rationale: "October foliage — peak month.",
  },
  {
    id: "S046",
    category: "season_explicit_match",
    query: "January snow camellia Jeju couple",
    locale: "en",
    today: { year: 2026, month: 1 },
    expectations: {
      must_include_one_of_tags: ["snow_camellia", "winter_camellia", "camellia"],
      top1_predicate: top1HasTag(["snow_camellia", "winter_camellia", "camellia", "winter_seasonal"]),
    },
    rationale: "January snow + camellia — winter peak.",
  },
  {
    id: "S047",
    category: "season_explicit_match",
    query: "4月 桜 韓国 ファミリー",
    locale: "ja",
    today: { year: 2026, month: 4 },
    expectations: {
      must_include_one_of_tags: ["cherry_blossom"],
      top1_predicate: top1HasTag(["cherry_blossom", "spring_seasonal"]),
    },
    rationale: "Japanese: April cherry family Korea.",
  },
  {
    id: "S048",
    category: "season_explicit_match",
    query: "2월 매화 부산",
    locale: "ko",
    today: { year: 2026, month: 2 },
    expectations: {
      must_include_one_of_tags: ["plum_blossom"],
      top1_predicate: top1HasTag(["plum_blossom", "spring_seasonal"]),
    },
    rationale: "February plum — early spring.",
  },
  {
    id: "S049",
    category: "season_explicit_match",
    query: "11月 紅葉 韓國",
    locale: "zh-TW",
    today: { year: 2026, month: 11 },
    expectations: {
      must_include_one_of_tags: ["autumn_foliage"],
      top1_predicate: top1HasTag(["autumn_foliage", "autumn_seasonal"]),
    },
    rationale: "Chinese: November foliage Korea.",
  },
  {
    id: "S050",
    category: "season_explicit_match",
    query: "April canola flowers Jeju",
    locale: "en",
    today: { year: 2026, month: 4 },
    expectations: {
      must_include_one_of_tags: ["canola_flower", "cherry_blossom"],
      top1_predicate: top1HasTag(["canola_flower", "cherry_blossom", "spring_seasonal"]),
    },
    rationale: "April canola — often paired with cherry tours.",
  },
];
