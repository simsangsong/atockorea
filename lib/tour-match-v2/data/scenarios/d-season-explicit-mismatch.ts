/**
 * Category D — Explicit season + WRONG month (10 scenarios).
 *
 * The user named both a phenomenon AND a month, and the month is outside
 * the phenomenon's natural window. The matcher MUST NOT recommend any
 * tour with that phenomenon — this is the hardcoded contradiction rule.
 *
 * Expected response status: NO_MATCH (or top-K empty of seasonal tours).
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop } from "./expectations-helpers";
import type { Scenario } from "./types";

export const D_SEASON_EXPLICIT_MISMATCH: Scenario[] = [
  {
    id: "S031",
    category: "season_explicit_mismatch",
    query: "5월 벚꽃 보고싶어요",
    locale: "ko",
    today: { year: 2026, month: 5 },
    expectations: {
      must_not_include_tags: ["cherry_blossom", "plum_blossom", "spring_seasonal"],
      top1_predicate: noSeasonalInTop,
      // Either NO_MATCH (no evergreen alternatives surfaced) or a non-seasonal top1.
      // Currently we accept either — the hard rule is NO seasonal leakage.
    },
    rationale: "Cherry blooms Mar-Apr; user said May → seasonal-gate must reject all cherry tours.",
    bug_ref: ["bug-3"],
  },
  {
    id: "S032",
    category: "season_explicit_mismatch",
    query: "December cherry blossom honeymoon",
    locale: "en",
    today: { year: 2026, month: 12 },
    expectations: {
      must_not_include_tags: ["cherry_blossom"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Cherry in December — impossible. Hardcoded rejection.",
    bug_ref: ["bug-3"],
  },
  {
    id: "S033",
    category: "season_explicit_mismatch",
    query: "August snow camellia tour",
    locale: "en",
    today: { year: 2026, month: 8 },
    expectations: {
      must_not_include_tags: ["snow_camellia", "winter_camellia", "winter_seasonal"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Snow/camellia peak Dec-Feb; August is summer.",
  },
  {
    id: "S034",
    category: "season_explicit_mismatch",
    query: "January hydrangea festival",
    locale: "en",
    today: { year: 2026, month: 1 },
    expectations: {
      must_not_include_tags: ["hydrangea", "hydrangea_festival"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Hydrangea Jun-Jul; January is winter.",
  },
  {
    id: "S035",
    category: "season_explicit_mismatch",
    query: "7월 단풍 보러",
    locale: "ko",
    today: { year: 2026, month: 7 },
    expectations: {
      must_not_include_tags: ["autumn_foliage", "autumn_seasonal"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Autumn foliage Oct-Nov; July is monsoon.",
  },
  {
    id: "S036",
    category: "season_explicit_mismatch",
    query: "3月 みかん 狩り 家族",
    locale: "ja",
    today: { year: 2026, month: 3 },
    expectations: {
      must_not_include_tags: ["tangerine", "tangerine_picking"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Tangerine Nov-Feb; March is post-season.",
  },
  {
    id: "S037",
    category: "season_explicit_mismatch",
    query: "6月 櫻花 賞花",
    locale: "zh-TW",
    today: { year: 2026, month: 6 },
    expectations: {
      must_not_include_tags: ["cherry_blossom"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Cherry in June — impossible (Trad-Chinese phrasing).",
  },
  {
    id: "S038",
    category: "season_explicit_mismatch",
    query: "10월 벚꽃 가족 제주",
    locale: "ko",
    today: { year: 2026, month: 10 },
    expectations: {
      must_not_include_tags: ["cherry_blossom"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Cherry in October — impossible.",
  },
  {
    id: "S039",
    category: "season_explicit_mismatch",
    query: "September snow Jeju winter scenery",
    locale: "en",
    today: { year: 2026, month: 9 },
    expectations: {
      must_not_include_tags: ["snow", "snow_camellia", "winter_seasonal"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Snow in September — Korea has none.",
  },
  {
    id: "S040",
    category: "season_explicit_mismatch",
    query: "April hallabong tangerine picking",
    locale: "en",
    today: { year: 2026, month: 4 },
    expectations: {
      must_not_include_tags: ["tangerine", "tangerine_picking"],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Tangerine peaks Nov-Feb; April is post-season.",
  },
];
