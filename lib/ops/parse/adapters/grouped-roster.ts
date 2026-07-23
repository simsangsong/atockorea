// Phase 27 §45 follow-up — grouped multi-space roster adapter.
//
// Recovers a recurring operator format that the LLM previously mis-read (it
// swallowed group-header lines into phantom bookings and dropped non-contiguous
// rows as final_leftover). The format is a section header followed by
// whitespace-delimited columnar rows:
//
//     남부투어 (한라산1100+주상절리대+천제연+송악산+보문사+오설록)  한혜연
//     05-01  1  Wei Wei Chua  3  Ocean Suites Jeju Hotel  6588390013  Klook
//     05-01  2  Jocelyn Sanchez  1  Ocean Suites Jeju Hotel  527714246871  GYG
//     05-01  3  Haruhito Kowashi  1  Ocean Suites Jeju Hotel  82104… no whatsapp  Viator
//
// Header  : "<productName>  <guideName?>"  (≥2-space / tab separated), OR a
//           labeled header "tour_name: … | guide: … | tour_date: …".
// Data row: "<MM-DD>  <rowNum>  <name>  <pax>  <pickup>  <phone>  [notes…]  <platform>"
//
// Parsing this deterministically means these imports never reach the LLM:
// zero cost, no phantom rooms, no dropped guests. Detection is strict (date +
// integer row-number prefix) so OTA exports / CSV never match it.

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking, OTASource } from '@/lib/ops/parse/types'
import { inferLanguage } from '../heuristics'
import { labeledHeaderFields } from '../section-header'
import { normalizePlatformLabel } from '../platform-label'

// Columns are separated by ≥2 spaces or a tab — single spaces inside a name or
// a pickup ("Ocean Suites Jeju Hotel") are preserved.
const COL_SPLIT = /\s{2,}|\t+/
const DATE_MD = /^(\d{1,2})[-/.](\d{1,2})$/
const DATE_YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/

function splitRowCols(line: string): string[] {
  return line.trim().split(COL_SPLIT).map(c => c.trim()).filter(c => c.length > 0)
}

/** A data row: date in col 0, integer row-number in col 1, ≥6 columns. This
 *  shape (date + row-number prefix) is what makes the format distinguishable. */
function isRowCols(cols: string[]): boolean {
  if (cols.length < 6) return false
  if (!(DATE_MD.test(cols[0]) || DATE_YMD.test(cols[0]))) return false
  return /^\d{1,3}$/.test(cols[1])
}

export const groupedRosterAdapter: PlatformAdapter = {
  id: 'grouped-roster',
  label: 'Grouped roster',

  detect(raw: string): number {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length < 2) return 0
    let rows = 0
    for (const l of lines) if (isRowCols(splitRowCols(l))) rows++
    if (rows < 2) return 0
    const ratio = rows / lines.length
    // Rows dominate (headers are the only non-row lines). Scale into the
    // confident band; sparse matches stay below the 0.8 select threshold.
    return ratio >= 0.4 ? Math.min(1, 0.8 + ratio * 0.2) : ratio * 0.5
  },

  parse(raw: string): AdapterResult {
    const bookings: ParsedBooking[] = []
    const leftover: string[] = []

    // Year for MM-DD rows: first 4-digit year seen in the input, else now.
    const yearMatch = raw.match(/\b(20\d{2})\b/)
    const defaultYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear()

    let productName: string | undefined
    let guideName: string | undefined
    let sectionDate: string | undefined
    let seq = 0

    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line) continue
      const cols = splitRowCols(line)

      if (isRowCols(cols)) {
        seq += 1
        const booking = buildBooking(cols, { productName, guideName, sectionDate, defaultYear }, seq)
        if (booking) bookings.push(booking)
        else leftover.push(line)
        continue
      }

      // Not a data row — try to read it as a section header.
      const labeled = labeledHeaderFields(line)
      if (labeled) {
        if (labeled.productName) productName = labeled.productName
        if (labeled.guideName) guideName = labeled.guideName
        if (labeled.tourDate) sectionDate = labeled.tourDate
        continue
      }
      const unlabeled = parseUnlabeledHeader(cols)
      if (unlabeled) {
        productName = unlabeled.productName
        guideName = unlabeled.guideName
        sectionDate = undefined
        continue
      }

      // Genuinely unrecognized line — hand downstream.
      leftover.push(line)
    }

    return { bookings, leftover }
  },
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface SectionCtx {
  productName: string | undefined
  guideName: string | undefined
  sectionDate: string | undefined
  defaultYear: number
}

function buildBooking(cols: string[], ctx: SectionCtx, seq: number): ParsedBooking | null {
  // Fixed front columns: 0=date 1=rowNum 2=name 3=pax 4=pickup 5=phone.
  // Last column is the platform (when ≥7 cols); anything between phone and
  // platform is free-form notes ("no whatsapp", "원래 6/4", …).
  const name = cols[2]?.trim() ?? ''
  if (!isNameLike(name)) return null

  const partySize = clampPartySize(cols[3])
  const pickupRaw = cols[4]?.trim() || undefined
  const phone = cols[5]?.trim() || undefined

  const hasPlatform = cols.length >= 7
  const platformRaw = hasPlatform ? cols[cols.length - 1].trim() : undefined
  const notes = cols.length >= 8 ? cols.slice(6, cols.length - 1).join(' ').trim() || undefined : undefined

  const issues: string[] = []
  if (!phone) issues.push('missing_contact')
  if (!pickupRaw) issues.push('missing_pickup')

  return {
    sourcePlatform: toOTASource(platformRaw),
    sourcePlatformLabel: normalizePlatformLabel(platformRaw),
    externalBookingId: `MANUAL-${seq}`,
    leadName: name,
    partySize,
    tourDate: parseRowDate(cols[0], ctx),
    productName: ctx.productName,
    pickupPointRaw: pickupRaw,
    pickupPointNormalized: undefined, // filled by canonicalizePickup() later
    pickupTime: undefined,
    email: undefined,
    phone,
    whatsapp: undefined,
    language: inferLanguage(phone, name) || undefined,
    notes,
    guideName: ctx.guideName,
    confidenceScore: 0.9,
    issues,
  }
}

/** An unlabeled header: "<productName>  <guideName?>". col 0 must carry letters
 *  and not be a data row's date/number, so stray annotation lines don't poison
 *  the section context. */
function parseUnlabeledHeader(cols: string[]): { productName: string; guideName: string | undefined } | null {
  if (cols.length === 0 || cols.length > 3) return null
  const head = cols[0].trim()
  if (head.length < 2 || !/\p{L}/u.test(head)) return null
  if (DATE_MD.test(head) || DATE_YMD.test(head) || /^\d+$/.test(head)) return null
  const guide = cols[1]?.trim()
  return { productName: head, guideName: guide && isNameLike(guide) ? guide : undefined }
}

function isNameLike(s: string): boolean {
  const t = s.trim()
  if (t.length < 2 || t.length > 40) return false
  if (!/\p{L}/u.test(t)) return false // must carry a letter
  if (/@|https?:\/\//i.test(t)) return false
  if (/^\+?\d[\d\s().-]{5,}$/.test(t)) return false // a phone, not a name
  return true
}

function toOTASource(raw: string | undefined): OTASource {
  const low = (raw ?? '').toLowerCase()
  if (/klook|클룩/.test(low)) return 'klook'
  if (/getyourguide|get\s*your\s*guide|\bgyg\b|겟유어가이드/.test(low)) return 'gyg'
  if (/\bviator\b|tripadvisor|비아토르/.test(low)) return 'viator'
  if (/\bkkday\b|케이케이데이/.test(low)) return 'kkday'
  if (/\btrip\.?com\b|tripcom|트립닷컴/.test(low)) return 'tripcom'
  return 'manual'
}

function clampPartySize(raw: string | undefined): number {
  if (!raw) return 1
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(50, n)
}

function parseRowDate(raw: string, ctx: SectionCtx): string | undefined {
  const t = raw.trim()
  const ymd = t.match(DATE_YMD)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  const md = t.match(DATE_MD)
  if (md) {
    // Prefer the year from a labeled section date when present.
    const year = ctx.sectionDate ? Number(ctx.sectionDate.slice(0, 4)) : ctx.defaultYear
    return `${year}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
  }
  return ctx.sectionDate
}
