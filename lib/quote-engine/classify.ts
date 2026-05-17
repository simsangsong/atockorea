/**
 * In-scope vs out-of-scope check for an itinerary builder quote request.
 *
 * Returns an enumerated set of `violations` so the Slack escalation
 * message can explain to ops what triggered manual fallback. An
 * inactive preset is always out-of-scope (so ops can flip `active=false`
 * for emergency disablement).
 */

import type { ClassifyResult, QuoteIntake, QuotePresetRow } from "./types";

export function classify(preset: QuotePresetRow, intake: QuoteIntake): ClassifyResult {
  const violations: string[] = [];

  if (!preset.active) {
    violations.push("preset_inactive");
    return { in_scope: false, violations };
  }

  const rules = preset.in_scope_rules;

  if (intake.pax != null && intake.pax > rules.max_pax) {
    violations.push(`pax_over_max:${intake.pax}>${rules.max_pax}`);
  }
  if (intake.hours != null && intake.hours > rules.max_hours) {
    violations.push(`hours_over_max:${intake.hours.toFixed(1)}>${rules.max_hours}`);
  }
  if (intake.distance_km != null && intake.distance_km > rules.max_distance_km) {
    violations.push(`distance_over_max:${Math.round(intake.distance_km)}km>${rules.max_distance_km}km`);
  }

  const disallowed = intake.poi_keys.filter((k) =>
    rules.disallowed_poi_keys.includes(k)
  );
  if (disallowed.length) {
    violations.push(`disallowed_poi:${disallowed.join(",")}`);
  }

  return { in_scope: violations.length === 0, violations };
}
