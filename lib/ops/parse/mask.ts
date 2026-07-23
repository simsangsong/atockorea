// Phase 0-ter — PII masking + template generation for parse_observations
// Master plan §7.2

import { createHash } from 'node:crypto'

const PII_PATTERNS = [
  { rx: /([\w._%+-]+@[\w.-]+\.[a-z]{2,})/gi, token: '{{EMAIL}}' },
  { rx: /(\+?\d[\d\s().\-]{8,}\d)/g, token: '{{PHONE}}' },
]

const SLOT_PATTERNS = [
  { rx: /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, token: '{{DATE}}' },
  { rx: /\d{1,2}:\d{2}(?::\d{2})?/g, token: '{{TIME}}' },
  { rx: /\b\d+\b/g, token: '{{N}}' },
]

// Name labels: text immediately following one of these (colon ONLY) is a name.
// The dash variant collided with GYG proxy emails "customer-<hash>@reply..." —
// see src/lib/parse/adapters/getyourguide.ts for the same fix.
const NAME_LABEL_RX = /\b(?:Lead Guest|Lead|Customer|Guest|Booker|예약자|이름|고객명)\s*:\s*([^\n,]+)/gi

export interface DictEntry {
  canonical: string
  aliases: string[]
}

export interface MaskResult {
  masked: string       // PII removed, location masked, structure preserved
  template: string     // all variable values → slot tokens
  templateHash: string
}

/**
 * Mask one raw row (or block) for safe storage in parse_observations.
 * - Email + phone → {{EMAIL}}, {{PHONE}}
 * - Known canonical pickup names + aliases → {{LOCATION}}
 * - Names following common labels → {{NAME}}
 * - Then dates / times / bare numbers → {{DATE}}, {{TIME}}, {{N}}
 *
 * Returns the masked string (still human-readable structure for analytics),
 * the fully-templated string (variable-free for clustering), and the SHA-256
 * hash of the template (parse_observations.template_hash).
 */
export function maskLine(raw: string, dict: DictEntry[] = []): MaskResult {
  let masked = raw

  // 1. PII
  for (const p of PII_PATTERNS) masked = masked.replace(p.rx, p.token)

  // 2. Known pickup locations (longest alias first to avoid substring stealing)
  if (dict.length > 0) {
    masked = maskedReplaceLocations(masked, dict)
  }

  // 3. Names following common labels
  masked = masked.replace(NAME_LABEL_RX, (match, name) => {
    const fullMatch = match as string
    const beforeColon = fullMatch.slice(0, fullMatch.length - String(name).length)
    return `${beforeColon}{{NAME}}`
  })

  // 4. Slots — dates, times, numbers — on a copy for the template.
  let template = masked
  for (const p of SLOT_PATTERNS) template = template.replace(p.rx, p.token)

  return {
    masked,
    template,
    templateHash: sha256(template),
  }
}

function maskedReplaceLocations(input: string, dict: DictEntry[]): string {
  const all: string[] = []
  for (const e of dict) {
    all.push(e.canonical)
    for (const a of e.aliases) all.push(a)
  }
  // Sort longest first to avoid replacing "Lotte" before "Lotte City Hotel Jeju".
  const ordered = Array.from(new Set(all))
    .filter(s => s && s.length >= 3)
    .sort((a, b) => b.length - a.length)

  let out = input
  for (const term of ordered) {
    // Word-boundary safe replace, case-insensitive.
    const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi')
    out = out.replace(rx, '{{LOCATION}}')
  }
  return out
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}
