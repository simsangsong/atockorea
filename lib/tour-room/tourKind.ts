/**
 * §11.D D1 — the canonical join-vs-private discriminator for a tour.
 *
 * The AUTHORITATIVE live discriminator is `tours.price_type`:
 *   - 'vehicle'  → a PRIVATE / charter tour (customizable route, its own room)
 *   - 'person' | 'group' | anything else | null → a JOIN / shared tour
 *
 * This is intentionally a "vehicle ⇒ private, else join" rule so an unknown or
 * missing price_type falls back to the safe, non-customizable JOIN shape (it
 * never wrongly unlocks the private-tour plan editor).
 *
 * `otaTourKind` (sourced from `ota_raw_meta.tour_kind`) is a FALLBACK only —
 * used for rows that have no joined `tours` record and therefore no
 * price_type. price_type always wins when present.
 *
 * Pure module: no DB imports, no side effects, safe to use anywhere.
 */

export type TourKind = 'join' | 'private';

/**
 * Map a raw `tours.price_type` to a TourKind.
 * 'vehicle' ⇒ 'private'; every other value (including null/undefined/unknown)
 * ⇒ 'join'.
 */
export function tourKindFromPriceType(priceType: string | null | undefined): TourKind {
  return priceType === 'vehicle' ? 'private' : 'join';
}

/**
 * True only for a PRIVATE (vehicle-charter) tour. Convenience wrapper around
 * `tourKindFromPriceType` for the many `is_private`-style call sites.
 */
export function isPrivateTour(priceType: string | null | undefined): boolean {
  return priceType === 'vehicle';
}

/**
 * Resolve a TourKind from the authoritative price_type when present, otherwise
 * fall back to the OTA-supplied `tour_kind` hint.
 *
 * price_type is authoritative: whenever it is a non-null string it decides the
 * kind ('vehicle' ⇒ private, else join) and the fallback is ignored. Only when
 * price_type is null/undefined (no joined tour row) do we consult otaTourKind,
 * treating an explicit 'private' as private and everything else as join.
 */
export function resolveTourKind(input: {
  priceType?: string | null;
  otaTourKind?: string | null;
}): TourKind {
  if (input.priceType != null) {
    return tourKindFromPriceType(input.priceType);
  }
  return input.otaTourKind === 'private' ? 'private' : 'join';
}
