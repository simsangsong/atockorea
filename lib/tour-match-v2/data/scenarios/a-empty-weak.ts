/**
 * Category A — Empty / weak input (10 scenarios).
 *
 * Goal: response should be INSUFFICIENT_INPUT or WEAK_MATCH with strictly
 * evergreen products. No seasonal leakage, no random "matching_profile_size"
 * tie-break disguised as a recommendation.
 *
 * Note: the API guard (route.ts:49) rejects empty strings with HTTP 400, so
 * S041 uses an explicit single space + non-meaningful word that passes the
 * guard but carries zero signal.
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const A_EMPTY_WEAK: Scenario[] = [
  {
    id: "S001",
    category: "empty_weak",
    query: "tours",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Single noun, zero signal — INSUFFICIENT_INPUT.",
    bug_ref: ["bug-2"],
  },
  {
    id: "S002",
    category: "empty_weak",
    query: "추천해줘",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Korean 'recommend' verb only, no nouns.",
    bug_ref: ["bug-2"],
  },
  {
    id: "S003",
    category: "empty_weak",
    query: "Korea trip",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Generic country mention. Should fall to weak/empty class.",
  },
  {
    id: "S004",
    category: "empty_weak",
    query: "여행",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Korean 'trip' word alone.",
  },
  {
    id: "S005",
    category: "empty_weak",
    query: "best tour",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Empty superlative.",
  },
  {
    id: "S006",
    category: "empty_weak",
    query: "관광",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Korean 'sightseeing' single word.",
  },
  {
    id: "S007",
    category: "empty_weak",
    query: "ツアー",
    locale: "ja",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Japanese 'tour' single word.",
  },
  {
    id: "S008",
    category: "empty_weak",
    query: "旅游",
    locale: "zh-CN",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Simplified Chinese 'travel' single word.",
  },
  {
    id: "S009",
    category: "empty_weak",
    query: "vacation",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "English 'vacation' alone.",
  },
  {
    id: "S010",
    category: "empty_weak",
    query: "what should I do",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Open-ended question with no concrete signals.",
  },
];
