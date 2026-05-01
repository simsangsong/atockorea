/**
 * Aggregated stress-test scenario corpus (~100 scenarios).
 *
 * Categories:
 *   A empty_weak              10
 *   B season_leak             15
 *   C season_explicit_match   10
 *   D season_explicit_mismatch 10
 *   E season_keyword_only     10
 *   F region_general          10
 *   G persona_focus           10
 *   H conflicting              5
 *   I multilingual            15
 *   J long_form                5
 *   K adversarial              5
 *
 * Run via `npm run match:stress`.
 */

import { A_EMPTY_WEAK } from "./a-empty-weak";
import { B_SEASON_LEAK } from "./b-season-leak";
import { C_SEASON_EXPLICIT_MATCH } from "./c-season-explicit-match";
import { D_SEASON_EXPLICIT_MISMATCH } from "./d-season-explicit-mismatch";
import { E_SEASON_KEYWORD_ONLY } from "./e-season-keyword-only";
import { F_REGION_GENERAL } from "./f-region-general";
import { G_PERSONA_FOCUS } from "./g-persona-focus";
import { H_CONFLICTING } from "./h-conflicting";
import { I_MULTILINGUAL } from "./i-multilingual";
import { J_LONG_FORM } from "./j-long-form";
import { K_ADVERSARIAL } from "./k-adversarial";
import type { Scenario, ScenarioCategory } from "./types";

export const ALL_SCENARIOS: Scenario[] = [
  ...A_EMPTY_WEAK,
  ...B_SEASON_LEAK,
  ...C_SEASON_EXPLICIT_MATCH,
  ...D_SEASON_EXPLICIT_MISMATCH,
  ...E_SEASON_KEYWORD_ONLY,
  ...F_REGION_GENERAL,
  ...G_PERSONA_FOCUS,
  ...H_CONFLICTING,
  ...I_MULTILINGUAL,
  ...J_LONG_FORM,
  ...K_ADVERSARIAL,
];

// ID-collision guard — runs at module load.
const seen = new Set<string>();
const dupes: string[] = [];
for (const s of ALL_SCENARIOS) {
  if (seen.has(s.id)) dupes.push(s.id);
  seen.add(s.id);
}
if (dupes.length) {
  throw new Error(`Scenario id collision(s): ${dupes.join(", ")}`);
}

export function scenariosByCategory(cat: ScenarioCategory): Scenario[] {
  return ALL_SCENARIOS.filter((s) => s.category === cat);
}

export function scenarioById(id: string): Scenario | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id);
}

export const SCENARIO_CATEGORIES: ScenarioCategory[] = [
  "empty_weak",
  "season_leak",
  "season_explicit_match",
  "season_explicit_mismatch",
  "season_keyword_only",
  "region_general",
  "persona_focus",
  "conflicting",
  "multilingual",
  "long_form",
  "adversarial",
];

export type { Scenario, ScenarioCategory } from "./types";
