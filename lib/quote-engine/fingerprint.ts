/**
 * Stable hash for precedent lookup in `quote_memory`.
 *
 * Coarse band-bucketing: two requests with similar shape (party of 3 vs
 * party of 4, 6.5h vs 7h, 200km vs 220km) share a fingerprint and the
 * older one's manual amount can be reused as a precedent estimate. Cuts
 * down on ops-typed-the-same-quote-twice noise (R9 mitigation).
 *
 * Format: `region|track|pax≤N|hours≤H|km≤D|pois≤P|lang`
 *   e.g.  `busan|cruise|pax≤4|hours≤6|km≤100|pois≤3|en`
 */

import type { QuoteIntake } from "./types";

const PAX_BREAKS = [4, 7, 12] as const;
const HOURS_BREAKS = [4, 6, 8, 10, 12] as const;
const DISTANCE_BREAKS = [100, 250, 400, 600] as const;
const POI_BREAKS = [3, 5, 7, 10] as const;

function bucket(value: number | null, breaks: readonly number[]): string {
  if (value == null || !Number.isFinite(value)) return "na";
  for (const b of breaks) {
    if (value <= b) return `≤${b}`;
  }
  return `>${breaks[breaks.length - 1]}`;
}

export function fingerprint(intake: QuoteIntake): string {
  const pax = bucket(intake.pax, PAX_BREAKS);
  const hours = bucket(intake.hours, HOURS_BREAKS);
  const km = bucket(intake.distance_km, DISTANCE_BREAKS);
  const pois = bucket(intake.poi_keys.length, POI_BREAKS);
  const lang = intake.language || "en";
  return `${intake.region}|${intake.track}|pax${pax}|hours${hours}|km${km}|pois${pois}|${lang}`;
}
