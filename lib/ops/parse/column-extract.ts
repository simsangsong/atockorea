// Phase 27 §45 Sprint 27.I — deterministic by-column extraction.
//
// Once the profiler has derived a validated column→field mapping from the
// DATA, extraction is a straight column read — field mis-mapping is then
// structurally impossible for that sheet (no LLM guessing which column is the
// phone). This is the L1.5 path that rescues an unseen tenant's tabular paste
// on the FIRST import, fully automatically. If the grid isn't confidently
// tabular or no identity column resolves, it returns nothing and the funnel
// proceeds to the LLM (where Sprint 27.H repair still protects).
//
// Pure. No I/O.

import type { ParsedBooking, OTASource } from '@/lib/ops/parse/types'
import { toGrid, parseDate, parseTime, clampPartySize } from './tabular'
import { profileColumns, deriveMapping, type ColumnMapping } from './column-profiler'
import { inferLanguage } from './heuristics'
import { isEmailLike, isPhoneLike, isTimeLike, isDateLike, isNameLike } from './field-validators'
import { normalizePlatformLabel } from './platform-label'

// Canonical display label (from normalizePlatformLabel) → OTASource enum. Lets a
// platform cell written as 클룩 / 비아토르 / 트립닷컴 / "GetYourGuide" / "Klook "
// resolve to the right enum instead of defaulting to 'csv'. An operator's own
// label (MyRealTrip, Waug…) has no enum and stays 'csv' (label still preserved).
const LABEL_TO_OTA: Record<string, OTASource> = {
  Klook: 'klook',
  GYG: 'gyg',
  Viator: 'viator',
  KKday: 'kkday',
  'Trip.com': 'tripcom',
}

export interface ColumnExtractResult {
  bookings: ParsedBooking[]
  leftover: string[]
  /** The mapping used (for telemetry / template persistence); null when none. */
  mapping: ColumnMapping | null
  /** Profiler confidence in the derived mapping. */
  confidence: number
}

/**
 * Profile + deterministically extract a tabular paste. Returns empty (with the
 * raw text as leftover) when the input is not confidently tabular or no
 * identity (leadName) column can be derived — the caller then defers to the LLM.
 */
export function extractByColumns(text: string): ColumnExtractResult {
  const grid = toGrid(text)
  if (!grid) return { bookings: [], leftover: [text], mapping: null, confidence: 0 }

  const profiles = profileColumns(grid.rows, grid.cols)
  const { mapping, confidence, ambiguous } = deriveMapping(profiles, grid.header)
  if (ambiguous) return { bookings: [], leftover: [text], mapping: null, confidence }

  const bookings = grid.rows
    .map((row, i) => buildBooking(row, mapping, i))
    .filter((b): b is ParsedBooking => b !== null)

  // If extraction salvaged nothing, treat the whole paste as leftover (defer).
  if (bookings.length === 0) return { bookings: [], leftover: [text], mapping: null, confidence }
  return { bookings, leftover: [], mapping, confidence }
}

function buildBooking(row: string[], m: ColumnMapping, i: number): ParsedBooking | null {
  const at = (f: keyof ColumnMapping): string | undefined => {
    const idx = m[f]
    if (idx == null) return undefined
    const v = row[idx]?.trim()
    return v || undefined
  }

  // Identity. Each mapped value is re-validated against its type (defense in
  // depth) — a cell that doesn't fit its column's profiled type is dropped, not
  // emitted as a wrong field.
  const leadNameRaw = at('leadName')
  const leadName = leadNameRaw && isNameLike(leadNameRaw) ? leadNameRaw : ''
  if (!leadName) return null

  const email = keepIf(at('email'), isEmailLike)?.toLowerCase()
  const phone = keepIf(at('phone'), isPhoneLike)
  const whatsapp = keepIf(at('whatsapp'), isPhoneLike)
  const pickupTime = parseTime(at('pickupTime')) ?? keepIf(at('pickupTime'), isTimeLike)
  const tourDate = parseDate(at('tourDate')) ?? keepIf(at('tourDate'), isDateLike)
  const partySize = clampPartySize(at('partySize'))

  const platformRaw = at('sourcePlatform') ?? null
  const platformLabel = normalizePlatformLabel(platformRaw)
  const sourcePlatform: OTASource = platformLabel ? LABEL_TO_OTA[platformLabel] ?? 'csv' : 'csv'

  const issues: string[] = []
  if (!email && !phone) issues.push('missing_contact')
  else if (!email) issues.push('missing_email')
  else if (!phone) issues.push('missing_phone')
  const pickupPointRaw = at('pickupPointRaw')
  if (!pickupPointRaw) issues.push('missing_pickup')

  return {
    sourcePlatform,
    sourcePlatformLabel: platformLabel ?? platformRaw,
    externalBookingId: at('externalBookingId') || `MANUAL-COL-${i + 1}`,
    leadName,
    partySize,
    tourDate,
    productName: at('productName'),
    pickupPointRaw,
    pickupPointNormalized: undefined, // canonicalize-backstop fills this later
    pickupTime,
    email,
    phone,
    whatsapp,
    language: inferLanguage(phone ?? whatsapp, leadName) || undefined,
    notes: at('notes'),
    guideName: at('guideName'),
    // Deterministic column extraction is high-trust: the mapping was validated
    // against the data. Score above the auto-approve bar; Sprint 27.H validators
    // already gated each cell.
    confidenceScore: 0.9,
    issues,
  }
}

function keepIf(v: string | undefined, ok: (s: string) => boolean): string | undefined {
  if (!v) return undefined
  return ok(v) ? v : undefined
}
