/**
 * Category I — Multilingual queries (15 scenarios: ko 5 / ja 3 / zh 3 / en 4).
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop, top1Region } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const I_MULTILINGUAL: Scenario[] = [
  // Korean (5)
  {
    id: "S086",
    category: "multilingual",
    query: "제주 가족 1일투어 추천해주세요",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Korean Jeju family day-trip request.",
  },
  {
    id: "S087",
    category: "multilingual",
    query: "서울 부모님 모시고 휠체어 가능한 곳",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      notes_must_contain: ["WHEELCHAIR_FILTER_APPLIED"],
    },
    rationale: "Korean Seoul senior wheelchair.",
  },
  {
    id: "S088",
    category: "multilingual",
    query: "부산 양산 통도사 1일",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Busan Yangsan temple day.",
  },
  {
    id: "S089",
    category: "multilingual",
    query: "원데이 프라이빗 차량 가성비",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Korean: one-day private car value.",
  },
  {
    id: "S090",
    category: "multilingual",
    query: "남이섬 쁘띠프랑스 아침고요수목원",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Three anchor POIs (Nami + Petite France + Garden of Morning Calm).",
  },
  // Japanese (3)
  {
    id: "S091",
    category: "multilingual",
    query: "済州島 家族 日帰りツアー",
    locale: "ja",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Japanese: Jeju family day tour.",
  },
  {
    id: "S092",
    category: "multilingual",
    query: "ソウル 文化体験 一日 プライベート",
    locale: "ja",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Japanese: Seoul cultural one day private.",
  },
  {
    id: "S093",
    category: "multilingual",
    query: "釜山 ハネムーン カップル",
    locale: "ja",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Japanese: Busan honeymoon couple.",
  },
  // Chinese (3)
  {
    id: "S094",
    category: "multilingual",
    query: "首尔 家庭一日游 包车",
    locale: "zh-CN",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Simplified Chinese: Seoul family charter day.",
  },
  {
    id: "S095",
    category: "multilingual",
    query: "濟州島 親子 一日 私家車",
    locale: "zh-TW",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Traditional Chinese: Jeju family private car day.",
  },
  {
    id: "S096",
    category: "multilingual",
    query: "韓國 蜜月旅行 浪漫",
    locale: "zh-TW",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Traditional Chinese: Korea honeymoon romantic.",
  },
  // English (4)
  {
    id: "S097",
    category: "multilingual",
    query: "first time in Korea what to see",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "First-time visitor — should boost iconic_landmark_fit.",
  },
  {
    id: "S098",
    category: "multilingual",
    query: "private driver English speaking guide Seoul day",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Private + English-speaking guide Seoul day.",
  },
  {
    id: "S099",
    category: "multilingual",
    query: "Jeju east coast highlights with kids 7 and 10",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: top1Region("jeju"),
    },
    rationale: "Jeju east + young-kids family.",
  },
  {
    id: "S100",
    category: "multilingual",
    query: "Korea cultural experience hanok village fortress 1 day",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Cultural multi-anchor (hanok + fortress).",
  },
];
