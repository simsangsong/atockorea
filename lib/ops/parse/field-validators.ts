// Phase 27 §45 Sprint 27.H — semantic field validators.
//
// `normalize()` in llm.ts coerces LLM output (trim/lowercase/clamp) but never
// asks "does this value belong in this field?". That gap is how a mis-mapped
// LLM row ships: a guide-name in pickupPointRaw, a header row as leadName, an
// email in the phone slot. These pure type-validators answer that question so
// repair.ts can re-route a mis-typed value and confidence.ts can score honesty.
//
// Language-agnostic by design (Unicode \p{L}, never Latin-only) — required for
// international expansion. Reuses the canonical signal regexes (#17) and the
// single name-plausibility guard (isPlausibleName) rather than re-authoring them.
//
// ReDoS-safety (§45.5): anchored, bounded quantifiers, explicit classes.

import { SIGNAL_RE } from './signals'
import { isPlausibleName } from './heuristics'

export type FieldType = 'email' | 'phone' | 'whatsapp' | 'time' | 'date' | 'pax' | 'name' | 'platform'

const EMAIL_FULL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/
const TIME_FULL_RE = /^([01]?\d|2[0-3]):[0-5]\d$/
const DATE_FULL_RE = /^\d{4}-\d{2}-\d{2}$/

/** A standalone email address. */
export function isEmailLike(v: string): boolean {
  return EMAIL_FULL_RE.test(v.trim())
}

/** A phone number: 7–15 digits, only phone-shaped glyphs, NOT an email. A bare
 *  pax integer (1–50) is intentionally NOT phone-like (too few digits). */
export function isPhoneLike(v: string): boolean {
  const t = v.trim()
  if (t.includes('@')) return false
  if (!/^[+＋]?[\d\s\-()．.‐-―]+$/.test(t)) return false
  const digits = t.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** WhatsApp is a phone number by shape; the distinction is the source label,
 *  not the value. Kept as its own predicate for symmetry with the field. */
export function isWhatsAppLike(v: string): boolean {
  return isPhoneLike(v)
}

/** HH:MM 24-hour. */
export function isTimeLike(v: string): boolean {
  return TIME_FULL_RE.test(v.trim())
}

/** An ISO date (the form normalize emits) or a recognizable date token. */
export function isDateLike(v: string): boolean {
  const t = v.trim()
  if (DATE_FULL_RE.test(t)) return true
  return SIGNAL_RE.date.test(t)
}

/** A plausible party size: an integer 1..50 (string or number). */
export function isPaxLike(v: string | number): boolean {
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isInteger(n) && n >= 1 && n <= 50
}

/** A person/lead name. Reuses the single name-plausibility guard so every layer
 *  (adapters, heuristics, rules, repair) rejects the same junk (header rows,
 *  label lines, notice text). Also rejects values that are clearly another
 *  type (an email / a bare phone / a date). */
export function isNameLike(v: string): boolean {
  const t = v.trim()
  if (!t) return false
  if (isEmailLike(t) || isPhoneLike(t) || isDateLike(t) || isTimeLike(t)) return false
  if (looksLikeDelimitedHeaderRow(t)) return false
  return isPlausibleName(t)
}

// A column-header row mis-mapped as a leadName — the classic broken-first-tenant
// failure ("이름 / 전화 / 픽업", "Name | Phone | Pickup"). A real person name does
// not pack ≥2 field-label keywords. isPlausibleName misses these because they
// carry no colon. Multilingual label set; bounded alternation (ReDoS-safe).
const HEADER_LABEL_RE =
  /이름|성명|전화|연락처|픽업|이메일|메일|날짜|예약|인원|name|phone|tel|e-?mail|pickup|date|guest|pax|adults?/gi
function looksLikeDelimitedHeaderRow(t: string): boolean {
  if (!/[/|,\t]/.test(t)) return false // headers are delimited; plain names aren't
  const hits = t.match(HEADER_LABEL_RE)
  return !!hits && new Set(hits.map(h => h.toLowerCase())).size >= 2
}

/** Names an OTA / booking channel. */
export function isPlatformLike(v: string): boolean {
  return SIGNAL_RE.platform.test(v.trim())
}

/**
 * All semantic types a value plausibly belongs to (a value may match several:
 * a WhatsApp number is both phone and whatsapp). Empty array = the value
 * matches no recognized type (junk / free-text note).
 */
export function classifyValue(value: string | number): FieldType[] {
  if (typeof value === 'number') return isPaxLike(value) ? ['pax'] : []
  const v = value.trim()
  if (!v) return []
  const out: FieldType[] = []
  if (isEmailLike(v)) out.push('email')
  if (isPhoneLike(v)) {
    out.push('phone')
    out.push('whatsapp')
  }
  if (isTimeLike(v)) out.push('time')
  if (isDateLike(v)) out.push('date')
  if (isPaxLike(v)) out.push('pax')
  if (isPlatformLike(v)) out.push('platform')
  if (isNameLike(v)) out.push('name')
  return out
}
