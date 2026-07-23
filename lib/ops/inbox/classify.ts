// AtoC 통합 Phase 1 slice 2 — inbox channel + intent classification (plan §3 A-3/A-4).
//
// Deterministic, zero-LLM: sender domain first, subject keywords as fallback.
// 'unrelated' intent short-circuits the pipeline (logged as 'ignored', no parse).
// This module is PURE — no I/O — so it is fully unit-testable.

export type InboundChannel = 'klook' | 'viator' | 'gyg' | 'kkday' | 'atoc' | 'unknown'
export type InboundIntent = 'confirm' | 'cancel' | 'change' | 'unrelated'

export interface InboundClassification {
  channel: InboundChannel
  intent: InboundIntent
}

// ── Channel: sender domain map (A-3) ─────────────────────────────────────────
// OTA notification mails are Gmail-forwarded into the inbox (plan A-1), so the
// envelope sender may be the operator's Gmail — the ORIGINAL sender surfaces in
// the forwarded body/subject. Domain match runs on the From address first; the
// subject/body keyword fallback below catches the forwarded case.
const DOMAIN_CHANNEL: Array<{ rx: RegExp; channel: InboundChannel }> = [
  { rx: /(^|[.@])klook\.com$/i, channel: 'klook' },
  { rx: /(^|[.@])viator\.com$/i, channel: 'viator' },
  { rx: /(^|[.@])tripadvisor\.com$/i, channel: 'viator' },
  { rx: /(^|[.@])getyourguide\.(com|de)$/i, channel: 'gyg' },
  { rx: /(^|[.@])kkday\.com$/i, channel: 'kkday' },
  { rx: /(^|[.@])atockorea\.com$/i, channel: 'atoc' },
]

// Subject/body keyword fallback — longest/most-specific markers only, to keep
// determinism (a stray "guide" must not classify gyg).
const KEYWORD_CHANNEL: Array<{ rx: RegExp; channel: InboundChannel }> = [
  { rx: /\bklook\b/i, channel: 'klook' },
  { rx: /\bviator\b/i, channel: 'viator' },
  { rx: /\bgetyourguide\b|\bGYG\b/i, channel: 'gyg' },
  { rx: /\bkkday\b/i, channel: 'kkday' },
  { rx: /\batoc\s?korea\b|\bA2C-[0-9A-F]{8}\b/i, channel: 'atoc' },
]

export function classifyChannel(fromEmail: string | null | undefined, subject: string, bodyExcerpt = ''): InboundChannel {
  const domain = String(fromEmail ?? '').trim().toLowerCase().split('@').pop() ?? ''
  if (domain) {
    for (const d of DOMAIN_CHANNEL) {
      if (d.rx.test(domain) || d.rx.test(`@${domain}`)) return d.channel
    }
  }
  // Forwarded-mail fallback: subject first, then the first slice of the body
  // (OTA templates always name the platform near the top).
  const haystack = `${subject}\n${bodyExcerpt.slice(0, 2000)}`
  for (const k of KEYWORD_CHANNEL) {
    if (k.rx.test(haystack)) return k.channel
  }
  return 'unknown'
}

// ── Intent (A-4): cancel > change > confirm > unrelated ─────────────────────
const CANCEL_RX =
  /\bcancel(?:led|ed|lation|ation)?\b|\brefund(?:ed)?\b|取消|취소/i
const CHANGE_RX =
  /\bamend(?:ed|ment)?\b|\breschedul(?:e|ed|ing)\b|\bdate\s+change\b|\bmodif(?:y|ied|ication)\b|\bupdated\s+booking\b|\bbooking\s+(?:change|updated?)\b|변경|更改/i
const CONFIRM_RX =
  /\bnew\s+(?:booking|order|reservation)\b|\bbooking\s+(?:confirm(?:ed|ation)?|received)\b|\bconfirm(?:ed|ation)\b|\bvoucher\b|\breservation\b|\byou\s+have\s+a\s+booking\b|예약\s*확정|新訂單|新预订/i

export function classifyIntent(subject: string, bodyExcerpt = '', channel: InboundChannel = 'unknown'): InboundIntent {
  const haystack = `${subject}\n${bodyExcerpt.slice(0, 2000)}`
  if (CANCEL_RX.test(haystack)) return 'cancel'
  if (CHANGE_RX.test(haystack)) return 'change'
  if (CONFIRM_RX.test(haystack)) return 'confirm'
  // A known OTA channel mail that mentions a booking reference is a confirm-ish
  // notification even without the exact keyword (subject truncation happens);
  // an unknown channel with no intent keyword is noise → ignore (A-4).
  if (channel !== 'unknown' && /\b(booking|order|reservation|ref(?:erence)?)\b|예약/i.test(haystack)) {
    return 'confirm'
  }
  return 'unrelated'
}

export function classifyInbound(input: {
  fromEmail: string | null | undefined
  subject: string
  bodyExcerpt?: string
}): InboundClassification {
  const subject = input.subject ?? ''
  const body = input.bodyExcerpt ?? ''
  const channel = classifyChannel(input.fromEmail, subject, body)
  const intent = classifyIntent(subject, body, channel)
  return { channel, intent }
}
