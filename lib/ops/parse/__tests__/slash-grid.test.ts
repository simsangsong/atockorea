// Phase 27 §45 — spaced-slash multi-OTA operator roster (' / ' delimited).
//
// Regression for the K ONE TOUR first-import failure: a structured roster whose
// records are single ' / '-delimited lines (≥2 distinct OTA markers ⇒ classified
// 'mixed') was never offered to the L1.5 deterministic column extractor —
// toGrid only knew CSV/TSV separators — so the whole sheet fell to the LLM, and
// when the LLM was unavailable every row landed in the final-leftover corpus at
// $0. These tests lock in: (1) toGrid recognizes the spaced-slash grid and
// strips a leading "row N:" index, (2) extraction resolves the lead name to the
// real name column (column-order, never the location/region column), (3) a bare
// slash in a date/address does NOT shatter a row.

import { toGrid } from '../tabular'
import { extractByColumns } from '../column-extract'

// Import A layout — name / pax / pickup / phone / platform (sanitized).
const IMPORT_A = [
  'row 316: Aiden River / 1 / Myeong-dong Station Exit 2 / +82 10-1000-2000 / viator',
  'row 313: Mara Stone / 1 / Hongik University Station Exit 8 / +82 10-1000-2001 / GYG',
  'row 314: Lena Park / 4 / Myeong-dong Station Exit 2 / +82 10-1000-2002 / klook',
  'row 217: Caitlyn Fox / 1 / Myeong-dong Station Exit 2 / +82 10-1000-2003 / klook',
].join('\n')

// Import B layout — platform / name / region / pax / address (sanitized).
const IMPORT_B = [
  '51: klook / Phoebe Sun / Seoul / 3 / 19 Yanghwa-ro 2F Mapo-gu Seoul',
  '54: kkday / Riley Wang / Jeju / 2 / Ocean Suites Jeju Hotel',
  '57: viator / Sankalp Rao / Jeju / 4 / Shilla Stay Plus Ihoteu Jeju',
].join('\n')

describe('spaced-slash roster — toGrid', () => {
  it('grids import A and strips the "row N:" index from column 0', () => {
    const grid = toGrid(IMPORT_A)
    expect(grid).not.toBeNull()
    expect(grid!.cols).toBe(5)
    // col0 must be the name, NOT "row 316: Aiden River".
    expect(grid!.rows[0][0]).toBe('Aiden River')
  })

  it('grids import B (platform-first, ≥3 columns)', () => {
    const grid = toGrid(IMPORT_B)
    expect(grid).not.toBeNull()
    expect(grid!.cols).toBe(5)
    expect(grid!.rows[0][0]).toBe('klook')
  })

  it('does NOT grid a bare-slash date or a single free-text line', () => {
    expect(toGrid('Tour on 5/31/2026 for 4 pax\nmeet at lobby 9/10')).toBeNull()
  })
})

describe('spaced-slash roster — extractByColumns resolves the real name', () => {
  it('import A: lead name is the person, pax + phone + platform captured', () => {
    const res = extractByColumns(IMPORT_A)
    expect(res.bookings.length).toBe(4)
    const b = res.bookings[0]
    expect(b.leadName).toBe('Aiden River')
    expect(b.partySize).toBe(1)
    expect(b.phone).toBe('+82 10-1000-2000')
    expect(b.sourcePlatform).toBe('viator')
    // The location column must never be mis-mapped as the lead name.
    expect(res.bookings.map(x => x.leadName)).not.toContain('Myeong-dong Station Exit 2')
  })

  it('import B: lead name is the person, not the region or address', () => {
    const res = extractByColumns(IMPORT_B)
    expect(res.bookings.length).toBe(3)
    const names = res.bookings.map(b => b.leadName)
    expect(names).toContain('Phoebe Sun')
    expect(names).not.toContain('Seoul')
    expect(names).not.toContain('Jeju')
    expect(res.bookings[0].partySize).toBe(3)
    expect(res.bookings[0].sourcePlatform).toBe('klook')
  })
})
