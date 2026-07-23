// Phase 0-bis — Klook adapter (text export from Klook Operator Center)
// Master plan §6.2

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking } from '@/lib/ops/parse/types'
// Phase 26 §44.5 — L1 adapters share the same language inference + side-contact
// preservation as L2 heuristics so field completion is uniform across layers.
import { inferLanguage, extractSideContacts, isPlausibleName } from '../heuristics'

const KLOOK_REF_RE = /\b([A-Z]{2,5}\d{6,12})\b/g          // e.g. GUH242924
const KLOOK_HEADER_RE = /\bklook|클룩\b/i
const BLOCK_SEP_RE = /\n\s*\n+/

export const klookAdapter: PlatformAdapter = {
  id: 'klook',
  label: 'Klook',

  detect(raw: string): number {
    const head = raw.slice(0, 4000)
    let score = 0
    if (KLOOK_HEADER_RE.test(head)) score += 0.5
    const refMatches = head.match(KLOOK_REF_RE)
    if (refMatches && refMatches.length >= 2) score += 0.4
    if (head.includes('Booking Reference') || head.includes('예약 참조번호')) score += 0.2
    return Math.min(1, score)
  },

  parse(raw: string): AdapterResult {
    const blocks = raw.split(BLOCK_SEP_RE).map(b => b.trim()).filter(b => b.length > 0)
    const bookings: ParsedBooking[] = []
    const leftover: string[] = []
    let currentProduct: string | undefined

    for (const block of blocks) {
      // Carry forward product heading lines: a single short line with no contact info.
      if (looksLikeProductHeading(block)) {
        currentProduct = stripProductPrefix(block)
        continue
      }

      const parsed = parseBlock(block, currentProduct)
      if (parsed) {
        bookings.push(parsed)
      } else {
        leftover.push(block)
      }
    }

    return { bookings, leftover }
  },
}

function looksLikeProductHeading(block: string): boolean {
  if (block.length > 80) return false
  if (block.includes('@')) return false
  if (/\d{4}-\d{2}-\d{2}/.test(block)) return false
  if (/\d{6,}/.test(block)) return false  // booking ID
  if (/[가-힣]{2,}/.test(block) || /[A-Za-z]{3,}/.test(block)) {
    return /(코스|투어|tour|course|experience|상품)/i.test(block)
  }
  return false
}

function stripProductPrefix(raw: string): string {
  return raw
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^상품명?\s*[:-]\s*/, '')
    .replace(/^코스명?\s*[:-]\s*/, '')
    .trim()
}

function parseBlock(block: string, productName: string | undefined): ParsedBooking | null {
  // Klook block conventions vary but key signals: a booking reference, a lead name,
  // a participant count, a date, optional pickup and contact lines.
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null

  const ref = pickFirst(block, KLOOK_REF_RE)
  if (!ref) return null

  // Colon-only label separator to avoid the "Customer-<hash>" collision (see GYG).
  const leadName = extractLeadName(lines)
  const partySize = extractPartySize(lines)
  const tourDate = findDate(lines, /(?:Tour Date|Travel Date|Date|투어일?|날짜)\s*:\s*([\d.\-/]+)/i)
  const pickupRaw = extractPickupRaw(lines)
  const pickupTime = extractPickupTime(lines)
  const email = findValue(lines, /[\w.+-]+@[\w-]+\.[\w.-]+/)?.toLowerCase()
  const phone = extractPhone(lines)
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
    sourcePlatform: 'klook',
    externalBookingId: ref,
    leadName: leadName.trim(),
    partySize,
    tourDate,
    productName,
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

function pickFirst(s: string, re: RegExp): string | undefined {
  const m = s.match(re)
  return m ? m[0] : undefined
}

function findValue(lines: string[], re: RegExp): string | undefined {
  for (const l of lines) {
    const m = l.match(re)
    if (m) return (m[1] ?? m[0]).trim()
  }
  return undefined
}

// Shared with GYG adapter — see getyourguide.ts for the "Customer-<hash>" rationale.
const LABEL_LEAD_RE = /^(?:Lead Guest|Lead|Customer|Guest|Booker|예약자|이름|고객명)\s*:\s*(.+)$/i
const INLINE_NAME_PAX_RE = /^([^()\n]+?)\s*\((?:인원수\s*x\s*|성인\s*)?(\d+)\s*명\)/
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
  for (const l of lines) {
    const m = l.match(/(?:Participants|Pax|People|Travelers|Adults?|인원수?|성인)\s*:\s*(\d+)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  for (const l of lines) {
    const m = l.match(/\((?:인원수\s*x\s*|성인\s*)?(\d+)\s*명\)/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  return 1
}

function extractPickupRaw(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(/^(?:Pickup|Meeting Point|Meet|픽업\s*장소?|픽업|만나는?\s*곳)\s*:\s*(.+)$/i)
    if (m && m[1].trim().length > 2) return m[1].trim()
  }
  for (const l of lines) {
    const m = l.match(KOREAN_PICKUP_HEADER_RE)
    if (m) {
      const loc = m[1].trim()
      if (loc.length > 2 && !/^(?:Lead|Customer|Guest|email|phone)/i.test(loc)) {
        return loc
      }
    }
  }
  return undefined
}

function extractPickupTime(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(/(?:Time|Pickup Time|Meeting Time|시간|픽업시간)\s*:\s*(\d{1,2}:\d{2})/i)
    if (m) return normalizeTime(m[1])
  }
  for (const l of lines) {
    if (!/^\d+\s*[번.]?\.?/.test(l)) continue
    const m = l.match(/\b(\d{1,2}:\d{2})\b/)
    if (m) return normalizeTime(m[1])
  }
  return undefined
}

function extractPhone(lines: string[]): string | undefined {
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

function findDate(lines: string[], re: RegExp): string | undefined {
  const v = findValue(lines, re)
  if (!v) return undefined
  let m = v.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = v.match(/(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/)
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  return undefined
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
