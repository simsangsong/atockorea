// KKday adapter — forwarded order-confirmation email (Korean labels).
// Master plan §6.2 / OTA email ingest (2026-06-21).
//
// A KKday booking email is a SINGLE, SPARSE booking: ref / product / package /
// use-date / quantity / lead traveler, with NO contact and NO pickup in the body
// (KKday routes those through its SCM portal). The labels are fixed Korean:
//   예약번호 / 상품번호 / 상품명 / 패키지 / 사용 날짜 / 수량 / 대표 여행자
//
// ReDoS-safety (§45.5): anchored / literal-alternation regexes, bounded
// quantifiers, '[^\n]' instead of '.'.

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { inferLanguage } from '../heuristics'

const KKDAY_REF_RE = /\b\d{2}KK\d{6,}\b/
const KKDAY_HEADER_RE = /kkday|케이케이데이/i
const KKDAY_LABEL_RE = /예약번호|상품번호|사용\s*날짜|대표\s*여행자|수량/

export const kkdayAdapter: PlatformAdapter = {
  id: 'kkday',
  label: 'KKday',

  detect(raw: string): number {
    const head = raw.slice(0, 6000)
    let score = 0
    if (KKDAY_HEADER_RE.test(head)) score += 0.5
    if (KKDAY_REF_RE.test(head)) score += 0.4
    if (KKDAY_LABEL_RE.test(head)) score += 0.3
    return Math.min(1, score)
  },

  parse(raw: string): AdapterResult {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const ref =
      labelValue(lines, /^예약번호\s*[:：]\s*(\S+)/) ?? raw.match(KKDAY_REF_RE)?.[0]
    if (!ref) return { bookings: [], leftover: [raw] }

    const leadName = labelValue(lines, /^대표\s*여행자\s*[:：]\s*(.+)$/)
    if (!leadName || !looksLikeName(leadName)) return { bookings: [], leftover: [raw] }

    const productName = labelValue(lines, /^상품명\s*[:：]\s*(.+)$/)
    const tourDate = parseLooseDate(labelValue(lines, /^사용\s*날짜\s*[:：]\s*([\d.\-/]+)/) ?? '')
    const partySize = extractPartySize(lines)
    // KKday lead names come "LAST, FIRST" — strip the comma so the Latin-name
    // language heuristic (which rejects commas) still resolves 'en'.
    const language = inferLanguage(undefined, leadName.replace(/,/g, ' '))
    const notes = buildNotes(lines)

    const issues: string[] = ['missing_contact', 'missing_pickup']

    const booking: ParsedBooking = {
      sourcePlatform: 'kkday',
      externalBookingId: ref.toUpperCase(),
      leadName: leadName.trim(),
      partySize,
      tourDate,
      productName,
      pickupPointRaw: undefined,
      pickupPointNormalized: undefined,
      pickupTime: undefined,
      email: undefined,
      phone: undefined,
      whatsapp: undefined,
      language,
      notes,
      confidenceScore: tourDate ? 0.92 : 0.88,
      issues,
    }
    return { bookings: [booking], leftover: [] }
  },
}

function labelValue(lines: string[], re: RegExp): string | undefined {
  for (const l of lines) {
    const m = l.match(re)
    if (m && m[1].trim().length > 0) return m[1].trim()
  }
  return undefined
}

// "수량: 3명" → 3 · "수량: 대인 x3" → 3 · "수량: 대인 x2, 소인 x1" → 3.
// Prefer explicit "xN" count tokens (sum them so child-inclusive bookings get
// the full headcount); fall back to the first bare number ("3명" / "3").
function extractPartySize(lines: string[]): number {
  const v = labelValue(lines, /^수량\s*[:：]\s*(.+)$/)
  if (v) {
    const xs = [...v.matchAll(/[xX×]\s*(\d{1,2})\b/g)].map(m => parseInt(m[1], 10))
    if (xs.length) {
      const total = xs.reduce((a, b) => a + b, 0)
      if (total > 0) return Math.min(50, total)
    }
    const bare = v.match(/(\d{1,2})/)
    if (bare) {
      const n = parseInt(bare[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  return 1
}

function buildNotes(lines: string[]): string | undefined {
  const pkg = labelValue(lines, /^패키지\s*[:：]\s*(.+)$/)
  return pkg ? `패키지: ${pkg}` : undefined
}

// "2026/07/28" → "2026-07-28"
function parseLooseDate(v: string): string | undefined {
  if (!v) return undefined
  let m = v.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = v.match(/(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/)
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  return undefined
}

function looksLikeName(s: string): boolean {
  const t = s.trim()
  return t.length >= 2 && t.length <= 80 && /[A-Za-z가-힣]/.test(t) && !/^\d+$/.test(t)
}

function pad2(s: string): string {
  return s.length < 2 ? `0${s}` : s
}
