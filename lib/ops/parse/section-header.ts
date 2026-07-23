// Section-header inheritance for manual rosters.
//
// Operators frequently structure pasted rosters by "course section":
//
//     동쪽
//
//     1번. 동쪽 - Jeju Airport ...
//     ...
//
//     서쪽
//
//     5번. 서쪽 - Lotte Hotel ...
//     ...
//
// Sometimes the per-booking line repeats the course (the "동쪽 - " prefix),
// sometimes it does NOT. The parser already pulls the prefix when it's there,
// but when only the standalone section header marks the course, downstream
// extraction would leave productName empty.
//
// This module:
//   1. Walks the input ONCE before parsing to identify standalone section
//      header lines and their character offsets in the input.
//   2. After parsing, accepts (booking, source block, block offset) tuples and
//      assigns productName from the most-recent header whose offset precedes
//      the block, ONLY when the booking has no productName of its own (so a
//      per-line prefix wins over inheritance).
//
// Hard rules:
//   - Inheritance NEVER overrides an existing productName (deterministic wins).
//   - Headers must match a closed allow-list (Korean direction words +
//     well-known Jeju/Korea course keywords) so random short lines don't
//     accidentally become headers.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { detectSignals } from './signals'

// Allow-list of phrases that — when they appear ALONE on a line — count as
// section headers. Keep this conservative; admins can promote text format
// templates via Sprint 28 once we want to learn novel headers per tenant.
const HEADER_PHRASES: string[] = [
  '동쪽', '서쪽', '남쪽', '북쪽',
  '동부', '서부', '남부', '북부',
  '동쪽코스', '서쪽코스', '남쪽코스', '북쪽코스',
  '동남쪽', '서남쪽', '동북쪽', '서북쪽',
  '한라산', '성산일출봉', '제주 동부', '제주 서부', '제주 남부', '제주 북부',
  '카멜리아', '제주 벚꽃', '제주 크루즈', '스몰 그룹',
  '오전', '오후',
  '동쪽 투어', '서쪽 투어', '남쪽 투어', '북쪽 투어',
]

const NORMALIZED_PHRASES = new Set(
  HEADER_PHRASES.map(p => p.replace(/\s+/g, '').toLowerCase()),
)

const NUMBERED_LINE = /^\s*\d+\s*(?:번\.?|[.)])\s*/
const CONTACT_HINT = /[@+]|whatsapp|wechat|line|kakao|왓츠앱|카카오/i

// ── Labeled metadata headers ────────────────────────────────────────────────
// Some operators structure rosters with key:value group headers instead of bare
// direction words, e.g.
//     tour_date: 2026-06-01 | tour_name: 설악산남이섬 | guide: 최순길
// These are NOT bookings. Recognizing them (a) keeps them out of the booking
// stream — see looksLikeMetadataHeaderBooking, used by the funnel to drop LLM
// rows that swallowed such a line (leaking the label text into leadName and a
// date into phone), and (b) lets tour_name feed productName inheritance.

const META_TOURNAME_KEY = /^(?:tour[_ ]?name|투어\s*명|상품\s*명)$/i
const META_GUIDE_KEY = /^(?:guide|guide\s*name|가이드|인솔자)$/i
const META_DATE_KEY = /^(?:tour[_ ]?date|투어\s*날짜|날짜)$/i
const META_HEADER_KEY = /^(?:tour[_ ]?name|투어\s*명|상품\s*명|tour[_ ]?date|투어\s*날짜|날짜|guide|guide\s*name|가이드|인솔자)$/i
const META_LABEL_TOKEN = /(?:tour[_ ]?name|투어\s*명|tour[_ ]?date|투어\s*날짜|guide|가이드|인솔자)\s*[:：]/i
// A real contact VALUE (email, country-code phone, or messenger handle). The
// phone branch requires a leading "+" so it does NOT fire on a date value like
// "2026-06-01", and "+" alone never qualifies so tour names that join stops with
// "+" (설악산+낙산사) are not mistaken for a phone number.
const HEADER_CONTACT = /@|whatsapp|wechat|line|kakao|왓츠앱|카카오|\+\d[\d\s()\-]{6,}\d/i
// A contact-bearing KEY — its presence means the line is a booking, not a header.
const CONTACT_KEY = /^(?:phone|tel|telephone|mobile|hp|전화|연락처|핸드폰|휴대폰|email|이메일|whatsapp|왓츠앱|kakao|카카오|wechat|line)$/i

/** Split a line into "key: value" segments on | ｜ separators. Returns null when
 *  ANY segment is not key:value (so real booking rows never qualify) or when a
 *  contact signal is present (a contact ⇒ booking, not a header). */
function labeledSegments(line: string): Array<{ key: string; value: string }> | null {
  const t = line.trim()
  if (!t || t.length > 160) return null
  if (HEADER_CONTACT.test(t)) return null
  const segs = t.split(/\s*[|｜]\s*/).filter(s => s.length > 0)
  if (segs.length === 0) return null
  const out: Array<{ key: string; value: string }> = []
  for (const seg of segs) {
    const m = seg.match(/^([^:：]{1,24})[:：]\s*(.+)$/)
    if (!m) return null
    const key = m[1].trim()
    if (CONTACT_KEY.test(key)) return null
    out.push({ key, value: m[2].trim() })
  }
  return out
}

/** True when a line is composed only of key:value segments and at least one key
 *  is a known group-header field (tour_name / tour_date / guide …). */
export function isLabeledMetadataHeader(line: string): boolean {
  const segs = labeledSegments(line)
  if (!segs) return false
  return segs.some(s => META_HEADER_KEY.test(s.key))
}

export interface LabeledHeaderFields {
  productName?: string
  guideName?: string
  tourDate?: string
}

/** Drop a trailing standalone status marker ("마감" = full/closed, "완료"). */
function stripStatusMarker(value: string): string {
  return value.replace(/\s*(?:마감|완료|full|closed)\s*$/i, '').trim()
}

/** Parse a labeled metadata header into its known fields (tour_name → product,
 *  guide → guideName, tour_date → ISO). Returns null when the line is not a
 *  labeled header. Used by the grouped-roster adapter and inheritance. */
export function labeledHeaderFields(line: string): LabeledHeaderFields | null {
  const segs = labeledSegments(line)
  if (!segs || !segs.some(s => META_HEADER_KEY.test(s.key))) return null
  const out: LabeledHeaderFields = {}
  for (const s of segs) {
    if (META_TOURNAME_KEY.test(s.key)) {
      const v = stripStatusMarker(s.value)
      if (v) out.productName = v
    } else if (META_GUIDE_KEY.test(s.key)) {
      const v = s.value.trim()
      if (v) out.guideName = v
    } else if (META_DATE_KEY.test(s.key)) {
      const m = s.value.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
      if (m) out.tourDate = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    }
  }
  return out
}

/** Pull the tour_name value from a labeled header for productName inheritance.
 *  Returns null when the line is not a labeled header or carries no tour_name. */
function labeledHeaderProductName(line: string): string | null {
  return labeledHeaderFields(line)?.productName ?? null
}

/** True when an extracted booking is actually a swallowed metadata header — its
 *  lead name is a labeled header string or carries a tour_name/guide/date label
 *  token. The funnel uses this to drop phantom LLM rows (Phase 27 §45 defense). */
export function looksLikeMetadataHeaderBooking(b: ParsedBooking): boolean {
  const name = String(b.leadName ?? '').trim()
  if (!name) return false
  return isLabeledMetadataHeader(name) || META_LABEL_TOKEN.test(name)
}

// ── Delimiter column-header rows + decorative banners ────────────────────────
// Operators paste spreadsheet-style rosters whose first row is a column-LABEL
// header ("구분,예약번호,손님/인원,컨택포인트,…") and section dividers drawn with
// box characters ("■■ 6/19 추가 단체 ■■", "===== 6/8 (월) 출발분 ====="). Neither
// is a booking. Left in the LLM input they get emitted as a phantom row or their
// text leaks into a real row's productName (the dirty-CSV pressure regression).
//
// Both detectors are conservative: a line carrying a real contact value (phone /
// email / WhatsApp — via the #17 single signal source) is a booking and is never
// treated as a header or banner.

// Base column-label keywords (substring-matched against each delimiter segment so
// compound cells like "예약손님/인원" or "픽업&시각" still resolve). Korean + English.
const COLUMN_LABEL_WORDS = [
  '구분', '예약번호', '예약', '바우처', 'voucher', '손님', '고객', '성함', '이름', '성명', '인원', '인원수',
  '컨택', '연락처', '연락', '전화', '핸드폰', '휴대폰', '이메일', 'e메일', '메일', '유입', '채널', '경로',
  '투어상품', '상품', '코스', '투어', '픽업', '미팅', '집결', '시각', '시간', '일자', '날짜', '출발',
  '특이', '비고', '메모', '상태', '연번', '번호', 'no', 'name', 'phone', 'email', 'course', 'date',
  'pickup', 'channel', 'status', 'pax', 'tour', 'remark', 'note',
]

const NORM_LABEL = (s: string) => s.replace(/[\s.()（）·&\-_/]/g, '').toLowerCase()
const NORM_LABEL_WORDS = COLUMN_LABEL_WORDS.map(w => w.toLowerCase())

/** A line carries a real contact value → it's a booking, never a header. Reuses
 *  the #17 single signal source (no second scanner). */
function lineHasContact(line: string): boolean {
  const s = detectSignals(line)
  return s.phone || s.email || s.whatsapp
}

/** True when a line is a delimiter-separated row of COLUMN LABELS (a spreadsheet
 *  header), not data. Requires ≥3 comma/pipe/tab segments, ≥half (and ≥3) of them
 *  matching a known label word, no 3+ digit run (headers carry no phone/ref
 *  values), and no contact signal. */
export function isColumnHeaderRow(line: string): boolean {
  const t = (line ?? '').trim()
  if (!t || t.length > 200) return false
  if (/\d{3,}/.test(t)) return false // a header has no phone / ref / long-number data
  if (lineHasContact(t)) return false
  const segs = t.split(/[,\t|｜]/).map(s => s.trim()).filter(s => s.length > 0)
  if (segs.length < 3) return false
  let hits = 0
  for (const seg of segs) {
    const n = NORM_LABEL(seg)
    if (n && NORM_LABEL_WORDS.some(w => n.includes(w))) hits++
  }
  return hits >= 3 && hits / segs.length >= 0.5
}

// Decorative box/divider characters used to draw banner lines. `▸`/`↳`/single
// bullets are deliberately EXCLUDED — they prefix real booking lines (style 0/3).
const BANNER_RUN = /[■□▶◀▼▲◆◇●○★☆※＝=~*#〓▽△━─＿_]/
// Global variant precompiled once (module scope) — isBannerLine is on the noise
// hot path; `new RegExp(...,'g')` per call was a needless recompile tax.
const BANNER_RUN_G = /[■□▶◀▼▲◆◇●○★☆※＝=~*#〓▽△━─＿_]/g
const BANNER_LEAD = /^[■□▶◀▼▲◆◇●○★☆※＝=~*#〓▽△━─＿_]{2,}/
const BANNER_TRAIL = /[■□▶◀▼▲◆◇●○★☆※＝=~*#〓▽△━─＿_]{2,}\s*$/

/** True when a line is a decorative section banner (leading/trailing run of ≥2 box
 *  characters, or ≥40% box characters), e.g. "■■ 6/19 추가 단체 ■■" / "===== … =====".
 *  A line carrying a contact value is a booking, never a banner. */
export function isBannerLine(line: string): boolean {
  const t = (line ?? '').trim()
  if (!t) return false
  if (lineHasContact(t)) return false
  if (BANNER_LEAD.test(t) || BANNER_TRAIL.test(t)) return true
  const stripped = t.replace(/\s/g, '')
  if (stripped.length < 3) return false
  const deco = (stripped.match(BANNER_RUN_G) || []).length
  return deco / stripped.length >= 0.4
}

/** True when an extracted booking is a swallowed column header or decorative
 *  banner (its lead name is one), in addition to the labeled-metadata case.
 *  The funnel uses this to drop phantom LLM rows (Phase 27 §45 defense). */
export function looksLikeJunkHeaderBooking(b: ParsedBooking): boolean {
  if (looksLikeMetadataHeaderBooking(b)) return true
  const name = String(b.leadName ?? '').trim()
  if (!name) return false
  return isBannerLine(name) || isColumnHeaderRow(name)
}

/** A real booking that absorbed a column-header row into its productName — clear
 *  it so the wrong value never ships (section-header inheritance / review fills
 *  the gap). Returns true when a value was cleared. */
export function clearJunkProductName(b: ParsedBooking): boolean {
  if (b.productName && isColumnHeaderRow(b.productName) && hasStrongHeaderWord(b.productName)) {
    b.productName = undefined
    return true
  }
  return false
}

// Header-ONLY label words that never appear in a real product/course name. A
// comma-listed itinerary ("성산, 우도, 투어") satisfies isColumnHeaderRow via the
// soft words (투어/코스/…) but carries none of these, so requiring ≥1 here keeps a
// legitimate product name from being wiped.
const STRONG_HEADER_WORDS = [
  '구분', '예약번호', '연번', '컨택', '특이', '비고', '상태', '연락처', '연락', '채널', '유입', '경로',
]
function hasStrongHeaderWord(value: string): boolean {
  const norm = NORM_LABEL(value)
  return STRONG_HEADER_WORDS.some(w => norm.includes(NORM_LABEL(w)))
}

/** True when an ENTIRE block is structural noise — every non-empty line is a
 *  column header, a decorative banner, or a standalone section (date/course)
 *  header — and the block carries no contact value. Such blocks must be dropped
 *  from the LLM input: left in, they become phantom rows, leak into a real row's
 *  productName, and pollute the failure corpus + autopilot trigger. */
export function isStructuralNoiseBlock(block: string): boolean {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return false
  for (const l of lines) if (lineHasContact(l)) return false
  return lines.every(
    l =>
      isColumnHeaderRow(l) ||
      isBannerLine(l) ||
      isSectionDateHeader(l) ||
      isLabeledMetadataHeader(l) ||
      isSectionHeader(l),
  )
}

/** True when a trimmed line should be considered a standalone course header. */
export function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  // Labeled metadata headers ("tour_name: … | guide: …") are group separators,
  // not bookings — accept regardless of length / embedded date digits.
  if (isLabeledMetadataHeader(trimmed)) return true
  if (trimmed.length > 40) return false
  // A header carries NO booking signals — no contact, no numbered prefix, no
  // hyphen-pickup pattern. This guards against numbered rows whose pickup
  // text happens to start with a header word.
  if (NUMBERED_LINE.test(trimmed)) return false
  if (CONTACT_HINT.test(trimmed)) return false
  if (trimmed.includes(' - ') || trimmed.includes(' – ')) return false
  if (/\d{4,}/.test(trimmed)) return false // long digits → likely a booking row
  // Phrase match — normalize whitespace, fold case.
  const norm = trimmed.replace(/\s+/g, '').toLowerCase()
  return NORMALIZED_PHRASES.has(norm)
}

export interface SectionHeaderHit {
  /** The raw header text as it appeared (e.g. "동쪽"). */
  header: string
  /** Character offset in the ORIGINAL input where the header line begins. */
  offset: number
}

/** Scan input and collect all standalone section headers with their offsets. */
export function extractSectionHeaders(input: string): SectionHeaderHit[] {
  const hits: SectionHeaderHit[] = []
  const lines = input.split('\n')
  let offset = 0
  for (const line of lines) {
    const labeledName = labeledHeaderProductName(line)
    if (labeledName) {
      // Labeled header carrying a tour_name → inherit the clean tour name.
      hits.push({ header: labeledName, offset })
    } else if (!isLabeledMetadataHeader(line) && isSectionHeader(line)) {
      // Bare direction-word / course header → inherit the raw phrase. (Labeled
      // headers WITHOUT a tour_name, e.g. "guide: …" alone, are intentionally
      // not inheritance sources.)
      hits.push({ header: line.trim(), offset })
    }
    offset += line.length + 1 // +1 for the '\n' we split on
  }
  return hits
}

/** Find the header that immediately precedes a character offset. Returns null
 *  when no header has been seen yet. */
export function headerAtOffset(headers: SectionHeaderHit[], blockOffset: number): string | null {
  if (headers.length === 0) return null
  let best: string | null = null
  for (const h of headers) {
    if (h.offset <= blockOffset) best = h.header
    else break
  }
  return best
}

/**
 * Apply section-header inheritance to a list of bookings AFTER all parsing
 * layers have run.
 *
 * For each booking we locate its source block in the original input (by lead
 * name + simple substring match — cheap, and we already do this in
 * row-cache.ts / learning.ts). The most-recent header above that offset
 * supplies the productName fallback when the booking has none.
 *
 * Mutates the bookings array in place. Returns the count of rows that gained
 * a productName from inheritance — useful for emit/telemetry.
 */
export function inheritSectionHeaders(
  rawInput: string,
  bookings: ParsedBooking[],
): { filled: number; headers: SectionHeaderHit[] } {
  const headers = extractSectionHeaders(rawInput)
  if (headers.length === 0) return { filled: 0, headers }

  let filled = 0
  for (const b of bookings) {
    if (b.productName && b.productName.trim().length > 0) continue
    const offset = locateBookingOffset(rawInput, b)
    if (offset == null) continue
    const inherited = headerAtOffset(headers, offset)
    if (!inherited) continue
    b.productName = inherited
    filled++
  }
  return { filled, headers }
}

// ── Section-DATE header inheritance ──────────────────────────────────────────
// Operators group a roster under a date divider and then OMIT the date on every
// row beneath it:
//
//     ===== 6/8 (월) 출발분 =====        ▼▼▼ 6월 9일 (화) ▼▼▼        [2026-06-11] 담당:민지
//     ▸ 손님 …(2명) ; …                 1] … 인원 3 …               "코스",이름,…
//
// Without inheritance those rows reach the final backstops with an empty
// tourDate and applyBusTourDateDefaults stamps them KST+1 (the "tomorrow"
// hallucination the pressure test surfaced). This module fills the empty
// tourDate from the most-recent date divider above each row — fill-empty-only
// (an in-row / LLM-extracted date always wins, Hard Rule #19) — and MUST run
// before applyBusTourDateDefaults in the funnel.

// A line is a date divider only when it both LOOKS like a section header
// (banner-drawn, bracketed, or carrying a section keyword) AND contains a date.
const SECTION_DATE_KEYWORD = /출발|담당|단체|추가|섹션|구간|회차|분\b/
const ISO_DATE = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
const KO_MD = /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/
const SLASH_MD = /(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/

export interface SectionDate {
  year?: number
  month: number
  day: number
}

/** Parse a section date-divider line into {year?, month, day}, or null when the
 *  line is not a date divider (a booking row, a contact-bearing line, or a header
 *  without a date never qualify). */
export function parseSectionDateHeader(line: string): SectionDate | null {
  const t = (line ?? '').trim()
  if (!t || t.length > 80) return null
  if (lineHasContact(t)) return null // a contact ⇒ booking, not a divider
  if (NUMBERED_LINE.test(t)) return null // "1번. …" is a booking row
  const headerish =
    isBannerLine(t) || /^\[[^\]]+\]/.test(t) || SECTION_DATE_KEYWORD.test(t)
  if (!headerish) return null
  let m = t.match(ISO_DATE)
  if (m) return validMD(+m[2], +m[3], +m[1])
  m = t.match(KO_MD)
  if (m) return validMD(+m[1], +m[2])
  m = t.match(SLASH_MD)
  if (m) return validMD(+m[1], +m[2])
  return null
}

function validMD(month: number, day: number, year?: number): SectionDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return year ? { year, month, day } : { month, day }
}

/** Boolean wrapper used by the structural-noise-block detector. */
export function isSectionDateHeader(line: string): boolean {
  return parseSectionDateHeader(line) != null
}

interface SectionDateHit extends SectionDate {
  offset: number
}

/** Scan input and collect all date dividers with their character offsets. */
function extractSectionDateHeaders(input: string): SectionDateHit[] {
  const hits: SectionDateHit[] = []
  const lines = input.split('\n')
  let offset = 0
  for (const line of lines) {
    const d = parseSectionDateHeader(line)
    if (d) hits.push({ ...d, offset })
    offset += line.length + 1
  }
  return hits
}

/** Modal 4-digit year among already-dated bookings; KST current year fallback. */
function inferYear(bookings: ParsedBooking[], now: Date): number {
  const counts = new Map<number, number>()
  for (const b of bookings) {
    const m = b.tourDate?.match(/^(\d{4})-/)
    if (m) counts.set(+m[1], (counts.get(+m[1]) ?? 0) + 1)
  }
  let best: number | null = null
  let bestN = 0
  for (const [y, n] of counts) if (n > bestN) { best = y; bestN = n }
  if (best) return best
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now),
  )
}

/**
 * Fill empty tourDate from the nearest date divider above each booking. Mutates
 * in place; returns the count filled. Fill-empty-only — never overrides an
 * extracted date. MUST run before applyBusTourDateDefaults.
 */
export function inheritSectionDates(
  rawInput: string,
  bookings: ParsedBooking[],
  now = new Date(),
): { filled: number; headers: number } {
  const headers = extractSectionDateHeaders(rawInput)
  if (headers.length === 0) return { filled: 0, headers: 0 }
  const year = inferYear(bookings, now)

  let filled = 0
  for (const b of bookings) {
    if (b.tourDate && b.tourDate.trim().length > 0) continue
    const offset = locateBookingOffset(rawInput, b)
    if (offset == null) continue
    let chosen: SectionDateHit | null = null
    for (const h of headers) {
      if (h.offset <= offset) chosen = h
      else break
    }
    if (!chosen) continue
    const y = chosen.year ?? year
    b.tourDate = `${y}-${pad2(chosen.month)}-${pad2(chosen.day)}`
    filled++
  }
  return { filled, headers: headers.length }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Cheap offset finder. Prefers the MOST UNIQUE anchor first — a booking ref
 *  then a phone tail — because lead names repeat across a roster (a 10-name pool
 *  over 80 rows), and a name-first lookup would resolve to the FIRST namesake's
 *  section, inheriting the wrong section date/course. Lead name is the last
 *  resort. */
function locateBookingOffset(rawInput: string, b: ParsedBooking): number | null {
  // 1. Unique external ref — exact, unambiguous.
  if (b.externalBookingId && !/^MANUAL-\d+$/i.test(b.externalBookingId)) {
    const idx = rawInput.indexOf(b.externalBookingId)
    if (idx >= 0) return idx
  }
  // 2. Phone — match per line on digit-stripped content. The raw phone is
  //    formatted ("010-9780-8027"), so a raw indexOf of bare digits never fires;
  //    compare each line's digits-only form instead.
  if (b.phone) {
    const want = b.phone.replace(/\D/g, '').slice(-8)
    if (want.length >= 6) {
      let off = 0
      for (const line of rawInput.split('\n')) {
        if (line.replace(/\D/g, '').includes(want)) return off
        off += line.length + 1
      }
    }
  }
  // 3. Lead name — ONLY when it occurs exactly once. The dominant manual_kr
  //    roster reuses a small name pool, so a repeated name would anchor to the
  //    first namesake (possibly under a different date divider). A wrong date is
  //    worse than none → bail and let the bus-date default / review handle it.
  if (b.leadName) {
    const first = rawInput.indexOf(b.leadName)
    if (first >= 0 && rawInput.indexOf(b.leadName, first + 1) === -1) return first
  }
  return null
}
