// Phase 27 §45 Sprint 27.H — signal single-source (detection + token extraction).
//
// Hard Rule #17 (signal single-source-of-truth): the per-block presence of a
// phone / email / whatsapp / ship / pickup / date / platform signal is decided
// HERE and nowhere else. Sprint 0's normalize.buildInputContext reads
// detectSignals(); the Sprint 27.H self-repair layer (repair.ts) reads
// extractSignalTokens(). Both share ONE set of regexes (`SIGNAL_RE`) so a
// detector and a token-extractor can never drift apart — that drift is exactly
// the regex trap #17 forbids.
//
// Token extraction is the new capability self-repair needs: detection answers
// "does this block carry a phone?", extraction answers "WHAT is the phone?" so
// a mis-mapped LLM field can be corrected against the block's own ground truth.
//
// ReDoS-safety (§45.5): every regex is anchored / literal-alternation, bounded
// quantifiers only, `[^\n]`/explicit classes instead of `.`. Validated against
// the v3 693-block corpus hard-timeout assertion in __tests__/signals.test.ts.

/** Fold full-width ASCII (U+FF01–FF5E) → half-width and unicode spaces → ' '.
 *  Byte-identical to the original normalize.foldWidth; re-exported by
 *  normalize.ts so existing callers keep their import path. */
export function foldWidth(s: string): string {
  return s
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[　   ]/g, ' ')
}

// ── canonical signal regexes (the ONE source — #17) ──────────────────────────

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
const WHATSAPP_RE = /(?:WhatsApp|왓츠앱)/i
// Cruise ship signal: superset of rules.ts SHIP_SIGNAL_RE + Korean cruise terms.
// Literal alternation with bounded inter-word \s* only — ReDoS-safe.
// 2026-06-21 — the BARE keyword "크루즈" is intentionally NOT a ship signal: it
// appears in product descriptions ("크루즈 승객을 위한 부산 투어" — a Busan tour
// FOR cruise passengers, no ship to extract) and was firing fruitless L3 ship
// enrichment that then hallucinated a pickup. A real ship needs a name or an
// explicit marker — "크루즈선" / "Cruise Ship:" / 승선 / 하선 시간 still match.
const SHIP_SIGNAL_RE =
  /royal\s*carib|celebrity|ovation|anthem|equinox|mill?enn?ium|milenn?ium|norwegian|\bncl\b|costa|diamond\s*princess|spectrum|quantum|voyager|크루즈선|cruise\s*ship|\bship\s*[:#]|하선\s*시간|승선/i
const PHONE_LABEL_RE = /(?:Phone|Mobile|Tel|전화(?:번호)?|연락처)\s*[:\-/]?\s*\(?\+?[\d\s\-()]{7,}/i
const BARE_PHONE_RE = /^\(?\+?\d[\d\s\-()]{6,}$/
const PICKUP_LABEL_RE =
  /^(?:Pickup|Meeting Point|Meet|Hotel|픽업\s*장소?|픽업\s*위치|픽업지|픽업|만나는?\s*곳|만남의\s*장소|하차\s*위치)\s*[:\-]/i
// Korean numbered roster header: "N. region - LOCATION ...". Bounded region run.
const NUMBERED_PICKUP_RE = /^\d+\s*[번.]\.?\s*[^\-\n]{0,40}-\s*[^\n]/
// Date signal: ISO (2026-05-31), slash/dot (5/31, 05.31), or Korean (5월 31일).
const DATE_SIGNAL_RE = /\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b|\b\d{1,2}\s*[월/.\-]\s*\d{1,2}\s*일?\b/
// OTA platform signal: the block names a booking channel.
// Korean OTA spellings mirror platform-label.ts so the signal detector
// recognizes the same channels the label normalizer does (#17 single source).
const PLATFORM_SIGNAL_RE =
  /klook|getyourguide|get\s*your\s*guide|\bgyg\b|viator|tripadvisor|kkday|trip\.?com|클룩|비아토르|트립닷컴|겟유어가이드|케이케이데이|마이리얼트립|와그|waug|expedia|agoda|trazy/i

/** The canonical regex set. Exported read-only so callers REUSE (never
 *  re-author) a signal pattern. */
export const SIGNAL_RE = {
  email: EMAIL_RE,
  whatsapp: WHATSAPP_RE,
  ship: SHIP_SIGNAL_RE,
  phoneLabel: PHONE_LABEL_RE,
  barePhone: BARE_PHONE_RE,
  pickupLabel: PICKUP_LABEL_RE,
  numberedPickup: NUMBERED_PICKUP_RE,
  date: DATE_SIGNAL_RE,
  platform: PLATFORM_SIGNAL_RE,
} as const

// ── per-block presence detection (was normalize.computeBlockSignals) ──────────

export interface DetectedSignals {
  phone: boolean
  email: boolean
  whatsapp: boolean
  ship: boolean
  pickup: boolean
  date: boolean
  platform: boolean
}

/** Split a block into segments by newline OR the ` / ` field separator (Korean
 *  operator paste packs many fields onto one slash-separated line). */
function splitSegments(text: string): string[] {
  return text
    .split(/\r?\n|\s\/\s/)
    .map(s => s.trim())
    .filter(Boolean)
}

function hasPhoneSignal(seg: string): boolean {
  return PHONE_LABEL_RE.test(seg) || BARE_PHONE_RE.test(seg)
}

function hasPickupSignal(seg: string): boolean {
  return PICKUP_LABEL_RE.test(seg) || NUMBERED_PICKUP_RE.test(seg)
}

/** Per-block source-signal presence. The single detection source (#17). */
export function detectSignals(block: string): DetectedSignals {
  const scan = foldWidth(block) // robust to full-width / unicode spaces
  const segs = splitSegments(scan)
  return {
    phone: segs.some(hasPhoneSignal),
    email: EMAIL_RE.test(scan),
    whatsapp: WHATSAPP_RE.test(scan),
    ship: SHIP_SIGNAL_RE.test(scan),
    pickup: segs.some(hasPickupSignal),
    date: DATE_SIGNAL_RE.test(scan),
    platform: PLATFORM_SIGNAL_RE.test(scan),
  }
}

// ── concrete token extraction (new — self-repair ground truth) ────────────────

/** Canonicalize a phone string to "+<digits>" / "<digits>". Mirrors the
 *  heuristics field extractor's normalizePhone; kept here so the token
 *  extractor and the signal detector share one phone normalization. */
export function normalizePhone(s: string): string {
  const t = s.trim()
  const plus = /^[+＋]/.test(t) ? '+' : ''
  return plus + t.replace(/[^\d]/g, '')
}

export interface SignalTokens {
  emails: string[]
  phones: string[]
  whatsapps: string[]
  dates: string[] // ISO YYYY-MM-DD
  times: string[] // HH:MM 24h
  pax: number[]
}

// Global variants for multi-match token scans (SIGNAL_RE entries are single-shot
// test regexes; token extraction needs `g`). Derived from SIGNAL_RE.source — not
// re-authored by hand — so #17 still holds.
const EMAIL_RE_G = new RegExp(EMAIL_RE.source, 'gi')
const PHONE_LABEL_RE_G = new RegExp(PHONE_LABEL_RE.source, 'gi')

/**
 * Extract the concrete signal tokens carried by a block. Used by repair.ts to
 * replace a mis-mapped or empty LLM field with the block's own ground-truth
 * value. Conservative: only the unambiguous, deterministically-extractable types
 * (email / phone / whatsapp / date / time / pax). Ship and pickup tokens stay the
 * heuristics' job (they need block context) — self-repair handles those by
 * re-routing mis-typed values, not by pulling a token here.
 */
// Real booking blocks are small; token extraction beyond this is pointless and
// only invites pathological-input cost (a phone/email/date is short and lives
// near the top of a block). Cap defensively — behavior-neutral for real input.
const MAX_SCAN_CHARS = 8000
const MAX_PHONE_SEG_CHARS = 200

export function extractSignalTokens(block: string): SignalTokens {
  const scan = foldWidth(block.length > MAX_SCAN_CHARS ? block.slice(0, MAX_SCAN_CHARS) : block)
  const segs = splitSegments(scan)

  const emails = uniq(matchAll(scan, EMAIL_RE_G).map(e => e.toLowerCase()))

  const phones: string[] = []
  const whatsapps: string[] = []
  for (const seg of segs) {
    if (seg.length > MAX_PHONE_SEG_CHARS) continue // a phone is never this long
    // WhatsApp-labeled number → whatsapp; else a phone label / bare phone → phone.
    const wa = seg.match(/(?:WhatsApp|왓츠앱)\s*[:/]?\s*([+＋]?[\d\-\s()（）]{7,})/i)
    if (wa) {
      const n = normalizePhone(wa[1])
      if (digitCount(n) >= 7) whatsapps.push(n)
      continue
    }
    const labeled = seg.match(PHONE_LABEL_RE_G)
    if (labeled) {
      for (const m of labeled) {
        const n = normalizePhone(m.replace(/^[^\d+＋]*/, ''))
        if (digitCount(n) >= 7) phones.push(n)
      }
      continue
    }
    if (BARE_PHONE_RE.test(seg) && !EMAIL_RE.test(seg)) {
      const n = normalizePhone(seg)
      if (digitCount(n) >= 7) phones.push(n)
    }
  }

  return {
    emails,
    phones: uniq(phones),
    whatsapps: uniq(whatsapps),
    dates: uniq(extractDates(scan)),
    times: uniq(extractTimes(segs)),
    pax: uniqNums(extractPax(scan)),
  }
}

function extractDates(scan: string): string[] {
  const out: string[] = []
  for (const m of matchAllGroups(scan, /\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/g)) {
    out.push(`${m[1]}-${pad2(m[2])}-${pad2(m[3])}`)
  }
  for (const m of matchAllGroups(scan, /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g)) {
    out.push(`${m[3]}-${pad2(m[1])}-${pad2(m[2])}`)
  }
  return out
}

function extractTimes(segs: string[]): string[] {
  const out: string[] = []
  for (const seg of segs) {
    if (seg.includes('@')) continue
    const m = seg.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s*(AM|PM|오전|오후))?/i)
    if (!m) continue
    let h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h < 0 || h > 23 || min < 0 || min > 59) continue
    const ampm = m[3]
    if (ampm) {
      const upper = ampm.toUpperCase()
      if ((upper === 'PM' || ampm === '오후') && h < 12) h += 12
      if ((upper === 'AM' || ampm === '오전') && h === 12) h = 0
    }
    out.push(`${pad2(String(h))}:${pad2(String(min))}`)
  }
  return out
}

function extractPax(scan: string): number[] {
  const out: number[] = []
  // Explicit pax CONTEXT only (never a bare number — phone digits are not pax).
  for (const m of matchAllGroups(
    scan,
    /\(\s*(?:인원수|성인|Person)?\s*(?:[xX×]\s*)?(\d{1,2})\s*(?:[xX×]\s*)?(?:명\s*명|명|人|인|Adults?|pax)?\s*\)/gi,
  )) {
    pushPax(out, m[1])
  }
  for (const m of matchAllGroups(scan, /(?:인원수?|성인|Pax|People|Participants|Travelers|Adults?)\s*[:\-]?\s*(\d{1,2})/gi)) {
    pushPax(out, m[1])
  }
  for (const m of matchAllGroups(scan, /\b(\d{1,2})\s*[명人]\b/g)) {
    pushPax(out, m[1])
  }
  return out
}

function pushPax(out: number[], raw: string): void {
  const n = parseInt(raw, 10)
  if (n > 0 && n <= 50) out.push(n)
}

// ── tiny helpers ──────────────────────────────────────────────────────────────

function digitCount(s: string): number {
  return s.replace(/\D/g, '').length
}
function matchAll(s: string, re: RegExp): string[] {
  return Array.from(s.matchAll(re), m => m[0])
}
function matchAllGroups(s: string, re: RegExp): RegExpMatchArray[] {
  return Array.from(s.matchAll(re))
}
function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs))
}
function uniqNums(xs: number[]): number[] {
  return Array.from(new Set(xs))
}
function pad2(s: string): string {
  return s.padStart(2, '0')
}
