// Phase 0-ter Loop 2 — Template mining helpers
// Master plan §7.1: turn clusters of parse_observations into shadow parse_rules.
//
// Convention for mined rules — clean and unambiguous:
//   1. All literal text (including parentheses) is REGEX-ESCAPED in the pattern.
//   2. Only {{TOKEN}} placeholders become capture groups.
//   3. slot_map index = 0-based position of the {{TOKEN}} among all {{TOKEN}}s in
//      the template (since literal parens are escaped, no other groups exist).
//
// This differs from the seed scripts' hand-written rules, where literal `(...)`
// groups were SOMETIMES counted as captures. Existing seeded rules (now active)
// are left alone — mining only adds NEW rules, never edits old ones.
//
// Token → slot key mapping is fixed for stable tokens (NAME/EMAIL/PHONE/...).
// {{N}} is ambiguous (party / sequence / vehicle) and uses surrounding text to
// disambiguate. When in doubt the first {{N}} maps to `party_size` so
// `buildBookingFromMatch`'s `get('party_size') ?? get('n')` fallback chain works.

const TOKEN_TO_SLOT_KEY: Record<string, string> = {
  NAME: 'name',
  EMAIL: 'email',
  PHONE: 'phone',
  LOCATION: 'pickup_location',
  DATE: 'tour_date',
  TIME: 'pickup_time',
}

// Platform aliases we recognize in literal template text.
const PLATFORM_ALIASES: Record<string, string> = {
  '클룩': 'klook',
  'klook': 'klook',
  '겟유가이드': 'gyg',
  'getyourguide': 'gyg',
  'gyg': 'gyg',
  '비아토르': 'viator',
  'viator': 'viator',
  'kkday': 'kkday',
  '케이케이데이': 'kkday',
  'tripcom': 'tripcom',
  '트립닷컴': 'tripcom',
  'trip.com': 'tripcom',
}

const CANCELLED_PATTERNS = [
  /^\s*취소됨\s*!+/,
  /^\s*cancelled\b/i,
  /^\s*canceled\b/i,
]

export interface MineableCluster {
  tenant_id: string
  template_hash: string
  raw_line_template: string
  cluster_size: number
}

export interface MinedRuleCandidate {
  tenant_id: string
  scope: 'tenant'
  template_pattern: string
  slot_map: Record<string, number>
  postprocess: Record<string, unknown> | null
  status: 'shadow'
  source: 'auto_mined'
  match_count: number
  success_count: number
  conflict_count: number
  notes: string
  // Diagnostic — not persisted to DB.
  pattern_fingerprint: string
  source_template_hash: string
  source_cluster_size: number
}

export type SkipReason =
  | 'no_name_token'
  | 'template_too_short'
  | 'fingerprint_duplicate'
  | 'pattern_compile_failed'
  | 'no_capture_groups'

export interface SkippedCluster {
  template_hash: string
  reason: SkipReason
  detail?: string
}

const TOKEN_RE = /\{\{([A-Z_]+)\}\}/g

/**
 * Escape regex metacharacters in literal text while preserving {{TOKEN}}.
 * Splits on {{TOKEN}} boundary; even indices are literal (escape them), odd
 * indices are the tokens themselves.
 */
export function buildPatternFromTemplate(template: string): string {
  const parts = template.split(/(\{\{[A-Z_]+\}\})/g)
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part // {{TOKEN}}
      return part.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
    })
    .join('')
}

/**
 * Walk template tokens in order; assign slot_map indexes.
 * Indexes are 0-based positions among captures. Since literal parens were
 * escaped by buildPatternFromTemplate, only {{TOKEN}}s are captures, so the
 * count is simply the order of appearance.
 */
export function buildSlotMap(template: string): Record<string, number> {
  const slotMap: Record<string, number> = {}
  let idx = 0
  let nCount = 0
  let m: RegExpExecArray | null
  const re = new RegExp(TOKEN_RE.source, 'g')
  while ((m = re.exec(template)) !== null) {
    const tokenName = m[1]
    const slotKey = inferSlotKey(template, m.index, m[0].length, tokenName, nCount, slotMap)
    if (tokenName === 'N') nCount++
    slotMap[slotKey] = idx
    idx++
  }
  return slotMap
}

function inferSlotKey(
  template: string,
  tokenStart: number,
  tokenLen: number,
  tokenName: string,
  nCount: number,
  existingSlotMap: Record<string, number>,
): string {
  if (tokenName === 'N') {
    const before = template.slice(Math.max(0, tokenStart - 6), tokenStart)
    const afterStart = tokenStart + tokenLen
    const after = template.slice(afterStart, afterStart + 8)

    if (/^\s*명/.test(after)) return uniqueKey('party_size', existingSlotMap)
    if (/^\s*대/.test(after)) return uniqueKey('vehicle_capacity', existingSlotMap)
    if (/^\s*\.\s/.test(after) && /(^|\n)\s*$/.test(before)) {
      return uniqueKey('seq', existingSlotMap)
    }
    if (/^번/.test(after) && /(^|\n)\s*$/.test(before)) {
      return uniqueKey('seq', existingSlotMap)
    }
    if (nCount === 0) return uniqueKey('party_size', existingSlotMap)
    return uniqueKey(`n${nCount + 1}`, existingSlotMap)
  }
  const base = TOKEN_TO_SLOT_KEY[tokenName] ?? tokenName.toLowerCase()
  return uniqueKey(base, existingSlotMap)
}

function uniqueKey(base: string, slotMap: Record<string, number>): string {
  if (!(base in slotMap)) return base
  let i = 2
  while (`${base}_${i}` in slotMap) i++
  return `${base}_${i}`
}

/**
 * Detect post-processing hints from template literal text.
 *   - 취소됨 / cancelled prefix → set_booking_status: 'cancelled'
 *   - Recognized platform name in literal text → platform_normalize entry
 */
export function buildPostprocess(template: string): Record<string, unknown> | null {
  const pp: Record<string, unknown> = {}
  const literalOnly = template.replace(TOKEN_RE, '')

  if (CANCELLED_PATTERNS.some(rx => rx.test(template))) {
    pp.set_booking_status = 'cancelled'
  }

  const platforms: Record<string, string> = {}
  for (const [alias, canonical] of Object.entries(PLATFORM_ALIASES)) {
    if (literalOnly.toLowerCase().includes(alias.toLowerCase())) {
      platforms[alias] = canonical
    }
  }
  if (Object.keys(platforms).length > 0) {
    pp.platform_normalize = platforms
  }

  return Object.keys(pp).length > 0 ? pp : null
}

/**
 * Normalize a pattern for dedup: collapse all {{TOKEN}}s and any single-char
 * regex escapes (\(, \), \\, etc.) back to one canonical form. Whitespace runs
 * collapse to single spaces. Case-insensitive.
 * Two patterns with the same fingerprint represent the same template shape.
 */
export function patternFingerprint(pattern: string): string {
  return pattern
    .replace(TOKEN_RE, '$')
    .replace(/\\(.)/g, '$1') // unescape single chars
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Whether a cluster is mineable. We require:
 *   - {{NAME}} present (otherwise the rule cannot emit a booking)
 *   - Reasonable template length (no degenerate one-line stubs)
 */
export function isMineable(template: string): { ok: boolean; reason?: SkipReason } {
  if (!/\{\{NAME\}\}/.test(template)) return { ok: false, reason: 'no_name_token' }
  if (template.length < 30) return { ok: false, reason: 'template_too_short' }
  return { ok: true }
}

export interface BuildRuleResult {
  candidate?: MinedRuleCandidate
  skip?: SkippedCluster
}

/**
 * Turn a single eligible cluster into either a mined rule candidate or a
 * documented skip reason. Pure: dedup against existing fingerprints is done
 * by the caller (cron route) with the full fingerprint set in hand.
 */
export function buildRuleFromCluster(c: MineableCluster): BuildRuleResult {
  const check = isMineable(c.raw_line_template)
  if (!check.ok) {
    return { skip: { template_hash: c.template_hash, reason: check.reason! } }
  }

  const pattern = buildPatternFromTemplate(c.raw_line_template)
  const slotMap = buildSlotMap(c.raw_line_template)
  const postprocess = buildPostprocess(c.raw_line_template)
  const fp = patternFingerprint(pattern)

  // Sanity-check the compiled regex.
  let compiled: RegExp | null = null
  try {
    compiled = new RegExp(pattern.replace(TOKEN_RE, (_, name) => `(${tokenCapture(name)})`), 's')
  } catch {
    compiled = null
  }
  if (!compiled) {
    return {
      skip: { template_hash: c.template_hash, reason: 'pattern_compile_failed' },
    }
  }
  if (Object.keys(slotMap).length === 0) {
    return { skip: { template_hash: c.template_hash, reason: 'no_capture_groups' } }
  }

  return {
    candidate: {
      tenant_id: c.tenant_id,
      scope: 'tenant',
      template_pattern: pattern,
      slot_map: slotMap,
      postprocess,
      status: 'shadow',
      source: 'auto_mined',
      // match/success start at 0: the source cluster size is NOT a validated
      // match (the rule has not yet been replayed against ground truth). Shadow-
      // mode scoring (shadow.ts) accrues these from live traffic so the §7
      // statistical promotion ratio (success/match) is honest. Seeding
      // match_count with cluster_size would poison the ratio (cluster matches
      // with 0 success can drag a good rule permanently below 0.95). The cluster
      // size is preserved in `notes` + the `source_cluster_size` diagnostic.
      match_count: 0,
      success_count: 0,
      conflict_count: 0,
      notes: `Auto-mined ${new Date().toISOString().slice(0, 10)} from template_hash ${c.template_hash.slice(0, 12)} (cluster=${c.cluster_size})`,
      pattern_fingerprint: fp,
      source_template_hash: c.template_hash,
      source_cluster_size: c.cluster_size,
    },
  }
}

// Mirror of rules.ts TOKEN_CAPTURE for the sanity-compile step above.
// Kept duplicated to avoid a circular import between mining.ts and rules.ts.
function tokenCapture(name: string): string {
  switch (name) {
    case 'N': return '\\d+'
    case 'EMAIL': return '[\\w.+-]+@[\\w-]+\\.[\\w.-]+'
    case 'PHONE': return '\\+?[\\d\\s\\-()]{7,}'
    case 'TIME': return '\\d{1,2}:\\d{2}'
    case 'DATE': return '\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}'
    case 'DATE_FREE': return '[^/\\n]+'
    case 'EXTID': return '[A-Z0-9][A-Z0-9\\-_]{5,15}'
    case 'LANG': return '\\S+'
    case 'PLATFORM': return '\\S+'
    default: return '.+?'
  }
}
