// Viator adapter — forwarded booking-confirmation email (Gmail Korean-localized).
// Master plan §6.2 / OTA email ingest (2026-06-21).
//
// A Viator booking email is a SINGLE booking laid out as a vertical Korean label
// list ("예약 참조: …", "여행자 인솔자 이름: …", "만남의 장소 : …"). Gotchas the
// measurement exposed and this adapter handles:
//   • placeholder passenger names ("Anna Martinez, Passenger Two, Passenger
//     Three, …") are NOT split into guests — lead = 인솔자, count = 여행자 수.
//   • the customer's alternate phone (전화: (Alternate Phone)US+1 …) is DISTINCT
//     from the WhatsApp number in 특별 요구 사항 — both are kept (L2 mis-picked
//     the WhatsApp number as the phone).
//   • cruise shore excursions carry Cruise Ship / Boarding / Disembarkation lines
//     — ship → cruiseShipText, disembarkation → meet time, boarding → notes.
//
// ReDoS-safety (§45.5): anchored / literal-alternation regexes, bounded
// quantifiers, '[^\n]' instead of '.'.

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { inferLanguage } from '../heuristics'

const VIATOR_REF_RE = /\bBR-\d{6,}\b/i
const VIATOR_HEADER_RE = /viator|비아토르/i
const VIATOR_LABEL_RE = /예약\s*참조|여행자\s*수|투어\s*등급|만남의\s*장소|투어\s*언어/

export const viatorAdapter: PlatformAdapter = {
  id: 'viator',
  label: 'Viator',

  detect(raw: string): number {
    // The "BR-NNNNNNNN" reference + the Korean detail labels are unambiguous and
    // survive envelope stripping; the brand word ("viator") may live only in the
    // forwarded From: (stripped) or a footer, so it cannot be required.
    const head = raw.slice(0, 6000)
    let score = 0
    if (VIATOR_REF_RE.test(head)) score += 0.5
    if (VIATOR_LABEL_RE.test(head)) score += 0.35
    if (VIATOR_HEADER_RE.test(head)) score += 0.3
    return Math.min(1, score)
  },

  parse(raw: string): AdapterResult {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const refM = raw.match(VIATOR_REF_RE)
    if (!refM) return { bookings: [], leftover: [raw] }
    const ref = refM[0].toUpperCase()

    const leadName =
      // The label drifts: "여행자 인솔자 이름" (2026-06 batch A) vs "여행 인솔자
      // 이름" (batch B). `여행자?` (자 optional) + "투어 인솔자" cover both.
      labelValue(lines, /^(?:여행자?\s*인솔자\s*이름|투어\s*인솔자\s*이름)\s*[:：]\s*(.+)$/) ??
      firstTravelerName(lines)
    if (!leadName || !looksLikeName(leadName)) return { bookings: [], leftover: [raw] }

    const partySize = extractPartySize(lines)
    const tourDate = extractTourDate(raw, lines)
    const productName =
      labelValue(lines, /^투어\s*등급\s*[:：]\s*(.+)$/) ??
      labelValue(lines, /^투어\s*등급\s*설명\s*[:：]\s*(.+)$/)
    const pickupRaw = cleanPickup(
      labelValue(lines, /^만남의?\s*장소\s*[:：]\s*(.+)$/) ??
      // Private-tour emails label it "호텔 픽업: <hotel>" instead of 만남의 장소.
      labelValue(lines, /^호텔\s*픽업\s*[:：]\s*(.+)$/) ??
      labelValue(lines, /^Pick\s*up\s*Location\s*[:：]\s*(.+)$/i),
    )
    const pickupTime = extractMeetTime(lines)
    const phone = extractAltPhone(lines)
    const whatsapp = extractWhatsapp(lines)
    const cruiseShipText = labelValue(lines, /^Cruise\s*Ship\s*[:：]\s*(.+)$/i)
    // Prefer the explicit "투어 언어: English - Guide" label; fall back to
    // phone-CC / name-script inference when it's absent.
    const language = extractTourLanguage(lines) ?? inferLanguage(phone ?? whatsapp, leadName)
    const notes = buildNotes(lines)

    const issues: string[] = []
    if (!phone && !whatsapp) issues.push('missing_contact')
    if (!pickupRaw) issues.push('missing_pickup')

    const booking: ParsedBooking = {
      sourcePlatform: 'viator',
      externalBookingId: ref,
      leadName: leadName.trim(),
      partySize,
      tourDate,
      productName,
      pickupPointRaw: pickupRaw,
      pickupPointNormalized: undefined,
      pickupTime,
      email: undefined,
      phone,
      whatsapp,
      cruiseShipText,
      language,
      notes,
      confidenceScore: computeConfidence({ hasDate: !!tourDate, hasPickup: !!pickupRaw, hasContact: !!(phone || whatsapp) }),
      issues,
    }
    return { bookings: [booking], leftover: [] }
  },
}

// ── field extractors ──────────────────────────────────────────────────────────

function labelValue(lines: string[], re: RegExp): string | undefined {
  for (const l of lines) {
    const m = l.match(re)
    if (m && m[1].trim().length > 0) return m[1].trim()
  }
  return undefined
}

// A pickup value is real only if it names a place. "My hotel is not yet booked",
// "TBD", "미정" etc. are placeholders → treat as missing (better an honest
// missing_pickup than junk in the field).
function cleanPickup(v: string | undefined): string | undefined {
  if (!v) return undefined
  const t = v.replace(/[:\s]+$/, '').trim()
  if (t.length < 3) return undefined
  if (/not\s+(?:yet\s+)?booked|^TBD$|미정|아직\s*(?:안|예약)|^N\/?A$|^없음$|^none$/i.test(t)) return undefined
  return t
}

// "여행자 이름: Anna Martinez, Passenger Two, …" → first non-placeholder name.
function firstTravelerName(lines: string[]): string | undefined {
  const v = labelValue(lines, /^여행자\s*이름\s*[:：]\s*(.+)$/)
  if (!v) return undefined
  const first = v.split(',')[0].trim()
  if (/^Passenger\b/i.test(first)) return undefined
  return first
}

// Viator gives the date as a labeled detail line ("여행 날짜: Wed, Jun 17, 2026"),
// in the intro prose in parens ("여행 날짜(Wed, Jun 17, 2026)가 …"), and as
// "Departure Date: 06/17/26" (2-digit US year). Try the reliable month-name forms
// first; fall back to the 2-digit Departure Date.
function extractTourDate(raw: string, lines: string[]): string | undefined {
  const m = raw.match(/여행\s*날짜\s*[:：(（]\s*([^)）\n]+)/)
  if (m) {
    const d = parseLooseDate(m[1])
    if (d) return d
  }
  const dep = labelValue(lines, /^Departure\s*Date\s*[:：]\s*(.+)$/i)
  if (dep) {
    const d = parseLooseDate(dep)
    if (d) return d
  }
  return undefined
}

function extractPartySize(lines: string[]): number {
  // The pax label drifts: "여행자 수: 4 Adults" (batch A) vs "여행자: 2 Adults"
  // (batch B). `수?` (optional) covers both; "여행자 이름:" can't match because a
  // digit must follow the colon (the name line never does).
  const v = labelValue(lines, /^여행자\s*수?\s*[:：]\s*(\d{1,2})/)
  if (v) {
    const n = parseInt(v, 10)
    if (n > 0) return Math.min(50, n)
  }
  return 1
}

// Meeting time for a shore tour, in priority order:
//   1. The time baked into the join-in tour grade ("[Join-in] … Tour 10:00") —
//      that is the tour's scheduled departure = when the guide meets guests.
//   2. Disembarkation Time "0700" / "07:00" / "8 am" — fallback when the grade
//      carries no time (disembarkation ≈ earliest possible meet).
function extractMeetTime(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(/^투어\s*등급(?:\s*설명)?\s*[:：].*?\b(\d{1,2}):(\d{2})\b/)
    if (m) return `${pad2(m[1])}:${m[2]}`
  }
  for (const l of lines) {
    const m = l.match(/^Disembarkation\s*Time\s*[:：]\s*(.+)$/i)
    if (!m) continue
    const t = parseClockLoose(m[1])
    if (t) return t
  }
  return undefined
}

// "0700" → 07:00, "07:00" → 07:00, "8 am" → 08:00, "2 pm" → 14:00.
// Non-numeric placeholders ("Do not know yet") return undefined.
function parseClockLoose(v: string): string | undefined {
  let m = v.match(/^\s*(\d{1,2}):(\d{2})\b/)
  if (m) return `${pad2(m[1])}:${m[2]}`
  m = v.match(/^\s*(\d{1,2})\s*([AaPp][Mm])\b/)
  if (m) {
    let hh = parseInt(m[1], 10)
    const pm = /p/i.test(m[2])
    if (pm && hh < 12) hh += 12
    if (!pm && hh === 12) hh = 0
    if (hh >= 0 && hh <= 23) return `${pad2(String(hh))}:00`
  }
  m = v.match(/^\s*(\d{2})(\d{2})\b/) // "0700"
  if (m) return `${m[1]}:${m[2]}`
  return undefined
}

// "투어 언어: English - Guide" → en. Maps the OTA language word to our 2-letter
// code; undefined when the label is absent (caller falls back to inference).
const VIATOR_LANG_MAP: Record<string, string> = {
  english: 'en', korean: 'ko', 한국어: 'ko', chinese: 'zh', mandarin: 'zh', 中文: 'zh',
  japanese: 'ja', 日本語: 'ja', french: 'fr', spanish: 'es', german: 'de',
}
function extractTourLanguage(lines: string[]): string | undefined {
  const v = labelValue(lines, /^투어\s*언어\s*[:：]\s*(.+)$/)
  if (!v) return undefined
  const word = v.split(/[-–(]/)[0].trim().toLowerCase()
  return VIATOR_LANG_MAP[word]
}

// "전화: (Alternate Phone)US+1 3238061098 고객에게 메시지를 전송합니다." → +13238061098
function extractAltPhone(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(/^전화\s*[:：]\s*(.+)$/)
    if (!m) continue
    // Strip ONLY a parenthesised label ("(Alternate Phone)") — a paren that
    // contains a letter. A numeric paren is a phone area code ("(808)") and must
    // survive, else US numbers lose their area code.
    const rest = m[1].replace(/\([^)]*[A-Za-z][^)]*\)/g, ' ').replace(/[가-힣].*$/, ' ')
    const plus = /\+/.test(rest)
    const run = rest.match(/[\d][\d\s\-()]{6,}\d/)
    if (run) {
      const digits = run[0].replace(/\D/g, '')
      if (digits.length >= 7) return (plus ? '+' : '') + digits
    }
  }
  return undefined
}

// "특별 요구 사항: Diamond Princess 323-383-5476 WhatsApp" → 3233835476
function extractWhatsapp(lines: string[]): string | undefined {
  for (const l of lines) {
    if (!/WhatsApp|왓츠앱/i.test(l)) continue
    const m = l.match(/(\+?)[\s]?(\d[\d\s\-()]{6,}\d)/)
    if (m) {
      const digits = m[2].replace(/\D/g, '')
      if (digits.length >= 7) return (m[1] === '+' ? '+' : '') + digits
    }
  }
  return undefined
}

function buildNotes(lines: string[]): string | undefined {
  const parts: string[] = []
  const boarding = labelValue(lines, /^Boarding\s*Time\s*[:：]\s*(.+)$/i)
  if (boarding) parts.push(`Boarding ${boarding}`)
  const special = labelValue(lines, /^특별\s*요구\s*사항\s*[:：]\s*(.+)$/)
  if (special) parts.push(special)
  return parts.length ? parts.join(' | ') : undefined
}

// ── shared helpers ──────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Numeric (Y-M-D, M-D-Y) + English month name ("Wed, Jun 17, 2026" / "Jun 17, 2026").
function parseLooseDate(v: string): string | undefined {
  if (!v) return undefined
  let m = v.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = v.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/)
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (mo) return `${m[3]}-${pad2(String(mo))}-${pad2(m[2])}`
  }
  m = v.match(/(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/)
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  m = v.match(/(\d{1,2})[\-/](\d{1,2})[\-/](\d{2})\b/) // US MM/DD/YY (Departure Date)
  if (m) return `20${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  return undefined
}

function looksLikeName(s: string): boolean {
  const t = s.trim()
  return t.length >= 2 && t.length <= 80 && /[A-Za-z가-힣]/.test(t) && !/^\d+$/.test(t)
}

function computeConfidence(f: { hasDate: boolean; hasPickup: boolean; hasContact: boolean }): number {
  // Labeled email extraction is high-certainty by construction (explicit labels);
  // sparseness lowers it slightly but never below emit.
  let score = 0.88
  if (f.hasDate) score += 0.04
  if (f.hasPickup) score += 0.04
  if (f.hasContact) score += 0.04
  return Math.min(1, score)
}

function pad2(s: string): string {
  return s.length < 2 ? `0${s}` : s
}
