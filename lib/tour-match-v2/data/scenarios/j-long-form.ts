/**
 * Category J — Long-form / detailed input (5 scenarios).
 *
 * 200+ char queries describing trip context. Parser must extract the
 * dominant signals and apply seasonal-gate correctly.
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop } from "./expectations-helpers";
import type { Scenario } from "./types";

export const J_LONG_FORM: Scenario[] = [
  {
    id: "S101_remap_S091",
    // NOTE: collisions with multilingual were avoided; this id is purely a
    // human label — the runner uses a content-based slug if id collides.
    category: "long_form",
    query:
      "We're a family of 4 with two teenagers traveling end of October. We want to see autumn foliage but also some cultural sites like temples. We have one full day in Jeju and prefer a private car tour with no shopping stops. The kids get carsick so frequent breaks are good. Budget is mid-range, around 400 USD total.",
    locale: "en",
    today: { year: 2026, month: 10 },
    expectations: {
      must_include_one_of_tags: ["autumn_foliage"],
      must_not_include_tags: ["cherry_blossom", "hydrangea", "snow_camellia"],
    },
    rationale: "October + autumn foliage + family-of-4 + private car + Jeju + no shopping. Foliage season legitimate.",
  },
  {
    id: "S102",
    category: "long_form",
    query:
      "I'm planning a honeymoon trip to Korea in mid-May with my wife. We want a relaxed pace, lots of cafes and scenic photo spots, ideally on Jeju but open to suggestions. We're not interested in flowers or seasonal stuff, just a romantic day with great views. Private car preferred.",
    locale: "en",
    today: { year: 2026, month: 5 },
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Honeymoon May + explicit 'NOT interested in flowers' → strict no-seasonal.",
  },
  {
    id: "S103",
    category: "long_form",
    query:
      "한국에 처음 가는 50대 부모님이랑 어머니께서 무릎이 안 좋으셔서 오래 걷기 어려우세요. 6월 말이라 더위 조금 있지만 자연도 보고 카페도 들리고 싶어요. 제주 동부 1박 2일 정도 생각하고 있고 비 오면 실내 대안도 있으면 좋겠어요.",
    locale: "ko",
    today: { year: 2026, month: 6 },
    expectations: {
      must_not_include_tags: ["cherry_blossom", "snow_camellia"],
      notes_must_contain: ["MULTI_DAY_REQUEST"],
    },
    rationale:
      "Korean: senior parents low mobility + Jeju east + late June + 1박2일 + rain backup. Multi-day note expected.",
  },
  {
    id: "S104",
    category: "long_form",
    query:
      "Cruise ship docked at Busan port from 9am to 4:30pm. We have just one shore excursion day, four adults, want to see Gamcheon and Haedong Yonggungsa, but also worried about reboarding on time. Need a private car with English-speaking driver.",
    locale: "en",
    today: { year: 2026, month: 5 },
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Cruise + Busan + anchor POIs + English-speaking + reboarding constraint.",
  },
  {
    id: "S105",
    category: "long_form",
    query:
      "친구 둘이서 서울 갈 건데, 일정은 빡빡해도 괜찮아요. 액티브하게 도깨비 촬영지, 광화문, 북촌 한옥마을 다 돌고 싶고 저녁엔 한강 야경도 보고 싶어요. 11월 중순쯤 갈 거고 단풍 끝물이라 큰 기대는 없어요.",
    locale: "ko",
    today: { year: 2026, month: 11 },
    expectations: {
      // Foliage in Nov is in window so cannot strictly forbid; user said "끝물" = late
      // → matcher is allowed to include foliage tour OR evergreen Seoul cultural.
      must_not_include_tags: ["cherry_blossom", "hydrangea", "snow_camellia"],
    },
    rationale: "Korean: 2 friends Seoul active drama-spots November mid + foliage 'late season'.",
  },
];
