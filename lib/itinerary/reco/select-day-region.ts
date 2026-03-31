/**
 * Picks a single primary region for one-area-per-day assembly when the user
 * did not specify region_preference.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { ScoredCandidate } from '@/lib/itinerary/reco/score-candidates';

export function selectDayRegion(params: {
  scored: ScoredCandidate[];
  parsed: ParsedRequestSlots;
}): string | null {
  if (params.parsed.regionPreference) {
    return params.parsed.regionPreference;
  }

  const regionTotals = new Map<string, number>();

  for (const c of params.scored) {
    const region = c.region ?? 'unknown';
    regionTotals.set(region, (regionTotals.get(region) ?? 0) + c.score);
  }

  const ranked = [...regionTotals.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return ranked[0]?.[0] ?? null;
}
