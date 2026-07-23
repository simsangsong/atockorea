// Phase 0-bis — L0 fingerprint helpers
// SHA-256 of tenant-scoped raw text. Identical pastes → identical fingerprint
// → bypass L1-L4 entirely.

import { createHash } from 'node:crypto'

// Bump whenever parser semantics or post-parse backstops change in a way that
// should not reuse older full-paste / row cache payloads. The hash still
// includes tenant + normalized source text, but the version prevents stale
// imports from masking parser upgrades during repeated same-sample testing.
//
// 2026-05-26: bumped from 2026-05-22-lovekorea-dictionary-v3. Pre-bump cache
// entries had broken Viator phone extraction (segment.ts splitting "Viator"
// as a boundary and splitFusedBookingMarkers eating across blank lines),
// missing whatsapp-from-phone inference, missing section-header productName
// inheritance, and missing Lotte Duty Free alias resolution. Cache-bust so
// every tenant re-runs through the fixed pipeline on next import of the
// same paste.
export const PARSER_CACHE_VERSION = '2026-05-26-segment-fix-v4'

/** Stable fingerprint for full-paste L0 cache (parse_cache.fingerprint). */
export function fingerprintPaste(tenantId: string, raw: string): string {
  return sha256(`${PARSER_CACHE_VERSION}\n${tenantId}\n${normalize(raw)}`)
}

/** Per-row hash for parse_row_cache.row_hash. */
export function fingerprintRow(tenantId: string, row: string): string {
  return sha256(`${PARSER_CACHE_VERSION}\n${tenantId}\n${normalize(row)}`)
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function normalize(s: string): string {
  // Collapse whitespace and trim — minor formatting drift shouldn't blow the cache.
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
