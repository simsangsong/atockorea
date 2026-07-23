// Phase 27 / Sprint 27.G-B manual-notes re-segmentation.
//
// Some handwritten rosters place a blank line after "notes:" and before the
// contact lines. The parser splits blocks on blank lines, so those contacts can
// become orphan fragments. Re-segmentation is deliberately narrow: it folds only
// memo/notes blanks whose next line is still part of the same booking. It does
// not collapse ordinary single-blank booking boundaries.

/** A line that begins a booking: pax/platform/ref signals are enough here. */
const BOOKING_START =
  /(?:\d+\s*(?:\uBA85|Adults?|Persons?)|Adults?|Person\s*X|\uBE44\uC544\uD1A0\uB974|\uD074\uB8E9|\uAC9F\uC720\uAC00\uC774\uB4DC|kkday|klook|viator|getyourguide|\bBR-\d|\bGYG[A-Z0-9]|[A-Z]{2,3}\d{6,})/i

/** A line/block carrying a contact value (email, phone-ish run, or marker). */
const CONTACT = /(?:@|WhatsApp|WeChat|LINE|Kakao|\uC653\uCE20\uC571|\+?\d[\d\s()\-]{6,}\d)/i

/**
 * A block that carries a contact but no booking-start signature and is short:
 * the tell-tale fragment that blank-line splitting carved off a booking.
 */
function isContactOnlyFragment(block: string): boolean {
  if (block.length > 80) return false
  return CONTACT.test(block) && !BOOKING_START.test(block)
}

/**
 * True when the paste looks like fragmented multi-line manual notes. Tuned to
 * fire on real rosters and stay off for clean single-blank-separated corpora.
 */
export function detectFragmented(raw: string): boolean {
  const blocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
  if (blocks.length === 0) return false
  let contactOnly = 0
  for (const b of blocks) if (isContactOnlyFragment(b)) contactOnly++
  return contactOnly >= 8 && contactOnly / blocks.length >= 0.05
}

/**
 * Fold only memo-internal blanks, preserving normal blank booking boundaries.
 * Non-destructive: raw stays the source of truth; this is a parsing view only.
 */
export function resegmentManualNotes(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().length > 0) {
      out.push(line.trimEnd())
      continue
    }

    const prev = previousNonEmpty(out)
    const next = nextNonEmpty(lines, i + 1)
    if (prev && next && isInternalMemoBlank(prev, next)) continue
    out.push('')
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface ResegmentResult {
  text: string
  resegmented: boolean
}

/**
 * Gated entry point: re-segment only when the paste is detected as fragmented
 * manual notes; otherwise return the input unchanged (behavior-neutral).
 */
export function maybeResegment(raw: string): ResegmentResult {
  const split = splitAdjacentBookingBoundaries(splitFusedBookingMarkers(raw))
  if (detectFragmented(split)) return { text: resegmentManualNotes(split), resegmented: true }
  return { text: split, resegmented: split !== raw }
}

/**
 * Operator pastes sometimes lose the newline between a contact number and the
 * next numbered booking: "WhatsApp:+8210...5번. 제주 크루즈...". Split only when
 * the marker is immediately followed by a known course heading, so ordinary
 * prose containing "번." is left alone.
 *
 * 2026-05-26 — the digit run in group 1 used to allow ANY \s (including
 * newlines). That let it greedily eat past blank-line booking boundaries and
 * steal the first digit of the next "N번." marker (e.g. "+447921803750" + 6
 * blank lines + "13번." → group 1 matched "+447921803750…1", leaving "3번."
 * orphaned and producing the "1\n3번." fragmentation visible in dongjjok-17).
 * Restrict the inner whitespace to literal space + tab so the match stays on
 * a single line, which is the only fused-marker shape this function targets.
 */
export function splitFusedBookingMarkers(raw: string): string {
  return raw.replace(
    /(\+?\d[\d \t()\-‐‑‒–]{6,})(\d{1,2}\s*번\.\s+(?=(?:제주|남쪽|동쪽|서남쪽|카멜리아|스몰|프라이빗)))/g,
    '$1\n$2',
  )
}

export function splitAdjacentBookingBoundaries(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []

  for (const line of lines) {
    const prev = previousNonEmpty(out)
    const current = line.trim()
    if (
      current
      && prev
      && CONTACT.test(prev)
      && isBoundaryStart(current)
      && out.length > 0
      && out[out.length - 1].trim() !== ''
    ) {
      out.push('')
    }
    out.push(line)
  }

  return out.join('\n')
}

function previousNonEmpty(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const s = lines[i].trim()
    if (s) return s
  }
  return null
}

function nextNonEmpty(lines: string[], start: number): string | null {
  for (let i = start; i < lines.length; i++) {
    const s = lines[i].trim()
    if (s) return s
  }
  return null
}

function isInternalMemoBlank(prev: string, next: string): boolean {
  return isMemoLabel(prev) && !isBoundaryStart(next)
}

function isMemoLabel(line: string): boolean {
  return /^(?:\uBE44\uACE0|\uBA54\uBAA8|note|notes|remark|remarks|\uB3C4\uCC29\s*\uC815\uBCF4|\uCD9C\uBC1C\s*\uC815\uBCF4|\uD2B9\uBCC4\s*\uC694\uAD6C\uC0AC\uD56D)\s*[:\uFF1A]\s*$/i.test(line.trim())
}

function isBoundaryStart(line: string): boolean {
  const s = line.trim()
  if (/^\d+\s*(?:\uBC88\.?|[.)])?\s+/.test(s)) return true
  // 2026-05-26 \u2014 allow a hyphen / comma right after the region word so
  // "\uB3D9\uCABD- Ocean Suites Jeju" (no space after region) is recognized as a
  // boundary start. Without this, two adjacent bookings get glued into a
  // single block and the second one (e.g. Ben McNeill) is dropped entirely.
  if (/^(?:\uB0A8\uCABD|\uB3D9\uCABD|\uC11C\uB0A8\uCABD|\uCE74\uBA5C\uB9AC\uC544|\uC81C\uC8FC\s*\uBC9A\uAF43|\uC81C\uC8FC\s*\uD06C\uB8E8\uC988|\uC2A4\uBAB0\s*\uADF8\uB8F9)(?:\s|[-,]|$)/.test(s)) return true
  // 2026-05-26 \u2014 a bare partner-brand line ("Viator", "GetYourGuide", "Klook"
  // etc. standalone) is NOT a new booking; it's the partner label that some
  // OTAs print right before the contact line of the SAME booking. Treating
  // it as a boundary used to split the phone away from its owner (Annette
  // Jeong / Sheetal Gowda in dongjjok-17). Real booking-start lines always
  // carry more context \u2014 a numbered prefix, a name + pax, or an ID.
  if (/^(?:viator|\uBE44\uC544\uD1A0\uB974|getyourguide|\uAC9F\uC720?\uAC00\uC774\uB4DC|gyg|klook|\uD074\uB8E9|kkday|tripcom|trip\.com|\uD2B8\uB9BD\uB2F7\uCEF4|partner|\uD30C\uD2B8\uB108\uC0AC?)$/i.test(s)) {
    return false
  }
  return BOOKING_START.test(s)
}
