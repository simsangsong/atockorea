/**
 * Scenario type contract for the stress-test corpus.
 *
 * Each scenario is a deterministic input + a set of expectations that the
 * stress runner evaluates after invoking the live matcher.
 */

import type { Locale, MatchStatus, ScoredMatchV2 } from "../../types";

export type ScenarioCategory =
  | "empty_weak"
  | "season_leak"
  | "season_explicit_match"
  | "season_explicit_mismatch"
  | "season_keyword_only"
  | "region_general"
  | "persona_focus"
  | "conflicting"
  | "multilingual"
  | "long_form"
  | "adversarial";

/** A custom predicate over the top match. Return null on pass, a string reason on fail. */
export type Top1Predicate = (
  m: ScoredMatchV2 | undefined,
  all: ScoredMatchV2[],
) => string | null;

export type ScenarioExpectations = {
  /** Top-K must NOT contain any tour with these tags in its themes. */
  must_not_include_tags?: string[];
  /** Top-K must NOT contain a tour whose slug starts/equals any of these. */
  must_not_include_slugs?: string[];
  /** At least one top-K result must have one of these tags. */
  must_include_one_of_tags?: string[];
  /** At least one top-K result's slug must equal one of these. */
  must_include_one_of_slugs?: string[];
  min_results?: number;
  max_results?: number;
  response_status?: MatchStatus;
  /** Substring(s) that MUST appear inside response.notes (concatenated). */
  notes_must_contain?: string[];
  /** Custom predicate evaluated against the top-1 match. */
  top1_predicate?: Top1Predicate;
};

export type Scenario = {
  id: string;
  category: ScenarioCategory;
  query: string;
  locale: Locale;
  /** Frozen "today" for the scenario — used by the seasonal-gate's `today` arg. */
  today?: { year: number; month: number };
  expectations: ScenarioExpectations;
  /** Free-form description of what this scenario is checking. */
  rationale: string;
  /** Optional bug-tracking refs, e.g. ["bug-1", "bug-3"]. */
  bug_ref?: string[];
};
