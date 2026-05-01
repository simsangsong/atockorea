/**
 * Category G — Persona-driven queries (10 scenarios).
 *
 * Tests persona alignment without seasonal leakage.
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop, top1BestForOneOf } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const G_PERSONA_FOCUS: Scenario[] = [
  {
    id: "S071",
    category: "persona_focus",
    query: "honeymoon couple romantic Jeju",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1BestForOneOf(["honeymooners", "couples", "couples_on_budget", "senior_couples"]),
    },
    rationale: "Honeymoon + Jeju (evergreen) → couple-fit tour.",
  },
  {
    id: "S072",
    category: "persona_focus",
    query: "부모님 모시고 가는 제주 여행 70대",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1BestForOneOf([
        "senior_couples",
        "seniors",
        "senior_active",
        "families",
        "small_families",
        "family_with_teens",
      ]),
    },
    rationale: "70-something parents Jeju → senior-fit tour.",
  },
  {
    id: "S073",
    category: "persona_focus",
    query: "small kids family Seoul stroller friendly",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Toddler-friendly Seoul. Stroller fit.",
  },
  {
    id: "S074",
    category: "persona_focus",
    query: "solo traveler photographer Jeju east",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Solo photographer; evergreen.",
  },
  {
    id: "S075",
    category: "persona_focus",
    query: "친구 4명 부산 1일 액티브",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "4 friends Busan active day.",
  },
  {
    id: "S076",
    category: "persona_focus",
    query: "wheelchair accessible tour Korea",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
      notes_must_contain: ["WHEELCHAIR_FILTER_APPLIED"],
    },
    rationale: "Wheelchair = hard constraint, must be applied.",
  },
  {
    id: "S077",
    category: "persona_focus",
    query: "韓国 学生 修学旅行 ソウル",
    locale: "ja",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Japanese: school field trip Seoul.",
  },
  {
    id: "S078",
    category: "persona_focus",
    query: "couple anniversary romantic dinner cafe Jeju",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Anniversary couple cafe. No season expected.",
  },
  {
    id: "S079",
    category: "persona_focus",
    query: "cruise passengers from Jeju port 4 hours",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Cruise intent should select cruise-flagged tour.",
  },
  {
    id: "S080",
    category: "persona_focus",
    query: "할랄 식사 가능한 가족 투어 서울",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      notes_must_contain: ["FREE_MEAL_POLICY"],
    },
    rationale: "Halal hard constraint Seoul family.",
  },
];
