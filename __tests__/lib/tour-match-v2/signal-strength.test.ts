/**
 * Boundary cases for the 4-bucket signal-strength classifier.
 */

import {
  classifySignalStrength,
  countHardSignals,
  countSoftSignals,
} from "@/lib/tour-match-v2/signal-strength";
import type { ParsedQueryV2 } from "@/lib/tour-match-v2/types";

const baseParsed = (overrides: Partial<ParsedQueryV2> = {}): ParsedQueryV2 => ({
  raw_query: "",
  raw_query_locale: "en",
  regions: [],
  sub_regions: [],
  season: null,
  months: null,
  season_locks: [],
  personas: [],
  themes: [],
  anchor_pois_mentioned: [],
  pace: null,
  format: null,
  duration_constraint: null,
  user_max_hours: null,
  hard_constraints: [],
  wants_cruise: false,
  wants_charter_customization: false,
  is_multi_day_request: false,
  boost_dimensions: {},
  negative_signals: [],
  confidence: 0.5,
  parser_notes: "",
  ...overrides,
});

describe("classifySignalStrength", () => {
  test("empty query (no signals at all) → empty", () => {
    expect(classifySignalStrength(baseParsed())).toBe("empty");
  });

  test("only one soft signal (e.g. one persona) → weak", () => {
    expect(classifySignalStrength(baseParsed({ personas: ["families"] }))).toBe("weak");
  });

  test("only themes (one soft) → weak", () => {
    expect(classifySignalStrength(baseParsed({ themes: ["scenic"] }))).toBe("weak");
  });

  test("two soft signals (no hard) → moderate", () => {
    expect(
      classifySignalStrength(
        baseParsed({ personas: ["families"], themes: ["scenic"] }),
      ),
    ).toBe("moderate");
  });

  test("one hard signal (region only) → moderate", () => {
    expect(classifySignalStrength(baseParsed({ regions: ["jeju"] }))).toBe("moderate");
  });

  test("two hard signals → strong", () => {
    expect(
      classifySignalStrength(baseParsed({ regions: ["jeju"], months: [4] })),
    ).toBe("strong");
  });

  test("region + season_lock + persona → strong", () => {
    expect(
      classifySignalStrength(
        baseParsed({
          regions: ["jeju"],
          season_locks: ["cherry_blossom"],
          personas: ["families"],
        }),
      ),
    ).toBe("strong");
  });

  test("anchor_poi alone counts as one hard signal → moderate", () => {
    expect(
      classifySignalStrength(
        baseParsed({ anchor_pois_mentioned: ["seongsan_ilchulbong"] }),
      ),
    ).toBe("moderate");
  });
});

describe("countHardSignals / countSoftSignals", () => {
  test("region+sub_region+month+season_lock+anchor = 5 hard", () => {
    const p = baseParsed({
      regions: ["jeju"],
      sub_regions: ["jeju_east"],
      months: [4],
      season_locks: ["cherry_blossom"],
      anchor_pois_mentioned: ["seongsan_ilchulbong"],
    });
    expect(countHardSignals(p)).toBe(5);
    expect(countSoftSignals(p)).toBe(0);
  });

  test("personas+themes+pace+format+hard_constraints+wants_cruise+wants_charter = 7 soft", () => {
    const p = baseParsed({
      personas: ["families"],
      themes: ["scenic"],
      pace: "relaxed",
      format: "private",
      hard_constraints: ["wheelchair"],
      wants_cruise: true,
      wants_charter_customization: true,
    });
    expect(countSoftSignals(p)).toBe(7);
  });
});
