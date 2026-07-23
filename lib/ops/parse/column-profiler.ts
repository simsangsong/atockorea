// Phase 27 §45 Sprint 27.I — data-driven column profiler.
//
// The CSV adapter maps columns by HEADER name. When a new tenant's headers are
// unfamiliar (or wrong, or absent), that mapping fails and the whole sheet
// falls to the LLM, which guesses column→field and mis-maps. The profiler
// instead infers each column's meaning from its OWN DATA: the column whose
// cells are ≥threshold phone-shaped IS the phone column — no header, no LLM, no
// human. On a header-vs-data conflict the DATA wins (a "phone"-headed column
// full of names is names). This is the structural fix for column mis-mapping.
//
// Pure. No I/O. Reuses classifyValue (the one validator source) — no new regex.

import type { FieldType } from './field-validators'
import { classifyValue } from './field-validators'
import { HEADER_ALIASES, mapColumns } from './adapters/csv'

/** Booking fields a column can map to. */
export type MappedField =
  | 'leadName'
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'pickupTime'
  | 'tourDate'
  | 'partySize'
  | 'sourcePlatform'
  | 'externalBookingId'
  | 'productName'
  | 'pickupPointRaw'
  | 'notes'
  | 'guideName'

export type ColumnMapping = Partial<Record<MappedField, number>>

export interface ColumnProfile {
  index: number
  /** Fraction of non-empty cells matching each semantic type. */
  typeFractions: Partial<Record<FieldType, number>>
  /** The dominant type (≥ MIN_FRACTION), most-specific-wins, or null. */
  bestType: FieldType | null
  /** Fraction of cells that agreed with bestType. */
  confidence: number
  nonEmpty: number
}

// A column must be this consistent in a type before the profiler trusts it.
const MIN_FRACTION = 0.6
// Most-specific → least-specific. `name` is the most permissive, so a column
// only becomes leadName when no more-specific type claims it.
const TYPE_PRIORITY: FieldType[] = ['email', 'phone', 'whatsapp', 'date', 'time', 'pax', 'platform', 'name']

const TYPE_TO_FIELD: Record<FieldType, MappedField> = {
  email: 'email',
  phone: 'phone',
  whatsapp: 'whatsapp',
  time: 'pickupTime',
  date: 'tourDate',
  pax: 'partySize',
  platform: 'sourcePlatform',
  name: 'leadName',
}

export function profileColumns(rows: string[][], cols: number): ColumnProfile[] {
  const profiles: ColumnProfile[] = []
  for (let c = 0; c < cols; c++) {
    const counts: Partial<Record<FieldType, number>> = {}
    let nonEmpty = 0
    for (const row of rows) {
      const v = (row[c] ?? '').trim()
      if (!v) continue
      nonEmpty++
      for (const t of classifyValue(v)) counts[t] = (counts[t] ?? 0) + 1
    }
    const typeFractions: Partial<Record<FieldType, number>> = {}
    for (const t of Object.keys(counts) as FieldType[]) {
      typeFractions[t] = nonEmpty === 0 ? 0 : counts[t]! / nonEmpty
    }
    let bestType: FieldType | null = null
    for (const t of TYPE_PRIORITY) {
      if ((typeFractions[t] ?? 0) >= MIN_FRACTION) {
        bestType = t
        break
      }
    }
    profiles.push({
      index: c,
      typeFractions,
      bestType,
      confidence: bestType ? typeFractions[bestType]! : 0,
      nonEmpty,
    })
  }
  return profiles
}

export interface DerivedMapping {
  mapping: ColumnMapping
  /** Overall confidence = mean confidence of the data-assigned columns. */
  confidence: number
  /** True when no identity (leadName) column could be resolved — defer to LLM. */
  ambiguous: boolean
}

/**
 * Combine the data profile with the header aliases. Data wins on conflict; the
 * header only resolves fields the data could not (e.g. a booking-id or notes
 * column, which carry no distinctive value shape).
 */
export function deriveMapping(profiles: ColumnProfile[], header: string[] | null): DerivedMapping {
  const mapping: ColumnMapping = {}
  const taken = new Set<number>()
  const dataConfidences: number[] = []

  // 1. Data-profile pass (authoritative). Highest-confidence column per field.
  const byField = new Map<MappedField, ColumnProfile>()
  for (const p of profiles) {
    if (!p.bestType) continue
    const field = TYPE_TO_FIELD[p.bestType]
    const cur = byField.get(field)
    if (!cur || p.confidence > cur.confidence) byField.set(field, p)
  }
  for (const [field, p] of byField) {
    mapping[field] = p.index
    taken.add(p.index)
    dataConfidences.push(p.confidence)
  }

  // 2. Header-alias pass — fills ONLY the header-only fields whose value shape
  //    the data profile can't identify (booking-id / product / pickup / notes /
  //    guide), and only from still-free columns. Data-owned fields (name, email,
  //    phone, date, time, pax, platform) are never set from the header here:
  //    data wins, and if the data couldn't find them we defer to the LLM.
  if (header) {
    const headerMap = mapColumns(header)
    for (const field of ALLOWED_HEADER_ONLY) {
      const idx = headerMap[field]
      if (idx == null || mapping[field] != null || taken.has(idx)) continue
      mapping[field] = idx
      taken.add(idx)
    }
  }

  const confidence = dataConfidences.length > 0
    ? dataConfidences.reduce((a, b) => a + b, 0) / dataConfidences.length
    : 0
  return { mapping, confidence, ambiguous: mapping.leadName == null }
}

// Header keys that may map a field the data shapes can't identify on their own.
const ALLOWED_HEADER_ONLY: readonly (keyof typeof HEADER_ALIASES & MappedField)[] = [
  'externalBookingId',
  'productName',
  'pickupPointRaw',
  'notes',
  'guideName',
]
