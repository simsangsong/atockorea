/**
 * Category H — Conflicting / contradictory inputs (5 scenarios).
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const H_CONFLICTING: Scenario[] = [
  {
    id: "S081",
    category: "conflicting",
    query: "private group bus tour 5명",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "private vs bus_tour conflict — parser_notes should record.",
  },
  {
    id: "S082",
    category: "conflicting",
    query: "active relaxed pace senior couple",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "active vs relaxed conflict. Parser must pick one.",
  },
  {
    id: "S083",
    category: "conflicting",
    query: "budget premium luxury cheap Korea",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "budget vs premium conflict.",
  },
  {
    id: "S084",
    category: "conflicting",
    query: "indoor outdoor 다 좋아요 가족",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "indoor + outdoor neutral; family signal stays.",
  },
  {
    id: "S085",
    category: "conflicting",
    query: "wheelchair accessible 등산 트레킹",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      notes_must_contain: ["WHEELCHAIR_FILTER_APPLIED"],
    },
    rationale: "Wheelchair + trekking conflict — wheelchair gate dominates.",
  },
];
