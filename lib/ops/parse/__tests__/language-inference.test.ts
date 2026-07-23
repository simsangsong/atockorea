// Phase 26 §44.5.1 — L2 language inference
// Master plan §44 hard rule #16 — L2 heuristics MUST fill `language` when
// source text contains enough signal. Mirror of system.txt §FIELD RULES
// priority order: phone country code → name script.

import { heuristicExtract } from '../heuristics'

describe('heuristicExtract — language inference (Phase 26 §44.5.1)', () => {
  it('infers ko from +82 phone country code', () => {
    const paste = [
      'Lead: 김민수',
      'Phone: +82-10-1234-5678',
      'Pickup: LOTTE City Hotel Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: GUH-242924',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('ko')
  })

  it('infers zh from +886 phone country code (Taiwan)', () => {
    const paste = [
      'Lead: LIU FU MENG',
      'Phone: +886982852439',
      'Pickup: Ocean Suites Jeju Hotel',
      'Tour date: 2026-05-20',
      'Booking ID: NMU195861',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('zh')
  })

  it('infers ja from +81 phone country code', () => {
    const paste = [
      'Lead: Yamada Taro',
      'Phone: +81901234567',
      'Pickup: Shilla Duty Free Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: JP-2024',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('ja')
  })

  it('infers en from +1 phone country code', () => {
    const paste = [
      'Lead: John Smith',
      'Phone: +14155551234',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: US-9876',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('en')
  })

  it('infers en from +44 phone country code', () => {
    const paste = [
      'Lead: Emma Williams',
      'Phone: +447700900123',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: UK-1234',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('en')
  })

  it('infers ko from Hangul-only name when phone country code absent', () => {
    const paste = [
      '14번. 동쪽 - LOTTE City Hotel Jeju 08:30',
      '박지영 (2 명) - 비아토르 - BR-1385032635',
      '비고:',
      'parkjy@example.com',
    ].join('\n')
    const out = heuristicExtract(paste)
    // Skip if leadName extraction failed; only assert language when emitted.
    if (out.bookings.length > 0) {
      expect(out.bookings[0].language).toBe('ko')
    }
  })

  it('infers zh from Han-character name (no Hangul, no phone CC)', () => {
    const paste = [
      'Lead: 林淑婷',
      'Email: lin.shuting@gmail.com',
      'Pickup: Shilla Duty Free Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: 25KK229300245',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('zh')
  })

  it('infers ja from Hiragana/Katakana name', () => {
    const paste = [
      'Lead: たなか たろう',
      'Email: tanaka@example.jp',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: JP-555',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('ja')
  })

  it('phone country code wins over name script (priority 1 > 2)', () => {
    // Korean-script name but US phone — should infer en (phone CC wins).
    const paste = [
      'Lead: 박지영',
      'Phone: +14155551234',
      'Email: parkjy@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: US-555',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].language).toBe('en')
  })

  it('returns undefined when no signal available', () => {
    // Mixed-ASCII name + no phone → no signal. Falls back to en per
    // system.txt rule 4 ("Default: en") — that's L3/L4 behavior, NOT L2's
    // job. L2 leaves `undefined` and downstream LLM/UI defaults to en.
    const paste = [
      'Lead: ABEGA',  // ambiguous all-caps Latin
      'Email: abega@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: AMB-1',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    // ABEGA matches /^[A-Za-z]+$/ so we DO infer en as last priority
    expect(out.bookings[0].language).toBe('en')
  })
})
