// Phase 27 §45 Sprint 27.I — shared tabular primitives.
//
// The quote-aware row splitter, separator picker, header normalizer and cell
// coercers were private to adapters/csv.ts. The column profiler (data-driven
// column→field inference) needs the SAME splitting/coercion so a profiled
// extraction is byte-consistent with the CSV adapter. Moved here as the single
// source; csv.ts re-imports them (pure move, guarded by the csv adapter tests).
//
// Pure. No I/O. ReDoS-safe (anchored, bounded).

// ' / ' is a virtual (multi-char) separator the spaced-slash roster path uses.
// pickSeparator NEVER returns it (its counts only cover the three CSV chars), so
// the CSV adapter — which calls pickSeparator/splitRow with literal chars — is
// byte-unaffected. Only toGrid (the L1.5 column extractor) opts into it.
export const SLASH_SEP = ' / '
export type Separator = ',' | '\t' | ';' | typeof SLASH_SEP

export function pickSeparator(line: string): Separator | null {
  const counts = { ',': occur(line, ','), '\t': occur(line, '\t'), ';': occur(line, ';') }
  const best = (Object.entries(counts) as Array<[Separator, number]>).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] >= 2 ? best[0] : null
}

function occur(s: string, c: string): number {
  let n = 0
  for (const ch of s) if (ch === c) n++
  return n
}

/** Minimal CSV split — handles double-quoted cells with embedded separators.
 *  The ' / ' sentinel splits on a SPACED slash (`a / b / c`) — distinct from a
 *  bare slash in dates/fractions/addresses (5/31, A/B), which keeps it from
 *  shattering those — and needs no quote handling (roster cells aren't quoted). */
export function splitRow(line: string, sep: string): string[] {
  if (sep === SLASH_SEP) return line.split(/\s+\/\s+/).map(c => c.trim())
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuote = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-/]/g, '')
}

export function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const t = raw.trim()
  let m = t.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = t.match(/^(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/)
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  return undefined
}

export function parseTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (!m) return undefined
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined
  return `${pad2(h.toString())}:${m[2]}`
}

export function clampPartySize(raw: string | undefined): number {
  if (!raw) return 1
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(50, n)
}

export function pad2(s: string): string {
  return s.length < 2 ? `0${s}` : s
}

// ── tabular structure detection (used by the column profiler / extractor) ─────

export interface TabularGrid {
  sep: Separator
  /** The header row split into normalized field-name tokens, or null when the
   *  first row is data (no header). */
  header: string[] | null
  /** Raw header cells (un-normalized), aligned to `header`. */
  rawHeader: string[] | null
  /** Data rows (excludes the header row when present). */
  rows: string[][]
  /** Column count the grid is consistent on. */
  cols: number
}

/**
 * Parse `text` into a consistent column grid, or return null when it is not
 * confidently tabular (≥3 columns, ≥2 rows, consistent column counts). Detects
 * whether the first row is a header (field-name-ish, no digits-only cells) or
 * data. Header-independent: a headerless grid still parses.
 */
// Leading row-index a spreadsheet copy/operator roster often prefixes each
// record with ("row 316: …", "51. …", "12 - …"). Stripped before gridding so
// the index never pollutes column 0 (otherwise "row 316: Margaret" merges the
// id with the name). Bounded digits; ReDoS-safe.
const ROW_INDEX_PREFIX_RE = /^\s*(?:row\s*)?\d{1,5}\s*[:.\-]\s+/i

// How many leading rows to scan for a header before giving up (operator sheets
// prefix the table with title / author / notice rows). Bounded → cheap.
const HEADER_SCAN = 10

export function toGrid(text: string): TabularGrid | null {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(ROW_INDEX_PREFIX_RE, ''))
    .filter(l => l.trim().length > 0)
  if (lines.length < 2) return null

  // Separator: scan ALL lines (a junk title row first can't mislead us). CSV/TSV
  // chars first, then a SPACED-slash roster grid (' / ' — a bare-slash date or
  // address can't qualify, the splitter needs whitespace on both sides).
  const sep = pickGridSeparator(lines)
  if (!sep) return null

  const split = lines.map(l => splitRow(l, sep))
  // Modal column count (not lines[0]'s — that may be a junk title with trailing
  // separators). Rows within ±1 of it are the structural grid.
  const cols = modalColumnCount(split)
  if (cols < 3) return null
  const conforming = split.filter(r => Math.abs(r.length - cols) <= 1)
  if (conforming.length < 2 || conforming.length / split.length < 0.5) return null

  // Find the header within the first few conforming rows. Operator sheets often
  // sit below title / author / "※ 주의" rows; those have mostly-empty cells (or a
  // numeric/contact cell) so they fail looksLikeHeader and are skipped. Rows
  // ABOVE the header are dropped; interspersed divider/footer rows survive but
  // yield no booking (their name-column cell is empty → buildBooking drops them).
  const limit = Math.min(HEADER_SCAN, conforming.length)
  let headerIdx = -1
  for (let i = 0; i < limit; i++) {
    if (looksLikeHeader(conforming[i], cols)) {
      headerIdx = i
      break
    }
  }

  if (headerIdx >= 0) {
    const header = conforming[headerIdx]
    return {
      sep,
      header: header.map(normalizeHeader),
      rawHeader: header,
      rows: conforming.slice(headerIdx + 1).filter(r => r.length >= cols / 2),
      cols,
    }
  }
  // Headerless grid (e.g. a spaced-slash roster) — every conforming row is data.
  return { sep, header: null, rawHeader: null, rows: conforming.filter(r => r.length >= cols / 2), cols }
}

function pickGridSeparator(lines: string[]): Separator | null {
  const candidates: Separator[] = [',', '\t', ';']
  let best: Separator | null = null
  let bestScore = 0
  for (const c of candidates) {
    const score = lines.reduce((n, l) => n + occur(l, c), 0)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  if (best && bestScore >= 2) return best
  // Spaced-slash fallback: most lines split into ≥3 columns on ' / '.
  const slashRows = lines.filter(l => splitRow(l, SLASH_SEP).length >= 3).length
  if (slashRows >= Math.max(2, Math.ceil(lines.length * 0.6))) return SLASH_SEP
  return null
}

function modalColumnCount(split: string[][]): number {
  const counts = new Map<number, number>()
  for (const r of split) {
    if (r.length < 3) continue
    counts.set(r.length, (counts.get(r.length) ?? 0) + 1)
  }
  let best = 0
  let bestN = 0
  for (const [len, n] of counts) {
    if (n > bestN) {
      bestN = n
      best = len
    }
  }
  return best
}

// A header row: ≥70% of cells non-empty, every non-empty cell is field-name-ish
// (has a letter, no '@', not a bare number/phone), at least one alpha cell. A
// junk title (mostly empty) or a data row (numeric/contact cells) both fail.
function looksLikeHeader(r: string[], cols: number): boolean {
  const nonEmpty = r.map(c => c.trim()).filter(Boolean)
  if (nonEmpty.length < Math.ceil(cols * 0.7)) return false
  return (
    nonEmpty.every(
      c => /[a-zA-Z가-힣一-鿿]/.test(c) && !c.includes('@') && !/^\+?\d[\d\s\-()]*$/.test(c),
    ) && nonEmpty.some(c => /[a-zA-Z가-힣]/.test(c))
  )
}
