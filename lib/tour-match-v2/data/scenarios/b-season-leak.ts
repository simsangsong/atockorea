/**
 * Category B — Season-leak negative tests (15 scenarios).
 *
 * Pattern: queries with NO month and NO seasonal phenomenon keyword. The
 * matcher MUST NOT recommend any seasonal product (cherry blossom, hydrangea,
 * tangerine, snow camellia, autumn foliage). This is the bug the user
 * directly reported: "scenic, nature cafe" → cherry blossom recommended.
 *
 * All scenarios pin today=2026-05-01 (May) so seasonal tours are clearly
 * out-of-season; the gate must reject regardless of fit-score boosts.
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const B_SEASON_LEAK: Scenario[] = [
  {
    id: "S016",
    category: "season_leak",
    query: "scenic nature cafe",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Reproduces the user-reported bug: themes only, no temporal signal → no cherry tours.",
    bug_ref: ["bug-1"],
  },
  {
    id: "S017",
    category: "season_leak",
    query: "family scenic photogenic Jeju day trip",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Region + persona + soft themes; no temporal signal → evergreen only.",
  },
  {
    id: "S018",
    category: "season_leak",
    query: "문화 체험 1일투어",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Korean cultural day trip — no season signal, must stay seasonal-free.",
  },
  {
    id: "S019",
    category: "season_leak",
    query: "private car tour Korea mid-range budget",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Format + budget signals only; no seasonal expectation.",
  },
  {
    id: "S020",
    category: "season_leak",
    query: "iconic landmarks Seoul one day",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Iconic + region; the matcher must not pad results with seasonal Jeju tours.",
  },
  {
    id: "S021",
    category: "season_leak",
    query: "오설록 녹차밭 보고싶어요",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Anchor POI signal (Osulloc tea) — not a flower, must not leak cherry tours.",
  },
  {
    id: "S022",
    category: "season_leak",
    query: "relaxed pace senior parents Korea",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Pace + persona; mobility-focused tour, never seasonal.",
  },
  {
    id: "S023",
    category: "season_leak",
    query: "釜山 一日游 私家车",
    locale: "zh-CN",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Chinese: Busan day trip, private car. No season signal.",
  },
  {
    id: "S024",
    category: "season_leak",
    query: "rainy day backup plan Jeju",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Rain hint — should boost rain_fit, not seasonal flower products.",
  },
  {
    id: "S025",
    category: "season_leak",
    query: "honeymoon couple romantic photo spots",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Honeymoon persona — couple_fit boost, NOT cherry blossom by default.",
  },
  {
    id: "S026",
    category: "season_leak",
    query: "weekend family activity",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Generic family activity, no Korea region, no time. Must not leak seasonal.",
  },
  {
    id: "S027",
    category: "season_leak",
    query: "한라산 등산",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Anchor POI (Hallasan hike) — should match active hiking tours, not seasonal.",
  },
  {
    id: "S028",
    category: "season_leak",
    query: "韓國 親子游 一日",
    locale: "zh-TW",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Traditional Chinese: family day trip Korea. No season.",
  },
  {
    id: "S029",
    category: "season_leak",
    query: "대절 차량으로 자유 일정",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Charter intent — should match charter tours, never seasonal flowers.",
  },
  {
    id: "S030",
    category: "season_leak",
    query: "K-drama filming locations",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Theme: drama tourism. Cherry blossom drama scenes don't justify seasonal recommendation in May.",
  },
  // Cruise-leak negative tests — verify is_cruise_excursion hard filter
  // (matcher.ts:103-106) doesn't surface shore-excursion tours when the
  // user never mentioned cruise/shore intent. This catches regressions to
  // the wants_cruise gate.
  {
    id: "S111",
    category: "season_leak",
    query: "Busan day tour family kids",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_slugs: [
        "busan-cruise-shore-excursion",
        "busan-shore-excursion",
        "jeju-cruise-shore-excursion",
      ],
      top1_predicate: (m, all) => {
        for (const x of all) {
          if (x.slug.includes("cruise") || x.slug.includes("shore-excursion")) {
            return `cruise/shore-excursion leaked in slug=${x.slug}`;
          }
        }
        return null;
      },
    },
    rationale: "Busan family day — no cruise/shore intent. Cruise-flagged tours must be hard-rejected.",
  },
  {
    id: "S112",
    category: "season_leak",
    query: "제주 가족 여행 1일",
    locale: "ko",
    today: TODAY,
    expectations: {
      top1_predicate: (m, all) => {
        for (const x of all) {
          if (x.slug.includes("cruise") || x.slug.includes("shore-excursion")) {
            return `cruise/shore-excursion leaked in slug=${x.slug}`;
          }
        }
        return null;
      },
    },
    rationale: "Korean Jeju family day — no cruise mention; no cruise tour leak.",
  },
];
