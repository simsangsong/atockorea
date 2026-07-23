// Phase 27 §45 Sprint 27.0 — Pre-parse Normalizer + signal single-source.
//
// buildInputContext(raw) is the ONE place that (a) produces the parser-facing
// `normalized` view and (b) computes per-block source `signals`. Sprint A's
// completeness gate READS ctx.signals — it MUST NOT build a second scanner
// (master skill Hard Rule #17, signal single-source-of-truth).
//
// ── 27.0 invariants ─────────────────────────────────────────────────────────
//  • Behavior-neutral (top priority): `normalized` only applies cleanup that
//    every consuming layer ALREADY performs — line-ending normalization,
//    per-line trim, blank-run collapse, BOM strip. The deterministic layers
//    split on /\r?\n/, .map(l => l.trim()), and split blocks on /\n\s*\n+/, so
//    these transforms provably cannot change extraction output (verified by the
//    corpus deep-equal test in __tests__/normalize.test.ts).
//  • Notation-level unification (pax / separators / full-width) WOULD change
//    extraction against the current regex-sensitive layers (e.g. heuristics
//    reads pax from a literal "(N명)"), so it is NOT applied to the parser-
//    facing `normalized` in 27.0. It is implemented + exported here for the
//    robust signal scan and for the later sprint that updates the layers in
//    lockstep. "표기 통일만" — unify notation, never make semantic judgements
//    (e.g. do NOT read phone digits as a pax count).
//  • Non-destructive: `raw` is the source of truth and is never mutated. Bump
//    NORMALIZER_VERSION when `normalized` semantics change (cache-busting hook
//    for future sprints; the L0 fingerprint itself stays keyed on raw).
//
// ReDoS-safety (master skill §45.5): anchored / literal-alternation regexes,
// no nested unbounded quantifiers, '[^\n]' instead of '.'. Validated on the v3
// 693-block corpus (hard-timeout assertion in the test).

import { classifyShape, type InputShape } from './classify'
import { detectSignals, foldWidth } from './signals'

// Re-export foldWidth from its new single home (signals.ts) so existing
// importers (normalize.test.ts, unifyNotation below) keep their path.
export { foldWidth }

export const NORMALIZER_VERSION = 1

/** Per-block presence of each source signal. The single source of truth that
 *  Sprint A's completeness gate reads (Hard Rule #17). */
export interface BlockSignals {
  /** Index into splitBlocks(normalized) — block i ⇔ signals[i]. */
  index: number
  phone: boolean
  email: boolean
  whatsapp: boolean
  ship: boolean
  pickup: boolean
  date: boolean
  platform: boolean
}

export interface ParsedInputContext {
  /** Verbatim input — source of truth, never mutated. */
  raw: string
  /** Parser-facing view (behavior-neutral cosmetic cleanup of `raw`). */
  normalized: string
  /** Coarse provenance hint (not used for routing in 27.0). */
  shape: InputShape
  /** Per-block source signals, aligned to splitBlocks(normalized). */
  signals: BlockSignals[]
  normalizerVersion: number
}

/**
 * Build the shared parse context once, before L1. Downstream layers consume
 * `normalized`; Sprint A reads `signals`.
 */
export function buildInputContext(raw: string): ParsedInputContext {
  const shape = classifyShape(raw)
  const normalized = toNormalizedView(raw)
  const signals = splitBlocks(normalized).map((block, index) => ({
    index,
    ...detectSignals(block),
  }))
  return { raw, normalized, shape, signals, normalizerVersion: NORMALIZER_VERSION }
}

// ── parser-facing normalized view (behavior-neutral) ────────────────────────

// Trailing run: ASCII space/tab + NBSP + ideographic space + BOM (all removed by .trim()).
const TRAIL_WS_RE = /[ \t\u00a0\u3000\uFEFF]+$/
// Leading run: ASCII space/tab + NBSP + ideographic space.
const LEAD_WS_RE = /^[ \t\u00a0\u3000\uFEFF]+/

/**
 * Cosmetic, parse-output-invariant cleanup. Only normalizes whitespace that the
 * consuming layers already discard (trim + /\r?\n/ split + /\n\s*\n+/ block
 * split), so the deterministic emit is identical to parsing `raw`.
 */
export function toNormalizedView(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '') // strip leading BOM
    .replace(/\r\n?/g, '\n') // CRLF / CR → LF
    .split('\n')
    .map(line => line.replace(TRAIL_WS_RE, '').replace(LEAD_WS_RE, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // collapse blank runs
    .replace(/^\n+/, '')
    .replace(/\n+$/, '') // drop leading/trailing blank lines
}

/**
 * Split into blocks EXACTLY as heuristics.heuristicExtract / rules do, so
 * signals[i] aligns with the block each layer sees. Single source for the
 * block-split convention.
 */
export function splitBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map(b => b.trim())
    .filter(b => b.length > 0)
}

// ── notation unification (Sprint 0 deliverable; signal scan + future use) ────

/** Collapse spacing around the operator field separators ` / `, ` : `, ` - `. */
export function unifySeparators(s: string): string {
  return s
    .replace(/[ \t]*\/[ \t]*/g, ' / ')
    .replace(/[ \t]*:[ \t]*/g, ': ')
    .replace(/[ \t]+-[ \t]+/g, ' - ')
}

/**
 * Unify party-size notation to a canonical "N pax" token. Anchored to explicit
 * pax CONTEXT only (x2 / ×2 / +N명 / 외 N명 / N명 / N人 / standalone (N)) — never
 * a bare number, so phone digits are not mistaken for a pax count. Bounded
 * quantifiers only (ReDoS-safe). NOT applied to the parser-facing `normalized`
 * in 27.0 (it would change extraction against the current layers).
 */
export function unifyPax(s: string): string {
  return s
    .replace(/(?<!\d)[xX×]\s*(\d{1,2})\b/g, '$1 pax') // x2 / ×2 / X 2
    .replace(/\+\s*(\d{1,2})\s*명/g, '$1 pax') // +1명
    .replace(/외\s*(\d{1,2})\s*명/g, '$1 pax') // 외 1명
    .replace(/(\d{1,2})\s*[명人]/g, '$1 pax') // 2명 / 2人
    .replace(/\(\s*(\d{1,2})\s*\)/g, '$1 pax') // (2)
}

/** Full notation unification (fold + separators + pax). Exported for the later
 *  sprint; the signal scan uses foldWidth only. */
export function unifyNotation(s: string): string {
  return unifyPax(unifySeparators(foldWidth(s)))
}

// ── per-block source signals (Hard Rule #17 single source) ───────────────────
// Moved to ./signals.ts (Sprint 27.H) so the presence detector and the new
// token extractor share one regex set. buildInputContext above calls
// detectSignals(); no signal regex is authored anywhere else.
