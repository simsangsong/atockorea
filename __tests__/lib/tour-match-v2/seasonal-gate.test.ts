/**
 * Truth-table coverage for `passesSeasonalGate`.
 *
 * 7 rows of the truth table × evergreen-passes-always = 8 cases.
 */

import {
  isSeasonalProduct,
  passesSeasonalGate,
  SEASON_THEME_KEYS,
} from "@/lib/tour-match-v2/seasonal-gate";
import type { MatchTourRow, ParsedQueryV2 } from "@/lib/tour-match-v2/types";

const baseTour = (overrides: Partial<MatchTourRow> = {}): MatchTourRow => ({
  slug: "test-tour",
  locale: "en",
  schema_version: 18,
  matching_profile: {},
  matching_metadata: null,
  available_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  primary_themes: [],
  secondary_themes: [],
  best_for: [],
  not_recommended_for: [],
  anchor_poi_keys: [],
  competing_products: [],
  destination_region: "jeju",
  pickup_region: null,
  duration_hours: null,
  vehicle_type: null,
  enrichment_batch: null,
  kb_version: null,
  profile_version: 18,
  a_grade: false,
  is_cruise_excursion: false,
  is_charter_route_options: false,
  ...overrides,
});

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

const cherryTour = baseTour({
  slug: "jeju-east-cherry",
  available_months: [3, 4],
  primary_themes: ["cherry_blossom", "spring_seasonal"],
});

const evergreenTour = baseTour({
  slug: "jeju-day-tour-east",
  available_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  primary_themes: ["highlights", "scenic"],
});

describe("isSeasonalProduct", () => {
  test("flags tour with available_months < 12 as seasonal", () => {
    expect(isSeasonalProduct(cherryTour)).toBe(true);
  });

  test("flags 12-month tour as seasonal when themes include a season key", () => {
    const yearRoundButThemed = baseTour({
      available_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      primary_themes: ["cherry_blossom"],
    });
    expect(isSeasonalProduct(yearRoundButThemed)).toBe(true);
  });

  test("treats pure evergreen as non-seasonal", () => {
    expect(isSeasonalProduct(evergreenTour)).toBe(false);
  });

  test("SEASON_THEME_KEYS covers cherry_blossom + hydrangea + tangerine", () => {
    expect(SEASON_THEME_KEYS.has("cherry_blossom")).toBe(true);
    expect(SEASON_THEME_KEYS.has("hydrangea")).toBe(true);
    expect(SEASON_THEME_KEYS.has("tangerine")).toBe(true);
    expect(SEASON_THEME_KEYS.has("autumn_foliage")).toBe(true);
  });
});

describe("passesSeasonalGate — truth table", () => {
  const today = { year: 2026, month: 5 }; // May

  test("evergreen tour always passes regardless of inputs", () => {
    const out = passesSeasonalGate(evergreenTour, baseParsed(), today);
    expect(out.ok).toBe(true);
    expect(out.reason).toBeNull();
  });

  test("Row 1: no month, no season keyword → REJECT seasonal_no_signal", () => {
    const out = passesSeasonalGate(cherryTour, baseParsed(), today);
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/seasonal_no_signal/);
  });

  test("Row 2: month yes, no season keyword, overlap → PASS", () => {
    const out = passesSeasonalGate(
      cherryTour,
      baseParsed({ months: [4] }),
      today,
    );
    expect(out.ok).toBe(true);
  });

  test("Row 3: month yes, no season keyword, no overlap → REJECT month_mismatch_explicit", () => {
    const out = passesSeasonalGate(
      cherryTour,
      baseParsed({ months: [7] }),
      today,
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/month_mismatch_explicit/);
  });

  test("Row 4: no month, season keyword, today in season → PASS (today fallback)", () => {
    const out = passesSeasonalGate(
      cherryTour,
      baseParsed({ season_locks: ["cherry_blossom"] }),
      { year: 2026, month: 4 },
    );
    expect(out.ok).toBe(true);
  });

  test("Row 5: no month, season keyword, today off-season → REJECT season_keyword_off_season", () => {
    const out = passesSeasonalGate(
      cherryTour,
      baseParsed({ season_locks: ["cherry_blossom"] }),
      { year: 2026, month: 7 },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/season_keyword_off_season/);
  });

  test("Row 6: month yes, season keyword, overlap → PASS", () => {
    const out = passesSeasonalGate(
      cherryTour,
      baseParsed({ months: [4], season_locks: ["cherry_blossom"] }),
      today,
    );
    expect(out.ok).toBe(true);
  });

  test("Row 7: month yes, season keyword, no overlap → REJECT contradiction (THE 5월 벚꽃 case)", () => {
    const out = passesSeasonalGate(
      cherryTour,
      baseParsed({ months: [5], season_locks: ["cherry_blossom"] }),
      today,
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/contradiction_user_month_vs_season/);
  });
});
