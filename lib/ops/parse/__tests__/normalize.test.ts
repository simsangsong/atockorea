// Phase 27 §45 Sprint 27.0 — Normalizer + signal single-source unit tests.
//
// The headline guarantee is BEHAVIOR-NEUTRALITY: feeding `toNormalizedView(raw)`
// to the deterministic L2 layer must produce byte-for-byte identical bookings
// AND leftover vs feeding `raw`. Because L2.5 rules consume L2's leftover, equal
// {bookings, leftover} at L2 proves the whole deterministic chain is neutral.
//
// Full-width / invisible codepoints are written as \u escapes so the source is
// unambiguous (U+3000 ideographic space, U+200B ZWSP, U+FFxx full-width forms).

import * as fs from 'node:fs'
import path from 'node:path'
import { heuristicExtract } from '../heuristics'
import {
  buildInputContext,
  toNormalizedView,
  splitBlocks,
  foldWidth,
  unifyPax,
  unifySeparators,
  unifyNotation,
  NORMALIZER_VERSION,
} from '../normalize'

// ── toNormalizedView: cosmetic cleanup the layers already perform ───────────
describe('toNormalizedView — cosmetic, parse-invariant cleanup', () => {
  it('normalizes CRLF and lone CR to LF', () => {
    expect(toNormalizedView('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('strips trailing whitespace per line (space / tab / NBSP / ideographic)', () => {
    expect(toNormalizedView('a   \nb\t\nc \nd　')).toBe('a\nb\nc\nd')
  })

  it('strips leading whitespace per line', () => {
    expect(toNormalizedView('   a\n\t b')).toBe('a\nb')
  })

  it('strips a leading BOM', () => {
    expect(toNormalizedView('﻿hello')).toBe('hello')
  })

  it('collapses blank-line runs and trims leading/trailing blank lines', () => {
    expect(toNormalizedView('\n\na\n\n\n\nb\n\n')).toBe('a\n\nb')
  })

  it('preserves ZWSP (U+200B) — .trim() does not remove it, so neither do we', () => {
    // Trimming ZWSP would diverge from the layers' own .trim() and break
    // neutrality. It must survive into `normalized`.
    expect(toNormalizedView('a​\nb')).toBe('a​\nb')
  })

  it('does not collapse internal spaces or tabs (CSV/excel column safety)', () => {
    expect(toNormalizedView('a,  b,\tc')).toBe('a,  b,\tc')
  })
})

// ── buildInputContext: shape + non-destructive ──────────────────────────────
describe('buildInputContext — context assembly', () => {
  it('preserves raw verbatim (source of truth) and reports normalizerVersion', () => {
    const raw = 'John  (2명)\r\n+82 10 1234 5678  \r\n\r\n\r\n'
    const ctx = buildInputContext(raw)
    expect(ctx.raw).toBe(raw) // byte-for-byte unchanged
    expect(ctx.normalizerVersion).toBe(NORMALIZER_VERSION)
    expect(ctx.normalized).not.toContain('\r')
    expect(typeof ctx.shape).toBe('string')
  })

  it('signals array length matches the normalized block count', () => {
    const raw = 'block one\n\nblock two\n\nblock three'
    const ctx = buildInputContext(raw)
    expect(ctx.signals.length).toBe(splitBlocks(ctx.normalized).length)
    expect(ctx.signals.length).toBe(3)
    ctx.signals.forEach((s, i) => expect(s.index).toBe(i))
  })
})

// ── signals: single source of truth (Hard Rule #17) ─────────────────────────
describe('per-block signals', () => {
  const raw = [
    'John Smith\n+1 202 555 0101', // 0: phone
    'Jane Doe\njane@example.com', // 1: email
    'Bob\nWhatsApp: +6598226078', // 2: whatsapp
    'Tour X\n크루즈선: Diamond Princess', // 3: ship (크루즈선)
    '1. 남쪽 - Lotte City Hotel Jeju at 09:00', // 4: pickup (numbered, 남쪽)
    'Pickup: Shilla Duty Free', // 5: pickup (labeled)
    'Just A Name\n2 pax', // 6: NONE (signal-absent — the #18 case)
  ].join('\n\n')
  const sig = buildInputContext(raw).signals

  it('detects a bare phone', () => {
    expect(sig[0].phone).toBe(true)
    expect(sig[0].email || sig[0].whatsapp || sig[0].ship || sig[0].pickup).toBe(false)
  })
  it('detects an email', () => expect(sig[1].email).toBe(true))
  it('detects WhatsApp (and does not call it a phone)', () => {
    expect(sig[2].whatsapp).toBe(true)
    expect(sig[2].phone).toBe(false)
  })
  it('detects a cruise-ship signal', () => expect(sig[3].ship).toBe(true))
  it('detects a numbered pickup header', () => expect(sig[4].pickup).toBe(true))
  it('detects a labeled pickup', () => expect(sig[5].pickup).toBe(true))
  it('reports NO signals for a genuinely-absent block (no blind L3 in Sprint A)', () => {
    expect(sig[6]).toMatchObject({ phone: false, email: false, whatsapp: false, ship: false, pickup: false })
  })
  it('detects signals through full-width digits / unicode spaces', () => {
    // full-width "ABC@example.com" + full-width-spaced "NCL Spirit".
    const ctx = buildInputContext('ＡＢＣ＠example.com\n\nＮＣＬ　Spirit')
    expect(ctx.signals[0].email).toBe(true)
    expect(ctx.signals[1].ship).toBe(true)
  })
})

// ── notation unification helpers (Sprint 0 deliverable) ──────────────────────
describe('notation unification', () => {
  it('foldWidth folds full-width ASCII and unicode spaces', () => {
    expect(foldWidth('２３')).toBe('23')
    expect(foldWidth('ＡＢＣ')).toBe('ABC')
    expect(foldWidth('a　b c')).toBe('a b c')
  })

  it('unifyPax canonicalizes party-size notation to "N pax"', () => {
    expect(unifyPax('x2')).toBe('2 pax')
    expect(unifyPax('×3')).toBe('3 pax') // ×3
    expect(unifyPax('외 1명')).toBe('1 pax') // 외 1명
    expect(unifyPax('2명')).toBe('2 pax') // 2명
    expect(unifyPax('2人')).toBe('2 pax') // 2人
    expect(unifyPax('(2)')).toBe('2 pax')
    expect(unifyPax('+1명')).toBe('1 pax') // +1명
  })

  it('unifyPax never reads phone digits as a pax count (notation only)', () => {
    expect(unifyPax('01012345678')).toBe('01012345678')
    expect(unifyPax('+82 10 1234 5678')).toBe('+82 10 1234 5678')
  })

  it('unifySeparators canonicalizes spacing around / : -', () => {
    expect(unifySeparators('a/b')).toBe('a / b')
    expect(unifySeparators('a  :  b')).toBe('a: b')
    expect(unifySeparators('a  -  b')).toBe('a - b')
    expect(unifySeparators('a-b')).toBe('a-b') // unspaced hyphen untouched
  })

  it('unifyNotation composes fold + separators + pax', () => {
    // full-width "Name/2명" → "Name / 2 pax"
    expect(unifyNotation('Ｎａｍｅ／２명')).toBe('Name / 2 pax')
  })
})

// ── behavior-neutral oracle ──────────────────────────────────────────────────
describe('behavior-neutral: heuristicExtract(normalized) === heuristicExtract(raw)', () => {
  it('synthetic messy paste (CRLF / trailing ws / blank runs / tabs) is neutral', () => {
    const raw =
      'Linda Fung 4명  \r\n+65 9123 4567\r\n\r\n\r\n' + // 4명
      'wolfgang roscher 강정 3명\t\n+49 162 4109015\n\n' + // 강정 3명
      '제주크루즈\n\n' + // 제주크루즈 header → leftover
      'QIU YUYU 신라 2명\n+886 912 345 678   ' // 신라 2명
    const fromRaw = heuristicExtract(raw)
    const fromNorm = heuristicExtract(toNormalizedView(raw))
    expect(fromNorm.bookings).toEqual(fromRaw.bookings)
    expect(fromNorm.leftover).toEqual(fromRaw.leftover)
    expect(fromRaw.bookings.length).toBeGreaterThanOrEqual(3) // emission actually exercised
  })

  // Real corpus: the strongest neutrality proof. Skips when PII fixtures absent.
  const fixtures = [
    'bulk-jeju.txt',
    'bulk-jeju-v2.txt',
    'bulk-jeju-v3.txt',
    'bulk-jeju-v4.txt',
    'bulk-jeju-v5.txt',
    'bulk-jeju-v6.txt',
    'bulk-jeju-v7.txt',
    'bulk-jeju-v8.txt',
  ]
  for (const f of fixtures) {
    const p = path.join(process.cwd(), 'tmp', f)
    ;((fs.existsSync(p)) ? it : it.skip)(`${f}: deterministic emit unchanged under normalization`, () => {
      const raw = fs.readFileSync(p, 'utf-8')
      const fromRaw = heuristicExtract(raw)
      const fromNorm = heuristicExtract(toNormalizedView(raw))
      expect(fromNorm.bookings).toEqual(fromRaw.bookings)
      expect(fromNorm.leftover).toEqual(fromRaw.leftover)
    })
  }
})

// ── ReDoS / hard-timeout guard on the v3 693-block corpus ────────────────────
describe('ReDoS guard', () => {
  const v3 = path.join(process.cwd(), 'tmp', 'bulk-jeju-v3.txt')
  ;((fs.existsSync(v3)) ? it : it.skip)('buildInputContext over the v3 corpus completes well under 2s', () => {
    const raw = fs.readFileSync(v3, 'utf-8')
    const t0 = performance.now()
    const ctx = buildInputContext(raw)
    const elapsed = performance.now() - t0
    expect(ctx.signals.length).toBeGreaterThan(200)
    expect(elapsed).toBeLessThan(2000)
  })
})
