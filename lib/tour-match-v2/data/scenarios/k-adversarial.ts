/**
 * Category K — Adversarial / abnormal input (5 scenarios).
 *
 * Verifies safe handling: no exceptions, no seasonal leakage, no SQL/code execution.
 */

import { SEASON_TAGS } from "./SEASON_TAGS";
import { noSeasonalInTop } from "./expectations-helpers";
import type { Scenario } from "./types";

const TODAY = { year: 2026, month: 5 };

export const K_ADVERSARIAL: Scenario[] = [
  {
    id: "S106",
    category: "adversarial",
    query: "'; DROP TABLE match_tours; --",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "SQL-injection style. Server must treat as opaque text.",
  },
  {
    id: "S107",
    category: "adversarial",
    query: "🌸🌸🌸🌸🌸",
    locale: "ko",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      top1_predicate: noSeasonalInTop,
    },
    rationale: "Cherry-blossom emojis only — visual hint but no text signal. MUST NOT leak seasonal.",
  },
  {
    id: "S108",
    category: "adversarial",
    query: "1234567890 12345 67890",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "Pure digits — no signals.",
  },
  {
    id: "S109",
    category: "adversarial",
    query:
      "tour " + "tour ".repeat(200) + "Jeju",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
    },
    rationale: "Very long repeated text + region. Should still extract Jeju and not crash.",
  },
  {
    id: "S110",
    category: "adversarial",
    query: "<script>alert(1)</script>",
    locale: "en",
    today: TODAY,
    expectations: {
      must_not_include_tags: [...SEASON_TAGS],
      response_status: "INSUFFICIENT_INPUT",
    },
    rationale: "XSS payload. No script execution; treat as opaque text.",
  },
];
