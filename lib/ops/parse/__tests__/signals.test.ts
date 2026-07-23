// Phase 27 §45 Sprint 27.H — signal single-source: detection ↔ extraction
// round-trip + ReDoS hard-timeout guard.

import { detectSignals, extractSignalTokens } from '../signals'

describe('detectSignals / extractSignalTokens round-trip (#17)', () => {
  it('a block the detector flags for phone/email yields those tokens', () => {
    const block = 'John Smith\nEmail: john@x.com\nPhone: +1 202-555-0101\n2명'
    const sig = detectSignals(block)
    const tok = extractSignalTokens(block)
    expect(sig.email).toBe(true)
    expect(tok.emails).toContain('john@x.com')
    expect(sig.phone).toBe(true)
    expect(tok.phones[0]).toBe('+12025550101')
  })

  it('extracts whatsapp, date, time and pax tokens', () => {
    const block = 'Linda Fung\nWhatsApp: +852 9397 1724\n2026-05-31 09:00\n(3 명)'
    const tok = extractSignalTokens(block)
    expect(tok.whatsapps[0]).toBe('+85293971724')
    expect(tok.dates).toContain('2026-05-31')
    expect(tok.times).toContain('09:00')
    expect(tok.pax).toContain(3)
  })

  it('a signal-less block yields no tokens', () => {
    const block = 'Bob Lee\nTotal: walk-in group'
    const tok = extractSignalTokens(block)
    expect(tok.emails).toEqual([])
    expect(tok.phones).toEqual([])
  })
})

describe('ReDoS guard', () => {
  it('extraction is bounded on a pathological long line (no catastrophic backtracking)', () => {
    // A 40k single segment is unrealistic (blocks are small); extraction caps
    // its scan defensively, so this stays well under a linear-time budget.
    const evil = 'x'.repeat(20000) + ' / ' + '9'.repeat(20000)
    const t0 = performance.now()
    extractSignalTokens(evil)
    expect(performance.now() - t0).toBeLessThan(300)
  })

  it('detection stays fast on a realistic adversarial block', () => {
    const evil = ('Phone: ' + '9'.repeat(2000) + ' / ' + 'x'.repeat(2000) + '\n').repeat(3)
    const t0 = performance.now()
    detectSignals(evil)
    expect(performance.now() - t0).toBeLessThan(500)
  })
})
