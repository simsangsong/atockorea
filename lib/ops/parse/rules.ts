// Phase 0-ter Loop 2 — Active parse_rules consumer
// Master plan §7.1 — mined templates promoted to status='active' apply
// deterministically between L2 heuristics and L3 LLM.
//
// Rule shape (parse_rules columns):
//   template_pattern: text with {{TOKEN}} placeholders for variable slots
//                     and literal regex elsewhere ('s' flag is used to match
//                     newlines inside the pattern).
//   slot_map:         JSON object {fieldName: 0-based-capture-group-index}.
//                     INCLUDES literal parenthesized groups in the count, NOT
//                     just {{X}} placeholders. (Verified against 10 seeded
//                     rules — see scripts/seed-parser-learning-*.ts.)
//   postprocess:      Optional handlers:
//                       set_booking_status='cancelled' → skip the row
//                       platform_normalize={src:tgt}    → normalize captured platform
//                       ship_to_port={ship:port}        → record in notes
//                       explicit_pickup_wins=true       → no-op (semantic hint)
//
// Each {{TOKEN}} is replaced with a capture pattern from TOKEN_CAPTURE before
// compilation. Tokens not in the table default to lazy '.+?'.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking, OTASource } from '@/lib/ops/parse/types'
import type { FunnelEvent } from './funnel-events'
// Phase 26 §44.5 — share language inference + side-contact extraction with L2.
import { inferLanguage as inferLanguageFromSignals, extractSideContacts as extractSideContactsFromLines, normalizeLang, isPlausibleName } from './heuristics'

export interface ActiveRule {
  id: string
  tenant_id: string | null
  scope: string
  template_pattern: string
  slot_map: Record<string, number>
  postprocess: Record<string, unknown> | null
  source: string
  match_count: number
  success_count: number
}

const VALID_OTA = new Set<OTASource>(['klook', 'gyg', 'viator', 'kkday', 'tripcom', 'csv', 'manual'])

// Token-specific capture classes. The match is *lazy* by default; specific
// classes for digits/email/phone constrain the match so adjacent literal text
// can anchor it. Add new tokens as new rules are mined.
const TOKEN_CAPTURE: Record<string, string> = {
  N: '\\d+',
  EMAIL: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
  PHONE: '\\+?[\\d\\s\\-()]{7,}',
  TIME: '\\d{1,2}:\\d{2}',
  DATE: '\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}',
  DATE_FREE: '[^/\\n]+',
  EXTID: '[A-Z0-9][A-Z0-9\\-_]{5,15}',
  LANG: '\\S+',
  // Lazy, allow-empty, slash-bounded — for optional language fields.
  // Convention (feedback memory): use {{LANG_OPT}} instead of inlining
  // a literal `([^/]*?)` capture group in template_pattern.
  LANG_OPT: '[^/]*?',
  // Same shape as LANG_OPT but semantically a pickup/location slot — used by
  // the slash-separated cruise rules to capture the pickup field that sits
  // after "{{N}} 명 / " (often empty for GYG proxy bookings). Phase 26 §44.5.
  LOCATION_OPT: '[^/]*?',
  // Name that forbids `/` AND `(` — for slash-no-parens variants where the
  // name field is followed by "platform EXTID" instead of "( platform - EXTID )".
  // Forbidding `(` prevents matching the legacy paren format (handled by 7f24bfc7).
  NAME_NOPAREN: '[^/(]+?',
  PLATFORM: '\\S+',
  // Variable text slots — non-greedy.
  NAME: '.+?',
  LOCATION: '.+?',
  REGION: '[^\\-\\n]+?',
  PRODUCT: '.+?',
  SHIP: '.+?',
  VEHICLE: '.+?',
}

export async function loadActiveRulesForTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ActiveRule[]> {
  const { data, error } = await supabase
    .from('ops_parse_rules')
    .select('id, tenant_id, scope, template_pattern, slot_map, postprocess, source, match_count, success_count')
    .eq('status', 'active')
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('success_count', { ascending: false })
  if (error || !data) return []
  return data as ActiveRule[]
}

/**
 * Phase 27 §45 (learning loop) — load a tenant's SHADOW rules for shadow-mode
 * agreement scoring. Unlike active rules, shadow rules are tenant-scoped only
 * (global rules are code-review-promoted, never auto). These never emit a booking
 * into the parse result; they are replayed against ground-truth blocks to accrue
 * the match/agreement stats Hard Rule #20's statistical promotion path needs.
 */
export async function loadShadowRulesForTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ActiveRule[]> {
  const { data, error } = await supabase
    .from('ops_parse_rules')
    .select('id, tenant_id, scope, template_pattern, slot_map, postprocess, source, match_count, success_count')
    .eq('status', 'shadow')
    .eq('tenant_id', tenantId)
    .limit(200)
  if (error || !data) return []
  return data as ActiveRule[]
}

/**
 * Apply ONE rule to ONE block, returning the booking it would emit (or null if
 * it doesn't match / is a cancellation / the builder rejects). Exported for
 * shadow-mode evaluation, which needs per-rule results (not applyRules'
 * first-match-wins semantics).
 */
export function applyRuleToBlock(rule: ActiveRule, block: string): ParsedBooking | null {
  const regex = tryCompile(rule.template_pattern)
  if (!regex) return null
  const m = block.match(regex)
  if (!m) return null
  if (rule.postprocess?.set_booking_status === 'cancelled') return null
  return buildBookingFromMatch(rule, m, block)
}

interface ApplyRulesResult {
  bookings: ParsedBooking[]
  leftover: string[]
  perRuleHits: Record<string, number>
}

/**
 * Apply a list of active rules to a set of leftover blocks. Returns the
 * bookings each rule extracted and the blocks no rule matched. The first
 * matching rule wins per block; rules are tried in the order returned by
 * loadActiveRulesForTenant (success_count desc, so the most-validated rule
 * wins ties).
 */
export function applyRules(
  rules: ActiveRule[],
  blocks: string[],
): ApplyRulesResult {
  const bookings: ParsedBooking[] = []
  const leftover: string[] = []
  const perRuleHits: Record<string, number> = {}
  if (rules.length === 0) {
    return { bookings, leftover: blocks, perRuleHits }
  }

  // Compile once per rule (cache).
  const compiled = rules.map(r => ({
    rule: r,
    regex: tryCompile(r.template_pattern),
  })).filter(c => c.regex !== null) as Array<{ rule: ActiveRule; regex: RegExp }>

  for (const block of blocks) {
    let handled = false
    for (const { rule, regex } of compiled) {
      const m = block.match(regex)
      if (!m) continue
      // Cancellation postprocess: rule matched, but emit nothing AND consume
      // the block (don't fall through to LLM).
      if (rule.postprocess?.set_booking_status === 'cancelled') {
        perRuleHits[rule.id] = (perRuleHits[rule.id] ?? 0) + 1
        handled = true
        break
      }
      const booking = buildBookingFromMatch(rule, m, block)
      if (booking) {
        bookings.push(booking)
        perRuleHits[rule.id] = (perRuleHits[rule.id] ?? 0) + 1
        handled = true
        break
      }
      // Match succeeded but builder rejected (e.g. no leadName). Try next rule.
    }
    if (!handled) leftover.push(block)
  }
  return { bookings, leftover, perRuleHits }
}

/**
 * Convenience wrapper that emits funnel events around the apply step.
 * Folds rule hits into the L2 counter (rules are deterministic, same class
 * as heuristics) and adds 'l2:rules' to layers_used for traceability.
 */
export async function runRulesLayer(
  supabase: SupabaseClient,
  tenantId: string,
  leftover: string[],
  emit: (e: FunnelEvent) => void,
): Promise<{ bookings: ParsedBooking[]; leftover: string[]; hits: number }> {
  emit({ event: 'rules_start', data: { blocks: leftover.length } })
  const rules = await loadActiveRulesForTenant(supabase, tenantId)
  if (rules.length === 0) {
    emit({ event: 'rules_done', data: { rules: 0, hits: 0 } })
    return { bookings: [], leftover, hits: 0 }
  }
  const result = applyRules(rules, leftover)
  emit({
    event: 'rules_done',
    data: {
      rules: rules.length,
      hits: result.bookings.length,
      perRule: result.perRuleHits,
      leftoverBlocks: result.leftover.length,
    },
  })
  return { bookings: result.bookings, leftover: result.leftover, hits: result.bookings.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

export function tryCompile(pattern: string): RegExp | null {
  try {
    const expanded = pattern.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
      const cap = TOKEN_CAPTURE[name] ?? '.+?'
      return `(${cap})`
    })
    return new RegExp(expanded, 's')
  } catch {
    return null
  }
}

function buildBookingFromMatch(
  rule: ActiveRule,
  m: RegExpMatchArray,
  block: string,
): ParsedBooking | null {
  const get = (key: string): string | undefined => {
    const idx = rule.slot_map[key]
    if (typeof idx !== 'number') return undefined
    const v = m[idx + 1]
    return typeof v === 'string' ? v.trim() : undefined
  }

  // Cancellation: postprocess flag short-circuits before booking emission.
  const status = rule.postprocess?.set_booking_status
  if (status === 'cancelled') {
    // Master plan §7.1 — cancelled rows should be observed but NOT routed to
    // tour rooms. For now we skip emission. A future booking_status field can
    // surface them; the row is still recorded in parse_observations via the
    // learning loop because it falls through the leftover path.
    return null
  }

  const leadName = get('name') ?? get('lead_name')
  if (!leadName) return null
  // A rule's {{NAME}} slot is a lazy capture; on noisy GYG/cruise pastes it can
  // grab interleaved metadata or instruction text instead of a person
  // ("Traveler 2: Dietary restrictions: …", "다음 내용을 꼭 참고하세요 !!").
  // Apply the same plausibility guard L1/L2 use so a junk capture falls through
  // to L3 (leftover) instead of emitting a bogus 0.92-confidence booking.
  if (!isPlausibleName(leadName)) return null

  const ref = get('external_booking_id') ?? get('extid') ?? extractFallbackRef(block) ?? `RULE-${rule.id.slice(0, 6)}`
  const partySize = toPartySize(get('party_size') ?? get('n'))

  // Platform: prefer captured value, fall back to detection from block text.
  const platformRaw = get('platform')
  const normalizedPlatform = normalizePlatform(platformRaw, rule.postprocess, block)

  const tourDate = get('tour_date') ?? get('depart_date')
  // Phase 26 §44.5.6 — collapse N/A-style placeholders to undefined so they
  // don't count as a real pickup ("원문만") in Step 4 review.
  const pickupRaw = cleanPickupValue(pickFirst(get, ['pickup_location', 'pickup_loc', 'location', 'meet_loc']))
  const pickupTime = normalizeTimeValue(get('pickup_time') ?? get('time'))
  // Email + phone: prefer captured slot, then scan the whole block. The
  // slash-separated cruise format has email/phone at variable field positions
  // (sometimes empty, sometimes in field 7, sometimes in field 8) so a rule
  // can't reliably index them. Block scan finds them either way.
  const email = get('email')?.toLowerCase() ?? extractEmailFromBlock(block)
  const phone = normalizePhoneValue(get('phone')) ?? extractPhoneFromBlock(block)
  // Phase 26 §44.5.3 — WhatsApp block scan (was hardcoded undefined).
  // Same rationale as phone scan: WhatsApp lives at variable field positions
  // in slash-separated cruise formats and would require slot_map changes on
  // every rule. Block scan covers all 12 active rules with zero rule edits.
  const whatsapp = extractWhatsAppFromBlock(block)
  // Phase 26 §44.5.1 / §44.5.9 — normalize the captured language slot to an ISO
  // code (so "English"/"영어"/"중국어" become en/ko/zh, not raw labels on the
  // card), then fall back to phone-CC + name-script inference when the slot is
  // empty/unknown. Mirror of system.txt §FIELD RULES priority order.
  const language =
    normalizeLang(get('language'))
    || inferLanguageFromSignals(phone ?? whatsapp, leadName)

  // ship_to_port postprocess → record in notes (we don't have a port field on
  // ParsedBooking; downstream booking lifecycle can use it).
  const ship = get('ship') ?? get('ship_inferred') ?? get('cruise_ship')
  const noteParts: string[] = []
  const stp = rule.postprocess?.ship_to_port as Record<string, string> | undefined
  if (stp && ship) {
    const port = stp[ship] ?? (rule.postprocess?.default_port as string | undefined)
    if (port) noteParts.push(`port=${port} via ship=${ship}`)
  } else if (ship) {
    noteParts.push(`cruise_ship=${ship}`)
  } else {
    // §44.5.18 — no ship slot: preserve any ship-bearing trailing free-text so
    // the lift backstop can recover the ship from notes.
    const shipNote = extractShipNoteFromBlock(block)
    if (shipNote) noteParts.push(shipNote)
  }
  // Phase 26 §44.5.2 — scan block lines for side-channel contacts
  // (WeChat / LINE / Kakao / Zalo / 비고). The slash-separated cruise format
  // emits these as `WeChat: drhorric29` or `LINE: fm760302` inline; we
  // split the block by newlines AND slashes (Korean operator paste uses ` / `
  // as a field separator, so side-contacts may not be on their own line).
  const sideContactLines = block.split(/\r?\n|\s\/\s/).map(s => s.trim()).filter(Boolean)
  const sideContacts = extractSideContactsFromLines(sideContactLines)
  if (sideContacts) noteParts.push(sideContacts)
  const notes = noteParts.length > 0 ? noteParts.join(' | ') : undefined

  const issues: string[] = []
  if (!email && !phone) issues.push('missing_contact')
  else if (!email) issues.push('missing_email')
  else if (!phone) issues.push('missing_phone')
  if (!pickupRaw) issues.push('missing_pickup')

  // Rule-based extractions are deterministic; emit at 0.92 confidence to sit
  // just above the LLM threshold (0.85) but below human-verified (1.0).
  return {
    sourcePlatform: normalizedPlatform,
    externalBookingId: ref,
    leadName,
    partySize,
    tourDate,
    productName: get('product'),
    pickupPointRaw: pickupRaw,
    pickupPointNormalized: undefined,   // filled by canonicalize-backstop
    pickupTime,
    email,
    phone,
    whatsapp,                            // Phase 26 §44.5.3
    language,
    notes,
    confidenceScore: 0.92,
    issues,
    cruiseShipText: ship,   // resolved to cruiseShipId by cruise-ship-backstop
  }
}

function pickFirst(get: (k: string) => string | undefined, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = get(k)
    if (v && v.length > 0) return v
  }
  return undefined
}

function toPartySize(raw: string | undefined): number {
  if (!raw) return 1
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(50, n)
}

function extractFallbackRef(block: string): string | undefined {
  const m = block.match(/\b([A-Z]{2,5}[\-_]?\d{6,15})\b/)
  return m ? m[1].replace(/[\-_]/g, '') : undefined
}

function extractEmailFromBlock(block: string): string | undefined {
  const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const parts: string[] = []
    if (i > 0 && /[\w.+-]+-$/.test(lines[i - 1])) parts.push(lines[i - 1])
    parts.push(lines[i])
    if (i + 1 < lines.length && /^[\w-]+(?:\.[\w-]+)+$/.test(lines[i + 1])) parts.push(lines[i + 1])
    if (parts.length === 1) continue

    const joined = parts.join('').replace(/\s+/g, '')
    const wrapped = joined.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (wrapped) return wrapped[0].toLowerCase()
  }

  const m = block.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  if (m) return m[0].toLowerCase()
  const compact = block.replace(/\s+/g, '')
  const compactMatch = compact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  return compactMatch ? compactMatch[0].toLowerCase() : undefined
}

function extractPhoneFromBlock(block: string): string | undefined {
  // Order matters: prefer a labeled phone, then a bare international-shaped
  // sequence. Lookbehind excludes [A-Z0-9-] so we don't capture the digit
  // portion of booking refs like "BR-1230125029" or "25KK229300245".
  const lines = block.split(/\r?\n/)
  for (const line of lines) {
    for (const segment of splitContactSegments(line)) {
      const phonePart = segment.replace(/[‪-‮‎‏]/g, '').split(/(?:WhatsApp|왓츠앱)/i)[0]
      if (!phonePart.trim()) continue
      const labeled = phonePart.match(/(?:Phone\s*number|Phone\s*No|Phone|Mobile|Tel|전화(?:번호)?|연락처)\s*[:：\-]?\s*(\(?\+?[\d\s\-()‐‑‒–]{7,}\d)/i)
      if (labeled) return normalizePhoneValue(labeled[1])
      const inline = extractInlinePhoneValue(phonePart)
      if (inline) return inline
    }
  }
  return undefined
}

function splitContactSegments(line: string): string[] {
  return line.split(/\s\/\s/).map(s => s.trim()).filter(Boolean)
}

function extractInlinePhoneValue(line: string): string | undefined {
  const re = /(?<![A-Z0-9-])([+＋]?\d[\d\s()\-‐‑‒–]{6,}\d)/gi
  for (const m of line.matchAll(re)) {
    const normalized = normalizePhoneValue(m[1])
    const digits = normalized?.replace(/\D/g, '') ?? ''
    if (digits.length >= 7) return normalized
  }
  return undefined
}

// Phase 26 §44.5.3 — labeled WhatsApp number scan. Matches the Korean
// operator paste shapes documented in `tmp/bulk-jeju-v3.txt`:
//   "WhatsApp: +6598226078"   (line 5, English label + plus prefix)
//   "WhatsApp: 91384677"      (line 13, English label, bare digits)
//   "왓츠앱/85290248278"       (line 62, Korean label, slash separator)
//   "(WhatsApp): +1 415..."    (현장결제 paren-wrapped label)
// We accept ALL of these. Pre-Phase-26, rules.ts hardcoded undefined here.
function extractWhatsAppFromBlock(block: string): string | undefined {
  const cleaned = block.replace(/[‪-‮‎‏]/g, '')
  const m = cleaned.match(/\(?\s*(?:WhatsApp|왓츠앱)\s*\)?\s*[:/]?\s*([+＋]?[\d\s\-()（）‐‑‒–]{7,})/i)
  return m ? normalizePhoneValue(m[1]) : undefined
}

// §44.5.18 — single-line GYG cruise rows carry the ship name in a trailing
// free-text field ("… / phone / Celebrity Millennium / arrive 7am" or a whole
// sentence "we are on the celebrity millennium…"). The basic GYG rule has no
// ship slot, so without this the ship is dropped and the booking lands in the
// ship-less manual bucket. We don't try to parse the ship here — we just keep
// the ship-bearing segment(s) in notes so the cruise-ship-backstop lift can
// substring-resolve it. Per-segment alternation test (no nested quantifiers,
// ReDoS-safe against the long v3 blocks).
const SHIP_SIGNAL_RE =
  /royal\s*carib|celebrity|ovation|anthem|equinox|mill?enn?ium|milenn?ium|norwegian|\bncl\b|costa|diamond\s*princess|spectrum|quantum|크루즈선|cruise\s*ship|\bship\s*[:#]/i

function extractShipNoteFromBlock(block: string): string | undefined {
  const segs = block.split(/\r?\n|\s\/\s/).map(s => s.trim()).filter(Boolean)
  const hits = segs.filter(s => SHIP_SIGNAL_RE.test(s))
  if (hits.length === 0) return undefined
  return hits.join(' | ').slice(0, 300)
}

function normalizePlatform(
  raw: string | undefined,
  postprocess: Record<string, unknown> | null | undefined,
  block: string,
): OTASource {
  const map = (postprocess?.platform_normalize ?? {}) as Record<string, string>
  if (raw) {
    const direct = map[raw] ?? map[raw.toLowerCase()]
    if (direct && VALID_OTA.has(direct as OTASource)) return direct as OTASource
    const lower = raw.toLowerCase()
    if (VALID_OTA.has(lower as OTASource)) return lower as OTASource
  }
  // Fallback: detect from block text.
  if (/겟유가이드|getyourguide|\bGYG/i.test(block)) return 'gyg'
  if (/클룩|klook/i.test(block)) return 'klook'
  if (/비아토르|viator|\bBR-/i.test(block)) return 'viator'
  if (/kkday|케이케이데이/i.test(block)) return 'kkday'
  if (/트립닷컴|tripcom|trip\.com/i.test(block)) return 'tripcom'
  return 'manual'
}

function normalizeTimeValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  const h = parseInt(m[1], 10)
  if (h < 0 || h > 23) return undefined
  return `${pad2(m[1])}:${m[2]}`
}

function normalizePhoneValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const hasPlus = /^[+＋]/.test(raw.trim())
  const digits = raw.replace(/\D/g, '')
  return digits ? `${hasPlus ? '+' : ''}${digits}` : undefined
}

// Phase 26 §44.5.6 — pickup placeholder collapse (mirror of llm.ts cleanPickup).
function cleanPickupValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const v = raw.trim()
  if (v.length === 0) return undefined
  if (/^(?:n\/?a|none|null|-+|해당\s*없음)$/i.test(v)) return undefined
  // §44.5.11 — punctuation-only junk (bare "/" etc.) is never a real pickup.
  if (!/[\p{L}\p{N}]/u.test(v)) return undefined
  return v
}

function pad2(s: string): string {
  return s.length < 2 ? `0${s}` : s
}
