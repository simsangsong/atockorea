// Phase 0-bis — GetYourGuide adapter
// Master plan §6.2

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking } from '@/lib/ops/parse/types'
// Phase 26 §44.5 — share language inference + side-contact extraction with L2.
import { inferLanguage, extractSideContacts, isPlausibleName } from '../heuristics'

const GYG_REF_RE = /\bGYG[\-_]?[A-Z0-9]{6,12}\b/gi
const GYG_HEADER_RE = /\b(?:getyourguide|gyg|겟유?가이드)\b/i
const BLOCK_SEP_RE = /\n\s*\n+/

export const getYourGuideAdapter: PlatformAdapter = {
  id: 'gyg',
  label: 'GetYourGuide',

  detect(raw: string): number {
    const head = raw.slice(0, 4000)
    let score = 0
    if (GYG_HEADER_RE.test(head)) score += 0.5
    const refs = head.match(GYG_REF_RE)
    if (refs && refs.length >= 2) score += 0.4
    else if (refs && refs.length === 1) score += 0.2 // a single booking EMAIL carries one ref
    // GYG booking-email fingerprints (one booking per mail, so the ≥2-ref rule
    // above never trips). The proxy/footer domain + the fixed greeting are
    // unambiguous GYG markers. (2026-06-21)
    if (/getyourguide\.com/i.test(head)) score += 0.3
    if (/Your offer has been booked|Supply Partner|Reference number\s*:/i.test(head)) score += 0.2
    if (head.includes('Supplier Portal') || head.includes('GetYourGuide Supplier')) score += 0.2
    return Math.min(1, score)
  },

  parse(raw: string): AdapterResult {
    const blocks = raw.split(BLOCK_SEP_RE).map(b => b.trim()).filter(b => b.length > 0)
    const bookings: ParsedBooking[] = []
    const leftover: string[] = []
    let currentProduct: string | undefined

    for (const block of blocks) {
      if (looksLikeProductHeading(block)) {
        currentProduct = stripProductPrefix(block)
        continue
      }
      const b = parseBlock(block, currentProduct)
      if (b) bookings.push(b)
      else leftover.push(block)
    }
    return { bookings, leftover }
  },
}

function looksLikeProductHeading(block: string): boolean {
  if (block.length > 80) return false
  if (block.includes('@')) return false
  if (/\d{4}-\d{2}-\d{2}/.test(block)) return false
  if (GYG_REF_RE.test(block)) return false
  return /(코스|투어|tour|course|experience|상품)/i.test(block)
}

function stripProductPrefix(raw: string): string {
  return raw
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^상품명?\s*[:-]\s*/, '')
    .replace(/^코스명?\s*[:-]\s*/, '')
    .trim()
}

function parseBlock(block: string, productName: string | undefined): ParsedBooking | null {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null

  const refMatch = block.match(GYG_REF_RE)
  if (!refMatch) return null
  const ref = refMatch[0].toUpperCase()

  // In the email layout the product title is the card's first line (not a
  // standalone heading block), so carry it as productName when none was set.
  let resolvedProduct = productName
  if (!resolvedProduct) {
    const first = lines[0]
    if (
      first && first.length <= 90 &&
      /(투어|tour|experience|크루즈|cruise|excursion|show)/i.test(first) &&
      !GYG_REF_RE.test(first) && !LABEL_LEAD_RE.test(first) &&
      !/^(?:Reference|Date|Number|Phone|Pickup|Price|Language|Tour language|Main|Participants)/i.test(first)
    ) {
      resolvedProduct = stripProductPrefix(first)
    }
  }

  // leadName: explicit label (colon-only, never dash, to avoid the
  // "Customer-<hash>@reply.getyourguide.com" collision) → Korean operator
  // inline pattern "Name (N 명) - 겟유가이드 - REF" → first plausible-name line.
  const leadName = extractLeadName(lines)
  // partySize: labeled OR inline "(N 명)" / "(인원수 x N 명)" / "(성인 N 명)".
  const partySize = extractPartySize(lines)
  const tourDate = extractTourDate(lines)
  // pickupRaw: labeled "Pickup: ..." → Korean operator "N번. region - LOCATION".
  const pickupRaw = extractPickupRaw(lines)
  const pickupTime = extractPickupTime(lines)
  const email = findValue(lines, /[\w.+-]+@[\w-]+\.[\w.-]+/)?.toLowerCase()
  const phone = findPhone(lines)
  const whatsapp = findValue(lines, /(?:WhatsApp|왓츠앱)\s*[:\/]\s*([+\d\-\s]{7,})/i)?.replace(/[\s\-()]/g, '')

  if (!leadName) return null

  const issues: string[] = []
  if (!email && !phone) issues.push('missing_contact')
  else if (!email) issues.push('missing_email')
  else if (!phone) issues.push('missing_phone')
  if (!pickupRaw) issues.push('missing_pickup')

  const confidence = computeConfidence({
    hasLead: true,
    hasRef: true,
    hasDate: !!tourDate,
    hasPickup: !!pickupRaw,
    hasContact: !!(email || phone),
  })

  if (confidence < 0.85) return null

  return {
    sourcePlatform: 'gyg',
    externalBookingId: ref,
    leadName: leadName.trim(),
    partySize,
    tourDate,
    productName: resolvedProduct,
    pickupPointRaw: pickupRaw,
    pickupPointNormalized: undefined,
    pickupTime,
    email,
    phone,
    whatsapp,
    language: inferLanguage(phone ?? whatsapp, leadName),     // Phase 26 §44.5.1
    notes: extractSideContacts(lines),                        // Phase 26 §44.5.2
    confidenceScore: confidence,
    issues,
  }
}

function findValue(lines: string[], re: RegExp): string | undefined {
  for (const l of lines) {
    const m = l.match(re)
    if (m) return (m[1] ?? m[0]).trim()
  }
  return undefined
}

// Labeled lead name uses colon-only separator (no dash). The dash variant
// previously collided with GYG proxy emails of the form
// "customer-<hash>@reply.getyourguide.com", letting the email hash become leadName.
// 2026-06-21 — GYG booking EMAILS label the customer "Main customer:" (not the
// bare "Customer:" the operator-paste path used), so without these the name fell
// through to the last-resort first-line heuristic and picked the PRODUCT title.
const LABEL_LEAD_RE =
  /^(?:(?:Main|Lead)\s+(?:customer|guest|travell?er|passenger|name)|Lead\s*Guest|Lead|Customer(?:\s+name)?|Guest(?:\s+name)?|Booker|Travell?er|Passenger|예약자|대표\s*여행자|여행자\s*인솔자\s*이름|이름|고객명)\s*:\s*(.+)$/i

// Korean operator-list inline pattern: "Name (N 명) - 겟유가이드 - REF",
// "Name (인원수 x N 명) - 클룩 - REF", "Name (성인 N 명) - 비아토르 - REF".
// 2026-05-26 — also accept English "(N Adults)" / "(N x Adults)" used by
// some operator pastes that hand-transcribe GYG bookings.
const INLINE_NAME_PAX_RE = /^([^()\n]+?)\s*\(\s*(?:인원수\s*[xX×]\s*|성인\s*)?(\d+)\s*(?:[xX×]\s*)?(?:명|Adults?)\s*\)/i

// Korean operator pickup header: "Nth. region - LOCATION (optional time)".
// Captures everything after the first " - " up to an optional trailing time.
const KOREAN_PICKUP_HEADER_RE = /^\d+\s*[번.]?\.?\s*[^\-\n]*-\s*(.+?)(?:\s+at\s+\d{1,2}:\d{2}|\s+\d{1,2}:\d{2}\b|\s*$)/

function extractLeadName(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(LABEL_LEAD_RE)
    if (m && isPlausibleName(m[1].trim())) return m[1].trim()
  }
  for (const l of lines) {
    const m = l.match(INLINE_NAME_PAX_RE)
    if (m && isPlausibleName(m[1].trim())) return m[1].trim()
  }
  // Last resort: first short plausible-name line that isn't contact/booking ID.
  for (const l of lines) {
    if (l.includes('@')) continue
    if (/^\+?\d[\d\-\s()]{5,}$/.test(l)) continue
    if (/\d{6,}/.test(l)) continue
    if (l.length > 60) continue
    if (isPlausibleName(l)) return l
  }
  return undefined
}

function extractPartySize(lines: string[]): number {
  // Group bookings: "Number of participants: 1 x Group up to 13 (9 Persons)" —
  // the true headcount is the parenthesised "(N Persons)" / "(N pax)", NOT the
  // leading "1" (group units) nor the "up to 13" cap. Gated to the group/
  // participants line so a stray "(N pax)" elsewhere can't hijack it.
  for (const l of lines) {
    if (!/Group\s+up\s+to|participants/i.test(l)) continue
    const m = l.match(/\(\s*(\d+)\s*(?:Persons?|pax)\b/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  for (const l of lines) {
    const m = l.match(/(?:Participants|Pax|People|Travelers|Adults?|인원수?|성인)\s*:\s*(\d+)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  for (const l of lines) {
    const m = l.match(/\(\s*(?:인원수\s*[xX×]\s*|성인\s*)?(\d+)\s*(?:[xX×]\s*)?(?:명|Adults?)\s*\)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  return 1
}

function extractPickupRaw(lines: string[]): string | undefined {
  // Try labeled first (still colon-only to be safe).
  for (const l of lines) {
    const m = l.match(/^(?:Pickup|Meeting Point|Hotel|Meet|픽업\s*장소?|픽업|만나는?\s*곳)\s*:\s*(.+)$/i)
    if (m && m[1].trim().length > 2) return m[1].trim()
  }
  // Korean operator header pattern.
  for (const l of lines) {
    const m = l.match(KOREAN_PICKUP_HEADER_RE)
    if (m) {
      const loc = m[1].trim()
      if (loc.length > 2 && !/^(?:Lead|Customer|Guest|email|phone)/i.test(loc)) {
        return loc
      }
    }
  }
  // 2026-05-26 — bare region-prefix pickup header ("동쪽 - Lotte Duty Free
  // Jeju Store,") without a numbered prefix. Mirrors the L2 heuristics
  // pattern at heuristics.ts:731 so the GYG L1 adapter doesn't fall back
  // to "missing_pickup" when the operator paste uses this shape.
  for (const l of lines) {
    const m = l.match(/^(?:동쪽|남쪽|서쪽|북쪽|동남쪽|서남쪽|서북쪽|동북쪽|제주항|강정항|부산항|인천항)\s*-\s*(.+)$/u)
    if (m) {
      const loc = m[1].trim().replace(/[\s,]+$/, '').replace(/^\[\d{1,2}:\d{2}\]\s*/, '')
      // Reject when the tail carries pax/platform markers — that's a one-line
      // "region - NAME (N명) - 클룩" booking, not a standalone pickup line.
      if (loc.length > 2 && !/\(\s*\d|\d+\s*[명人]|Adults?|클룩|비아토르|겟유가이드|kkday/i.test(loc)) {
        return loc
      }
    }
  }
  return undefined
}

function extractPickupTime(lines: string[]): string | undefined {
  // Labeled.
  for (const l of lines) {
    const m = l.match(/(?:Time|Pickup Time|Meeting Time|시간|픽업시간)\s*:\s*(\d{1,2}:\d{2})/i)
    if (m) return normalizeTime(m[1])
  }
  // GYG email carries the start time on the Date line: "Date: June 26, 2026 8:30 AM".
  for (const l of lines) {
    const m = l.match(/^(?:Date|Tour Date|Activity Date|Travel Date|투어\s*날짜|여행\s*날짜)\s*:[^\n]*?\b(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\b/)
    if (m) return parseClock(m[1], m[2], m[3])
  }
  // Inline in the Korean header: "Nth. region - LOCATION at HH:MM" or "...HH:MM".
  for (const l of lines) {
    if (!/^\d+\s*[번.]?\.?/.test(l)) continue
    const m = l.match(/\b(\d{1,2}:\d{2})\b/)
    if (m) return normalizeTime(m[1])
  }
  return undefined
}

function findPhone(lines: string[]): string | undefined {
  for (const l of lines) {
    for (const segment of splitContactSegments(l)) {
      const phonePart = segment.replace(/[‪-‮‎‏]/g, '').split(/(?:WhatsApp|왓츠앱)/i)[0]
      if (!phonePart.trim()) continue
      const m = phonePart.match(/(?:Phone\s*number|Phone\s*No|Phone|Mobile|Tel|전화(?:번호)?|연락처)\s*[:：\-]?\s*(\(?\+?[\d\s\-()‐‑‒–]{7,}\d)/i)
      if (m) return normalizePhone(m[1])
      const inline = extractInlinePhone(phonePart)
      if (inline) return inline
      if (/^\(?[+\d][\d\-\s()‐‑‒–]{6,}\d$/.test(phonePart.trim())) return normalizePhone(phonePart)
    }
  }
  return undefined
}

function splitContactSegments(line: string): string[] {
  return line.split(/\s\/\s/).map(s => s.trim()).filter(Boolean)
}

function extractInlinePhone(line: string): string | undefined {
  const re = /(?<![A-Z0-9-])([+＋]?\d[\d\s()\-‐‑‒–]{6,}\d)/gi
  for (const m of line.matchAll(re)) {
    const phone = normalizePhone(m[1])
    if (phone.replace(/\D/g, '').length >= 7) return phone
  }
  return undefined
}

function normalizePhone(raw: string): string {
  const t = raw.trim()
  const plus = /^[+＋]/.test(t) ? '+' : ''
  return plus + t.replace(/[^\d]/g, '')
}

function normalizeTime(s: string): string {
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return s
  return `${pad2(m[1])}:${m[2]}`
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const TOUR_DATE_LABEL_RE =
  /^(?:Tour Date|Activity Date|Travel Date|Date|투어\s*날짜|투어일?|여행\s*날짜|날짜)\s*:\s*(.+)$/i

function extractTourDate(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(TOUR_DATE_LABEL_RE)
    if (m) {
      const d = parseLooseDate(m[1])
      if (d) return d
    }
  }
  return undefined
}

// Numeric (Y-M-D, M-D-Y) plus English month name ("June 26, 2026", "26 Jun 2026").
// GYG booking emails use the long month-name form, which the numeric-only finder
// silently dropped (the date then arrived only via an L3 enrichment call).
function parseLooseDate(v: string): string | undefined {
  let m = v.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = v.match(/(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/)
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  m = v.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/)
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (mo) return `${m[3]}-${pad2(String(mo))}-${pad2(m[2])}`
  }
  m = v.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (mo) return `${m[3]}-${pad2(String(mo))}-${pad2(m[1])}`
  }
  return undefined
}

// "8:30 AM" → "08:30"; bare "14:05" passes through.
function parseClock(h: string, mm: string, ap?: string): string {
  let hh = parseInt(h, 10)
  if (ap) {
    const upper = ap.toUpperCase()
    if (upper === 'PM' && hh < 12) hh += 12
    if (upper === 'AM' && hh === 12) hh = 0
  }
  return `${pad2(String(hh))}:${mm}`
}

function pad2(s: string): string {
  return s.length < 2 ? `0${s}` : s
}

function computeConfidence(f: {
  hasLead: boolean
  hasRef: boolean
  hasDate: boolean
  hasPickup: boolean
  hasContact: boolean
}): number {
  let score = 0.5
  if (f.hasLead) score += 0.15
  if (f.hasRef) score += 0.1
  if (f.hasDate) score += 0.1
  if (f.hasPickup) score += 0.1
  if (f.hasContact) score += 0.1
  return Math.min(1, score)
}
