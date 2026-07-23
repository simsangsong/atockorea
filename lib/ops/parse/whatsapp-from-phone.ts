// Infer the WhatsApp field from an international phone number.
//
// Rationale: OTAs (Viator, GetYourGuide, Klook) often deliver only a phone
// number for foreign guests. The number is almost always WhatsApp-reachable
// — Viator has no separate WhatsApp field, GYG's optional field is rarely
// filled — so leaving `whatsapp` empty hides a usable contact channel and
// later forces the guide to retype the number for the wa.me deep link.
//
// We only infer when:
//   - whatsapp is empty AND phone is set
//   - phone parses to a digits-with-country-code form (≥10 digits)
//   - country code is NOT 81 / 86 (Japan uses LINE, Mainland China uses
//     WeChat and blocks WhatsApp — copying the phone there would be wrong /
//     misleading). Korean +82 guest phone numbers are still useful for the
//     operator's WhatsApp CTA, so they are inferred.
//
// Output: stores phone in whatsapp WITH a leading "+" for consistency with
// explicit WhatsApp parses (e.g. "WhatsApp: +491786916170" → "+491786916170").
// resolveWhatsAppDigits() in src/lib/messaging strips the + at deep-link time.

import type { ParsedBooking } from '@/lib/ops/parse/types'

// Country codes that prefer NON-WhatsApp messengers. Inference is suppressed
// for these so we never imply WhatsApp where it isn't the primary channel.
const NON_WA_COUNTRY_CODES = new Set(['81', '86'])

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Detect the country code at the start of a digits string. Tries 1-3 digit
 * prefixes against a known list. Returns null when no plausible country code
 * can be identified.
 */
export function detectCountryCode(digits: string): string | null {
  if (digits.length < 8) return null
  // 1-digit (NANP: US/CA = 1, Russia/Kazakhstan = 7)
  if (digits[0] === '1' || digits[0] === '7') return digits[0]
  // 2-digit codes (most of Europe + UK 44 + KR 82 + JP 81 + AU 61 + many more)
  // The full ITU list is hundreds of codes; we only care about excluding
  // 82/81/86 — every other 2-digit prefix is acceptable for WhatsApp.
  const c2 = digits.slice(0, 2)
  // 3-digit codes (most non-Europe, e.g. 971 UAE, 886 TW, 358 FI, 852 HK, 65 SG)
  const c3 = digits.slice(0, 3)
  // Heuristic: prefer 2-digit when the prefix is one of the dense 2-digit
  // ranges; otherwise fall back to 3. This is approximate — exact ITU parsing
  // would be overkill since the only decision we make is "is this in 82/81/86?".
  // Common 2-digit prefixes:
  const DENSE_2 = new Set([
    '20', '27', '30', '31', '32', '33', '34', '36', '39',
    '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '51', '52', '53', '54', '55', '56', '57', '58',
    '60', '61', '62', '63', '64', '65', '66',
    '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
  ])
  if (DENSE_2.has(c2)) return c2
  return c3
}

/** True when a phone string is plausibly an international mobile and not in a
 *  WhatsApp-suppressed country. */
export function phoneImpliesWhatsApp(phone: string | null | undefined): boolean {
  if (!phone) return false
  const intl = toInternationalDigits(phone)
  if (!intl) return false
  const { digits, countryCode } = intl
  // Total digits-with-country-code typically 10-15 (ITU-T E.164).
  if (digits.length < 10 || digits.length > 15) return false
  if (NON_WA_COUNTRY_CODES.has(countryCode)) return false
  return true
}

/** Build the canonical WhatsApp value we store: digits-only with a leading +. */
export function toWhatsAppString(phone: string): string | null {
  const intl = toInternationalDigits(phone)
  if (!intl) return null
  const { digits } = intl
  if (digits.length < 10 || digits.length > 15) return null
  return '+' + digits
}

function toInternationalDigits(phone: string): { digits: string; countryCode: string } | null {
  const digits = digitsOnly(phone)
  // Korean local mobile form. In this app, bare 010 numbers come from Korean
  // operator rosters; make the wa.me target E.164 instead of "+010...".
  if (/^010\d{8}$/.test(digits)) {
    return { digits: `82${digits.slice(1)}`, countryCode: '82' }
  }

  const countryCode = detectCountryCode(digits)
  if (!countryCode) return null
  const subscriber = digits.slice(countryCode.length).replace(/^0+/, '')
  if (subscriber.length < 6) return null
  return { digits: `${countryCode}${subscriber}`, countryCode }
}

export interface InferenceResult {
  filled: number
  affectedBookingIds: number[]  // positional indexes — useful for emit/tests
}

/**
 * Mutates each booking in `bookings`: when phone is present, whatsapp is
 * empty, and phoneImpliesWhatsApp passes, copy a cleaned international form
 * into the whatsapp field. NEVER overrides an existing whatsapp value
 * (deterministic / explicit always wins).
 */
export function inferWhatsappFromPhone(bookings: ParsedBooking[]): InferenceResult {
  let filled = 0
  const affected: number[] = []
  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i]
    if (b.whatsapp && b.whatsapp.trim().length > 0) continue
    if (hasNoWhatsAppSignal(b)) continue
    if (!b.phone || b.phone.trim().length === 0) continue
    if (!phoneImpliesWhatsApp(b.phone)) continue
    const wa = toWhatsAppString(b.phone)
    if (!wa) continue
    b.whatsapp = wa
    filled++
    affected.push(i)
  }
  return { filled, affectedBookingIds: affected }
}

function hasNoWhatsAppSignal(b: ParsedBooking): boolean {
  const text = [
    b.notes ?? '',
    ...(Array.isArray(b.issues) ? b.issues : []),
  ].join(' ')
  return textSignalsNoWhatsApp(text)
}

// Free-text markers an operator writes when a guest explicitly has no WhatsApp:
// "no whatsapp", "no_whatsapp", "no wa", "whatsapp=no". Shared by the parser
// (suppress phone→whatsapp inference) and the runtime send list (suppress the
// WhatsApp channel and show a "WhatsApp 없음" marker) so both stay in sync.
const NO_WHATSAPP_RE = /\bno[_\s-]*whats?\s*app\b|\bno[_\s-]*wa\b|whats?\s*app\s*=\s*no|no_whatsapp/

export function textSignalsNoWhatsApp(text: string | null | undefined): boolean {
  if (!text) return false
  return NO_WHATSAPP_RE.test(text.toLowerCase())
}

/**
 * Country-code propagation between phone ↔ whatsapp fields.
 *
 * Real-world source pattern (Klook Korean operator paste):
 *   email +972-0546168552
 *   WhatsApp: 0546168552
 *
 * Phone carries the country code (+972), WhatsApp is the same subscriber
 * number minus the trunk-zero AND minus the CC. The current parser keeps
 * WhatsApp as the literal "0546168552" — `inferWhatsappFromPhone` skips
 * because WhatsApp is non-empty, and wa.me later fails to dial (missing CC).
 *
 * Rules (user spec, 2026-05-26):
 *   ① If one side has a country code (leading +) and the other side is
 *      either empty OR present-but-no-CC AND the digits plausibly match
 *      the CC-bearing subscriber digits → backfill the no-CC side with the
 *      CC version. Works symmetrically (phone→wa AND wa→phone).
 *   ② If BOTH sides have a country code → leave them as is, even if the
 *      numbers differ (operator may have intentionally noted two channels).
 *   ③ If NEITHER side has a country code → no-op (no CC to propagate).
 *
 * Trunk-zero handling: every common country uses "0" as a domestic trunk
 * prefix that drops when dialed internationally — KR 010-xxx → +82-10-xxx,
 * AU 0430-xxx → +61-430-xxx, IL 054-xxx → +972-54-xxx, NL 06-xxx → +31-6-xxx.
 * When merging, the local subscriber portion has any leading 0s stripped
 * before being concatenated with the CC.
 *
 * Plausibility check: the no-CC subscriber digits (after trunk-zero strip)
 * must match the CC-bearing subscriber digits (digits after CC, with their
 * own leading 0s stripped). At least 6 digits required.
 */
export function propagateCountryCode(bookings: ParsedBooking[]): {
  filledWhatsapp: number
  filledPhone: number
  affectedBookingIds: number[]
} {
  let filledWhatsapp = 0
  let filledPhone = 0
  const affected = new Set<number>()

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i]
    const phone = b.phone?.trim() ?? ''
    const wa = b.whatsapp?.trim() ?? ''
    if (!phone && !wa) continue

    const phoneHasCC = phone.length > 0 && /^[+＋]/.test(phone)
    const waHasCC    = wa.length > 0    && /^[+＋]/.test(wa)

    // ② Both have CC → leave as is.
    if (phoneHasCC && waHasCC) continue
    // ③ Neither has CC → leave as is.
    if (!phoneHasCC && !waHasCC) continue

    // Respect an explicit "no WhatsApp" marker: never populate the whatsapp
    // field from the phone number for these guests (mirrors
    // inferWhatsappFromPhone, which already skips them). The wa→phone direction
    // is still allowed since that fills a call number, not a WhatsApp channel.
    if (phoneHasCC && hasNoWhatsAppSignal(b)) continue

    // ① Exactly one has CC. Determine source (CC-bearing) and target (no-CC).
    const source = phoneHasCC ? phone : wa
    const targetPresent = phoneHasCC ? wa : phone
    const sourceDigits = digitsOnly(source)
    const cc = detectCountryCode(sourceDigits)
    if (!cc) continue
    const sourceSubscriber = sourceDigits.slice(cc.length).replace(/^0+/, '')
    if (sourceSubscriber.length < 6) continue

    let merged: string | null = null

    if (!targetPresent) {
      // Target empty → propagate the source's own subscriber form.
      merged = '+' + cc + sourceSubscriber
    } else {
      // Target present-but-no-CC → confirm digits match before mutating.
      // 2026-05-26 — also strip a leading CC if the target happens to start
      // with the CC digits without a "+" (operator paste sometimes writes
      // "353-894771075" where the local subscriber number doesn't naturally
      // start with the country code; here the digits "353" ARE the CC + the
      // dash separator stripped). Without this guard the merger would emit
      // "+353" + "353894771075" = "+353353894771075" (double CC).
      const targetRawDigits = digitsOnly(targetPresent)
      const targetWithoutCC = targetRawDigits.startsWith(cc) && targetRawDigits.length >= cc.length + 7
        ? targetRawDigits.slice(cc.length)
        : targetRawDigits
      const targetSubscriber = targetWithoutCC.replace(/^0+/, '')
      if (targetSubscriber.length < 6) continue
      // Match check: shorter one is a suffix of (or equal to) the longer one.
      // Tolerates leading-zero / formatting variance like 80720658 vs 080720658.
      const [shorter, longer] = targetSubscriber.length <= sourceSubscriber.length
        ? [targetSubscriber, sourceSubscriber]
        : [sourceSubscriber, targetSubscriber]
      if (!longer.endsWith(shorter)) continue
      merged = '+' + cc + targetSubscriber
    }

    if (!merged) continue

    if (phoneHasCC) {
      // phone is the source; mutate whatsapp.
      if (b.whatsapp !== merged) {
        b.whatsapp = merged
        filledWhatsapp++
        affected.add(i)
      }
    } else {
      // wa is the source; mutate phone.
      if (b.phone !== merged) {
        b.phone = merged
        filledPhone++
        affected.add(i)
      }
    }
  }

  return {
    filledWhatsapp,
    filledPhone,
    affectedBookingIds: Array.from(affected).sort((a, b) => a - b),
  }
}
