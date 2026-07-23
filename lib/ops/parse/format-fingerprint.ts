// Format fingerprint — extracts a stable shape signature from a parse input.
//
// Sister to fingerprint.ts (which hashes the raw paste for the L0 cache). The
// L0 cache only hits when the EXACT bytes match; this module hits when the
// LAYOUT matches — same columns, same field order — even if the data differs.
//
// Two extractors:
//   - spreadsheet: hash the normalized header row
//   - text: hash the first-N-lines token-class signature
//
// Hash is SHA-256 over `kind:joined`. We keep both kind and signature alongside
// the hash so the admin UI can show a human-readable preview.

import { createHash } from 'crypto'

export type FormatKind = 'spreadsheet' | 'text' | 'mixed'

export interface FormatFingerprint {
  kind: FormatKind
  fingerprint: string         // hex SHA-256
  headerColumns?: string[]    // normalized header tokens, spreadsheet only
  shapeSignature?: string     // human-readable shape, text only
}

const MIN_HEADER_COLUMNS = 3
const SHAPE_SAMPLE_LINES = 10

/** Normalize a token for fingerprint stability — case-folded, whitespace
 *  collapsed, punctuation stripped. */
function normalizeToken(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
}

/** Spreadsheet detection: first non-blank line has ≥MIN columns separated by
 *  tab/comma/semicolon, and at least half of them look like header tokens
 *  (letters present, not just numbers). */
function tryExtractSpreadsheet(input: string): FormatFingerprint | null {
  const firstLine = input.split('\n').find(l => l.trim().length > 0)
  if (!firstLine) return null

  // Pick the separator that yields the most columns.
  const candidates: Array<{ sep: string; cols: string[] }> = [
    { sep: '\t', cols: firstLine.split('\t') },
    { sep: ',', cols: firstLine.split(',') },
    { sep: ';', cols: firstLine.split(';') },
  ].sort((a, b) => b.cols.length - a.cols.length)

  const best = candidates[0]
  if (best.cols.length < MIN_HEADER_COLUMNS) return null

  const normalized = best.cols.map(normalizeToken).filter(Boolean)
  if (normalized.length < MIN_HEADER_COLUMNS) return null

  // At least half of the tokens must contain a letter (i.e. be header-like,
  // not a row of values). Bare-numeric tokens would yield the same fingerprint
  // for every numeric-only row.
  const headerLike = normalized.filter(t => /\p{L}/u.test(t)).length
  if (headerLike < normalized.length / 2) return null

  const joined = normalized.join('|')
  return {
    kind: 'spreadsheet',
    fingerprint: createHash('sha256').update('spreadsheet:' + joined).digest('hex'),
    headerColumns: normalized,
  }
}

/** Map a line to a coarse token-class signature: which "kinds" of tokens it
 *  contains. Stable across data changes — two rosters with different names
 *  but the same shape produce the same signature. */
function lineSignature(line: string): string {
  const parts: string[] = []
  const trimmed = line.trim()
  if (!trimmed) return ''

  // Field detectors — order matters (most specific first).
  if (/^[\-–—=*•·]{3,}$/.test(trimmed)) return 'sep'
  if (/^https?:\/\//i.test(trimmed)) return 'url'

  const tokens = trimmed.split(/[\s,;\t]+/).filter(Boolean)
  for (const t of tokens) {
    if (/^\+?\d[\d\s().-]{6,}/.test(t)) { parts.push('phone'); continue }
    if (/@[\w.-]+\.\w+/.test(t)) { parts.push('email'); continue }
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(t)) { parts.push('date'); continue }
    if (/^\d{1,2}:\d{2}/.test(t)) { parts.push('time'); continue }
    if (/^\d+$/.test(t)) { parts.push('num'); continue }
    if (/^[\p{Script=Hangul}]+$/u.test(t)) { parts.push('kor'); continue }
    if (/^[\p{Script=Han}]+$/u.test(t)) { parts.push('han'); continue }
    if (/^[a-z]+$/i.test(t)) { parts.push('lat'); continue }
    parts.push('mix')
  }
  return parts.join('-')
}

function extractTextShape(input: string): FormatFingerprint {
  const lines = input.split('\n').slice(0, SHAPE_SAMPLE_LINES)
  const sig = lines.map(lineSignature).filter(Boolean).join('|')
  return {
    kind: 'text',
    fingerprint: createHash('sha256').update('text:' + sig).digest('hex'),
    shapeSignature: sig,
  }
}

/** Top-level: prefer spreadsheet detection, fall back to text shape. */
export function extractFormatFingerprint(input: string): FormatFingerprint {
  const ss = tryExtractSpreadsheet(input)
  if (ss) return ss
  return extractTextShape(input)
}
