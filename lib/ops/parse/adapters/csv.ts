// Phase 0-bis — CSV adapter
// Master plan §6.2 — handles spreadsheet exports with header rows.
// Deliberately conservative: only emits bookings when key columns are present.

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking, OTASource } from '@/lib/ops/parse/types'
// Phase 26 §44.5.1 — when the CSV `language` column is empty, infer from
// phone CC + name script (same priority as L2 heuristics).
import { inferLanguage } from '../heuristics'
// Sprint 27.I — shared tabular primitives (moved from here; one source so the
// column profiler splits/coerces identically to this adapter).
import { pickSeparator, splitRow, normalizeHeader, parseDate, parseTime, clampPartySize } from '../tabular'

export { HEADER_ALIASES, mapColumns }

// Column-name aliases we recognize (lowercased + whitespace-stripped).
const HEADER_ALIASES: Record<keyof ParsedBooking | 'tourDate' | 'pickupTime', string[]> = {
  sourcePlatform:        ['platform', 'source', 'channel', 'ota'],
  sourcePlatformLabel:   [], // derived from the sourcePlatform cell, not its own column

  externalBookingId:     ['bookingid', 'bookingref', 'reference', 'refno', 'orderid', 'orderno', 'voucher', '예약번호'],
  leadName:              ['name', 'leadname', 'guest', 'guestname', 'fullname', '예약자', '이름', '고객명', 'customer'],
  partySize:             ['pax', 'partysize', 'people', 'guests', 'qty', 'count', '인원', '인원수'],
  tourDate:              ['date', 'tourdate', 'traveldate', 'departuredate', '날짜', '투어일', '출발일'],
  productName:           ['product', 'productname', 'tour', 'tourname', 'experience', 'course', '상품', '코스', '투어'],
  pickupPointRaw:        ['pickup', 'pickuppoint', 'pickuplocation', 'meetpoint', 'meeting', '픽업', '픽업장소'],
  pickupPointNormalized: [], // never from CSV; canonicalize step fills this later
  pickupTime:            ['time', 'pickuptime', 'meettime', 'meetingtime', '시간', '픽업시간'],
  email:                 ['email', 'mail', 'e-mail', '이메일', '메일'],
  phone:                 ['phone', 'mobile', 'cell', 'tel', '전화', '연락처', '휴대폰'],
  whatsapp:              ['whatsapp', 'wa', '왓츠앱'],
  language:              ['lang', 'language', 'locale', '언어'],
  notes:                 ['notes', 'note', 'remarks', 'memo', 'comments', 'special', '비고', '특이사항'],
  guideName:             ['guide', 'guidename', 'tourguide', 'driver', '기사', '가이드'],
  confidenceScore:       [],
  issues:                [],
  // Cruise fields: never extracted from CSV. The cruise-ship-backstop fills
  // these from the resolved cruise_ships table after parsing.
  cruiseShipText:        ['cruiseship', 'shipname', 'cruise', '크루즈선', '선박명'],
  cruiseShipId:          [],
  cruisePortCallId:      [],
  cruisePortCallMultiple: [],
}

const VALID_OTA = new Set<OTASource>(['klook', 'gyg', 'viator', 'kkday', 'tripcom', 'csv', 'manual'])

export const csvAdapter: PlatformAdapter = {
  id: 'csv',
  label: 'CSV / Excel',

  detect(raw: string): number {
    const head = raw.slice(0, 4000)
    const lines = head.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 5)
    if (lines.length < 2) return 0
    // CSV signature: first line is comma- or tab-separated header row,
    // subsequent lines have the same column count.
    const sep = pickSeparator(lines[0])
    if (!sep) return 0
    const headerCols = splitRow(lines[0], sep).length
    if (headerCols < 3) return 0
    const consistentRows = lines.slice(1).filter(l => splitRow(l, sep).length === headerCols).length
    const consistency = consistentRows / (lines.length - 1)
    // Header must look like field names (no @, no digits as the first char of every cell).
    const headerLooksLikeNames = splitRow(lines[0], sep).every(c => /[a-zA-Z가-힣]/.test(c) && !c.includes('@'))
    if (!headerLooksLikeNames) return 0
    return Math.min(1, 0.6 + consistency * 0.4)
  },

  parse(raw: string): AdapterResult {
    const allLines = raw.split(/\r?\n/)
    const nonEmpty = allLines.filter(l => l.trim().length > 0)
    if (nonEmpty.length < 2) return { bookings: [], leftover: [raw] }

    const sep = pickSeparator(nonEmpty[0])
    if (!sep) return { bookings: [], leftover: [raw] }

    const header = splitRow(nonEmpty[0], sep).map(normalizeHeader)
    const colIdx = mapColumns(header)
    if (colIdx.leadName == null && colIdx.externalBookingId == null) {
      // No recognizable identity column — defer to LLM.
      return { bookings: [], leftover: [raw] }
    }

    const bookings: ParsedBooking[] = []
    const leftover: string[] = []

    for (let i = 1; i < nonEmpty.length; i++) {
      const row = splitRow(nonEmpty[i], sep)
      if (row.length < header.length / 2) {
        leftover.push(nonEmpty[i])
        continue
      }

      const leadName = cell(row, colIdx.leadName)?.trim() ?? ''
      const externalBookingId = cell(row, colIdx.externalBookingId)?.trim() || `MANUAL-${i}`
      const partySize = clampPartySize(cell(row, colIdx.partySize))

      if (!leadName && !externalBookingId) {
        leftover.push(nonEmpty[i])
        continue
      }

      const issues: string[] = []
      const tourDate = parseDate(cell(row, colIdx.tourDate))
      const pickupRaw = cell(row, colIdx.pickupPointRaw)?.trim() || undefined
      const pickupTime = parseTime(cell(row, colIdx.pickupTime))
      const email = cell(row, colIdx.email)?.trim().toLowerCase() || undefined
      const phone = cell(row, colIdx.phone)?.trim() || undefined

      if (!email && !phone) issues.push('missing_contact')
      else if (!email) issues.push('missing_email')
      else if (!phone) issues.push('missing_phone')
      if (!pickupRaw) issues.push('missing_pickup')

      const sourceCellRaw = cell(row, colIdx.sourcePlatform)?.trim() || null
      const sourceCell = sourceCellRaw?.toLowerCase()
      const sourcePlatform: OTASource = sourceCell && VALID_OTA.has(sourceCell as OTASource)
        ? (sourceCell as OTASource)
        : 'csv'

      const confidence = computeConfidence({
        leadName,
        externalBookingId,
        partySize,
        tourDate,
        pickupRaw,
        pickupTime,
        email,
        phone,
      })

      // Only emit if confidence ≥ 0.85; otherwise let downstream layers retry.
      if (confidence < 0.85) {
        leftover.push(nonEmpty[i])
        continue
      }

      bookings.push({
        sourcePlatform,
        sourcePlatformLabel: sourceCellRaw,
        externalBookingId,
        leadName,
        partySize,
        tourDate,
        productName: cell(row, colIdx.productName)?.trim() || undefined,
        pickupPointRaw: pickupRaw,
        pickupPointNormalized: undefined, // filled by canonicalizePickup() later
        pickupTime,
        email,
        phone,
        whatsapp: cell(row, colIdx.whatsapp)?.trim() || undefined,
        language:
          cell(row, colIdx.language)?.trim().toLowerCase()
          || inferLanguage(phone ?? cell(row, colIdx.whatsapp)?.trim(), leadName)
          || undefined,
        notes: cell(row, colIdx.notes)?.trim() || undefined,
        guideName: cell(row, colIdx.guideName)?.trim() || undefined,
        confidenceScore: confidence,
        issues,
      })
    }

    return { bookings, leftover }
  },
}

// ── helpers ────────────────────────────────────────────────────────────────

function mapColumns(header: string[]): Record<keyof typeof HEADER_ALIASES, number | null> {
  const result = {} as Record<keyof typeof HEADER_ALIASES, number | null>
  for (const key of Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>) {
    const aliases = HEADER_ALIASES[key]
    const idx = header.findIndex(h => aliases.includes(h))
    result[key] = idx >= 0 ? idx : null
  }
  return result
}

function cell(row: string[], idx: number | null): string | undefined {
  if (idx == null) return undefined
  return row[idx]?.trim()
}

function computeConfidence(b: {
  leadName: string
  externalBookingId: string
  partySize: number
  tourDate: string | undefined
  pickupRaw: string | undefined
  pickupTime: string | undefined
  email: string | undefined
  phone: string | undefined
}): number {
  let score = 0.5
  if (b.leadName) score += 0.2
  if (b.partySize >= 1) score += 0.05
  if (b.tourDate) score += 0.1
  if (b.pickupRaw) score += 0.1
  if (b.pickupTime) score += 0.05
  if (b.email && b.phone) score += 0.1
  else if (b.email || b.phone) score += 0.05
  return Math.min(1, score)
}
