/**
 * Signal-strength classifier for parsed tour-match queries.
 *
 *   strong   ≥ 2 hard signals (region/sub-region/month/season-lock/anchor-POI)
 *   moderate exactly 1 hard signal, OR 0 hard + ≥ 2 soft
 *   weak     0 hard + exactly 1 soft (or low confidence with no hard signal)
 *   empty    no signals whatsoever
 *
 * Downstream uses:
 *   - matcher.matchTours: weak/empty → strip seasonal candidates from results
 *   - response.match_status: empty → INSUFFICIENT_INPUT
 */

import type { ParsedQueryV2, SignalStrength } from "./types";

export function classifySignalStrength(parsed: ParsedQueryV2): SignalStrength {
  const hardCount = countHardSignals(parsed);
  const softCount = countSoftSignals(parsed);

  if (hardCount === 0 && softCount === 0) return "empty";
  if (hardCount >= 2) return "strong";
  if (hardCount === 1) return "moderate";
  // hardCount === 0 below
  if (softCount >= 2) return "moderate";
  if (softCount === 1) return "weak";
  return "empty";
}

export function countHardSignals(parsed: ParsedQueryV2): number {
  let n = 0;
  if ((parsed.regions?.length ?? 0) > 0) n++;
  if ((parsed.sub_regions?.length ?? 0) > 0) n++;
  if (parsed.months !== null && parsed.months.length > 0) n++;
  if ((parsed.season_locks?.length ?? 0) > 0) n++;
  if ((parsed.anchor_pois_mentioned?.length ?? 0) > 0) n++;
  return n;
}

export function countSoftSignals(parsed: ParsedQueryV2): number {
  let n = 0;
  if ((parsed.personas?.length ?? 0) > 0) n++;
  if ((parsed.themes?.length ?? 0) > 0) n++;
  if (parsed.pace !== null) n++;
  if (parsed.format !== null) n++;
  if ((parsed.hard_constraints?.length ?? 0) > 0) n++;
  // boost_dimensions ignored as a signal source — they're often auto-derived
  // from personas/themes and would double-count. wants_cruise / wants_charter
  // are intentional flags, count as soft.
  if (parsed.wants_cruise) n++;
  if (parsed.wants_charter_customization) n++;
  return n;
}

export type SignalBreakdown = {
  hard_count: number;
  soft_count: number;
  strength: SignalStrength;
};

export function describeSignalBreakdown(parsed: ParsedQueryV2): SignalBreakdown {
  return {
    hard_count: countHardSignals(parsed),
    soft_count: countSoftSignals(parsed),
    strength: classifySignalStrength(parsed),
  };
}
