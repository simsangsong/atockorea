// Turn a raw platform value (a sheet's platform column, or the collapsed
// OTASource enum) into a clean display label for external_source.
//
// - Known OTAs → canonical, compact casing (Klook / GYG / Viator / KKday /
//   Trip.com), recognized by substring incl. common Korean spellings.
// - Any other non-empty value is the operator's own platform name → preserved
//   verbatim (trimmed) so it shows in the roster.
// - 'manual' / 'csv' / empty → null (no platform to show; badges hide null).
export function normalizePlatformLabel(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const low = t.toLowerCase()
  if (low === 'manual' || low === 'csv') return null
  if (/\bklook\b|클룩/.test(low)) return 'Klook'
  if (/getyourguide|get\s*your\s*guide|\bgyg\b|겟유어가이드/.test(low)) return 'GYG'
  if (/\bviator\b|tripadvisor|비아토르/.test(low)) return 'Viator'
  if (/\bkkday\b|케이케이데이/.test(low)) return 'KKday'
  if (/\btrip\.?com\b|tripcom|트립닷컴/.test(low)) return 'Trip.com'
  // Operator's own label (e.g. MyRealTrip, Waug, Expedia, Agoda…) — keep as-is.
  return t
}
