// OTA email ingest — forwarded-envelope stripper.
//
// Forwarded OTA booking emails arrive wrapped in a Gmail/Outlook forward
// envelope: an optional "---- Forwarded message ----" marker followed by a
// contiguous run of header lines (From / To / Cc / Date / Subject / 보낸사람 …),
// the To/Cc lists often wrapping onto their own lines. Left in place that
// envelope (measured 2026-06-21 across GYG/Viator/KKday):
//   (a) becomes a PHANTOM booking when the Subject carries an OTA ref, and
//   (b) lets the forward DATE be misread as the tour date and the no-reply
//       From: as the customer email.
//
// stripEmailEnvelope removes ONLY that contiguous top envelope region — never a
// body line. A body label such as GYG's "Date: June 26, 2026" survives because
// it sits AFTER the envelope's terminating blank line, outside the consumed run.
//
// Gated to the 'email' shape by the caller (funnel.ts) so non-email pastes are
// untouched. Non-destructive: returns the original text when no real envelope
// (marker + ≥1 header line) is confidently identified.
//
// ReDoS-safety (master skill §45.5): anchored / literal-alternation regexes, no
// nested unbounded quantifiers, '[^\n]' instead of '.'.

const FORWARD_MARKER_RE =
  /^\s*(?:[-_=>]{2,}\s*)?(?:Forwarded\s+message|Original\s+Message|Begin\s+forwarded\s+message|전달[된한]?\s*메[시세]지)\b/i

const HEADER_LABEL_RE =
  /^\s*(?:From|To|Cc|Bcc|Sent|Date|Subject|Reply-To|Return-Path|Importance|보낸사람|받는사람|참조|숨은참조|제목|날짜|보낸\s*날짜|받은\s*날짜)\s*:/i

export interface EnvelopeStripResult {
  stripped: boolean
  text: string
}

// A To/Cc list wrapped onto its own line: holds an @ and is list-like, not prose.
function isAddrContinuation(line: string): boolean {
  if (!line.includes('@')) return false
  if (/[.!?。]\s*$/.test(line.trim())) return false // reject a sentence
  return true
}

export function stripEmailEnvelope(raw: string): EnvelopeStripResult {
  const lines = raw.split('\n')

  // Locate the envelope start: a forward marker, OR (markerless forward) a
  // header label among the first few non-empty lines.
  let start = -1
  let sawMarker = false
  for (let i = 0; i < lines.length && i < 12; i++) {
    if (FORWARD_MARKER_RE.test(lines[i])) {
      start = i
      sawMarker = true
      break
    }
  }
  if (start === -1) {
    let seen = 0
    for (let i = 0; i < lines.length && i < 8; i++) {
      if (lines[i].trim().length === 0) continue
      seen++
      if (HEADER_LABEL_RE.test(lines[i])) {
        start = i
        break
      }
      if (seen >= 3) break // header block must be at the very top
    }
  }
  if (start === -1) return { stripped: false, text: raw }

  // Consume the marker + contiguous header / address-continuation run. Stop at
  // the first blank line or the first body line.
  let end = sawMarker ? start : start - 1
  let sawHeader = false
  for (let i = sawMarker ? start + 1 : start; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().length === 0) break
    if (HEADER_LABEL_RE.test(line)) {
      sawHeader = true
      end = i
      continue
    }
    if (sawHeader && isAddrContinuation(line)) {
      end = i
      continue
    }
    break // body line reached
  }

  // Require a real header line — a lone marker or a false header-block hit is
  // not an envelope worth stripping.
  if (!sawHeader) return { stripped: false, text: raw }

  const remaining = [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n').replace(/^\n+/, '')
  return { stripped: true, text: remaining }
}
