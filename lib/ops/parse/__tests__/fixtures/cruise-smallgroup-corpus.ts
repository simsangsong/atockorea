// Phase 27 / Sprint C — cruiseShipText corpus from a real "제주 크루즈 스몰 그룹"
// roster (audited 2026-05-22). Each entry is a cruise small-group booking whose
// product line ALWAYS carries cruise context, so the ship backstop probes it.
//
// Two populations the corpus must keep separate:
//
//   1. SHIP-PRESENT (8) — the source block carries a ship signal, sometimes
//      mislabeled (Klook puts it under "항공편명(입국):") or typo'd
//      ("celebrity millenium", "Spectrum f the Seaso"). The backstop MUST
//      extract it and canonicalize to the seeded canonical_name.
//   2. SHIP-ABSENT (GetYourGuide) — no ship anywhere. Per Hard Rule #18 these
//      are signal-ABSENT: the parser MUST NOT fabricate a ship and MUST NOT
//      flood L3; the booking is review-flagged downstream for a missing ship.
//
// PII policy (Hard Rule #21): lead names are synthetic, phone digits are
// masked. The ship text + OTA booking ref + platform marker are preserved
// verbatim because they are exactly what the extractor must survive.
//
// Canonical names + aliases mirror the seeded DB (migrations
// 20260518340100_cruise_ships.sql + 20260522032000_observed_cruise_ship_aliases.sql,
// confirmed against the remote on 2026-05-22). The fake resolver below runs the
// real 3-step algorithm from resolve-ship-id.ts so the test is hermetic but
// faithful — no DB, no LLM, CI-safe.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import {
  normalizeShipName,
  type ResolvedShip,
  type ShipMatchMethod,
} from '@/lib/ops/cruise/resolve-ship-id'

const CRUISE_PRODUCT = '제주 크루즈 스몰 그룹'

export interface CruiseShipCase {
  /** Human-readable case description (the audited variant trap). */
  label: string
  sourcePlatform: ParsedBooking['sourcePlatform']
  externalBookingId: string
  productName: string
  /** Source field/notes text carrying (or omitting) the ship, masked. */
  notes: string
  /**
   * Expected resolution. `null` = signal-absent: no ship anywhere, so the
   * backstop must leave cruiseShipText undefined (never fabricate).
   */
  expected:
    | {
        /** Seeded canonical_name the variant must collapse to. */
        canonical: string
        /** Which resolver step should land it (documents the path). */
        method: ShipMatchMethod
      }
    | null
  /** Why this case exists / what trap it guards. */
  reason: string
}

// ── Ship-present (8) ─────────────────────────────────────────────────────────
export const SHIP_PRESENT_CASES: CruiseShipCase[] = [
  {
    label: 'Viator 크루즈선: clean canonical',
    sourcePlatform: 'viator',
    externalBookingId: 'BR-1374669085',
    productName: CRUISE_PRODUCT,
    notes:
      '특별 요구사항: We only speak English\n도착 정보:\n크루즈선: Celebrity Millennium\n하선 시간: 8:30AM\n하차 위치: Cruise ahip terminal',
    expected: { canonical: 'Celebrity Millennium', method: 'exact_canonical' },
    reason: 'Clean canonical name + Korean arrival fields on following lines must be trimmed.',
  },
  {
    label: 'Viator 크루즈선: lowercase + dropped-letter typo "celebrity millenium"',
    sourcePlatform: 'viator',
    externalBookingId: 'BR-1375168477',
    productName: CRUISE_PRODUCT,
    notes: '도착 정보:\n크루즈선: celebrity millenium\n하선 시간: 9;00\n하차 위치: port of Jeju',
    expected: { canonical: 'Celebrity Millennium', method: 'partial_substring' },
    reason: 'Lowercase + single-n "millenium" must still canonicalize (partial on the seeded "Millenium" alias).',
  },
  {
    label: 'Viator 크루즈선: bare partial "Millenium"',
    sourcePlatform: 'viator',
    externalBookingId: 'BR-1375168511',
    productName: CRUISE_PRODUCT,
    notes: '도착 정보:\n크루즈선: Millenium\n하선 시간: 9:00 am\n하차 위치: Port of Jeju',
    expected: { canonical: 'Celebrity Millennium', method: 'alias_normalized' },
    reason: 'Ship abbreviated to just the suffix — resolves via the seeded "Millenium" alias.',
  },
  {
    label: 'Viator 크루즈선: typo "Celebrity Millenium" buried after long 특별 요구사항',
    sourcePlatform: 'viator',
    externalBookingId: 'BR-1381644743',
    productName: CRUISE_PRODUCT,
    notes:
      '특별 요구사항: I am the travel agent and the client travelling with my husband and my 82 year old mother\n도착 정보:\n크루즈선: Celebrity Millenium\n하선 시간: 8:00\n하차 위치: close to the ship',
    expected: { canonical: 'Celebrity Millennium', method: 'partial_substring' },
    reason: 'Long prose before the label must not derail extraction.',
  },
  {
    label: 'Viator 크루즈선: clean "Spectrum of the seas"',
    sourcePlatform: 'viator',
    externalBookingId: 'BR-1376440167',
    productName: CRUISE_PRODUCT,
    notes:
      '특별 요구사항: FALLTRIP10 [phone] (Fran, whatsapp)\n도착 정보:\n크루즈선: Spectrum of the seas\n하선 시간: 1330-2000\n하차 위치: Spectrum of the seas',
    expected: { canonical: 'SPECTRUM OF THE SEAS', method: 'exact_canonical' },
    reason: 'Case-insensitive exact canonical; ship name repeated in 하차 위치 must not double-count.',
  },
  {
    label: 'Viator 크루즈선: scrambled typo "Spectrum f the Seaso"',
    sourcePlatform: 'viator',
    externalBookingId: 'BR-1382419871',
    productName: CRUISE_PRODUCT,
    notes:
      '도착 정보:\n크루즈선: Spectrum f the Seaso\n하선 시간: 12:30\n하차 위치: As close as possible to Cruise Terminal (Seogwipo)',
    expected: { canonical: 'SPECTRUM OF THE SEAS', method: 'alias_normalized' },
    reason: 'Resolves via the typo alias seeded in migration 20260522032000.',
  },
  {
    label: 'GYG free-prose (no label) "Spectrum of the seas Arrival 1pm"',
    sourcePlatform: 'gyg',
    externalBookingId: 'GYGMX4L6RNA6',
    productName: CRUISE_PRODUCT,
    notes: 'Spectrum of the seas Arrival 1pm',
    expected: { canonical: 'SPECTRUM OF THE SEAS', method: 'partial_substring' },
    reason: 'No 크루즈선:/Ship: label — the whole-notes resolver must still substring-match the ship.',
  },
  {
    label: 'Klook ship MISLABELED under "항공편명(입국):"',
    sourcePlatform: 'klook',
    externalBookingId: 'GEF350726',
    productName: CRUISE_PRODUCT,
    notes:
      '선호 언어: 영어 출발 장소: 서귀포 강정 크루즈 터미널 항공편 도착 시간: 11.00am 항공편명 (입국): MSC BELLISSIMA',
    expected: { canonical: 'MSC Bellissima', method: 'partial_substring' },
    reason: 'Cruise ship hidden in a FLIGHT-number field — label trust alone would miss it.',
  },
]

// ── Ship-absent (GetYourGuide) — must NOT fabricate; review-flag downstream ───
export const SHIP_ABSENT_CASES: CruiseShipCase[] = [
  ['GYGLMR6HBH7V', 'Lynda R.'],
  ['GYG7VK346RMF', 'Gaynor J.'],
  ['GYGVN3BZZKL7', 'Annette W.'],
  ['GYG99668HQA6', 'Ralf J.'],
  ['GYG7VK2WWR87', 'Galina P.'],
  ['GYG9969A76XH', 'Brenda B.'],
  ['GYG6H8GV5G28', 'Tom S.'],
  ['GYG7VK5K5HB3', 'Stephen B.'],
  ['GYGMX4RMZN42', 'Brigitte K.'],
  ['GYG32L9L2F5F', 'Martin L.'],
].map<CruiseShipCase>(([ref]) => ({
  label: `GYG cruise small-group, no ship (${ref})`,
  sourcePlatform: 'gyg',
  externalBookingId: ref,
  productName: CRUISE_PRODUCT,
  notes: `customer-[masked]@reply.getyourguide.com`,
  expected: null,
  reason: 'GetYourGuide cruise rows structurally omit the ship — signal-absent (Hard Rule #18).',
}))

// ── Seeded alias snapshot (subset sufficient for the 8 cases) ─────────────────
// Mirrors cruise_ships.canonical_name + cruise_ship_aliases.alias for the three
// ships in this corpus. Keep in sync with the seed migrations if they change.
const CANONICAL_NAMES = ['Celebrity Millennium', 'MSC Bellissima', 'SPECTRUM OF THE SEAS'] as const

const ALIASES: Record<string, string> = {}
function seedAlias(canonical: string, alias: string) {
  ALIASES[normalizeShipName(alias)] = canonical
}
// Celebrity Millennium
;['Celebrity Millennium', 'Celebrity Milenium', 'Celebrity Milennium', 'Millennium', 'Millenium', 'Milennium', 'Milenium'].forEach(
  a => seedAlias('Celebrity Millennium', a),
)
// MSC Bellissima
;['MSC Bellissima', 'MSC Bellisima', 'Bellissima', 'bellisima'].forEach(a => seedAlias('MSC Bellissima', a))
// SPECTRUM OF THE SEAS (canonical also seeded as an alias for substring hits)
;['SPECTRUM OF THE SEAS', 'Spectrum f the Seaso', 'Spectrum f the Seas', 'Spectrum of the Seaso'].forEach(a =>
  seedAlias('SPECTRUM OF THE SEAS', a),
)

const CANON_BY_NORM: Record<string, string> = Object.fromEntries(
  CANONICAL_NAMES.map(n => [normalizeShipName(n), n]),
)

let shipIdSeq = 0
const ID_BY_CANON: Record<string, string> = Object.fromEntries(
  CANONICAL_NAMES.map(n => [n, `ship-${++shipIdSeq}`]),
)

/** Stable ship id for a canonical name — lets tests assert id grouping. */
export function shipIdFor(canonical: string): string {
  return ID_BY_CANON[canonical]
}

/**
 * Hermetic stand-in for resolveCruiseShipId that runs the real 3-step algorithm
 * (exact canonical → alias exact → ≥6-char partial substring) against the
 * seeded snapshot above. Returns the same shape as the production resolver.
 */
export function fakeResolveShip(shipText: string | null | undefined): ResolvedShip | null {
  const trimmed = shipText?.trim()
  if (!trimmed) return null
  const norm = normalizeShipName(trimmed)
  if (!norm) return null

  // 1) exact canonical (case-insensitive)
  if (CANON_BY_NORM[norm]) {
    const canonical = CANON_BY_NORM[norm]
    return { id: ID_BY_CANON[canonical], canonical_name: canonical, method: 'exact_canonical', confidence: 1.0 }
  }
  // 2) alias normalized exact
  if (ALIASES[norm]) {
    const canonical = ALIASES[norm]
    return { id: ID_BY_CANON[canonical], canonical_name: canonical, method: 'alias_normalized', confidence: 0.95 }
  }
  // 3) ≥6-char partial substring (either direction), like the prod scan
  for (const [an, canonical] of Object.entries(ALIASES)) {
    if (an.length >= 6 && (norm.includes(an) || an.includes(norm))) {
      return { id: ID_BY_CANON[canonical], canonical_name: canonical, method: 'partial_substring', confidence: 0.75 }
    }
  }
  return null
}
