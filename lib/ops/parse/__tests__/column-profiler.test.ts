// Phase 27 §45 Sprint 27.I — column profiler + deterministic extraction tests.

import { profileColumns, deriveMapping } from '../column-profiler'
import { extractByColumns } from '../column-extract'
import { toGrid } from '../tabular'

const TAB = '\t'

describe('profileColumns / deriveMapping — data beats a wrong header', () => {
  it('a column HEADED "phone" but full of NAMES maps to leadName, not phone', () => {
    // header lies: col0 "phone" holds names, col1 "name" holds phone numbers.
    const text = [
      ['phone', 'name', 'pax'].join(TAB),
      ['John Smith', '+1 202 555 0101', '3'].join(TAB),
      ['Maria Lopez', '+34 600 123 456', '2'].join(TAB),
      ['Wang Sihan', '+86 138 0000 1111', '4'].join(TAB),
    ].join('\n')
    const grid = toGrid(text)!
    expect(grid).not.toBeNull()
    const profiles = profileColumns(grid.rows, grid.cols)
    const { mapping } = deriveMapping(profiles, grid.header)
    expect(mapping.leadName).toBe(0) // data says col0 is names
    expect(mapping.phone).toBe(1) // data says col1 is phones
    expect(mapping.partySize).toBe(2)
  })
})

describe('extractByColumns', () => {
  it('extracts a headerless tabular paste by column data', () => {
    const text = [
      ['John Smith', 'john@x.com', '+1 202 555 0101', '3'].join(TAB),
      ['Maria Lopez', 'maria@y.com', '+34 600 123 456', '2'].join(TAB),
    ].join('\n')
    const res = extractByColumns(text)
    expect(res.bookings.length).toBe(2)
    expect(res.bookings[0]).toMatchObject({ leadName: 'John Smith', email: 'john@x.com', partySize: 3 })
    expect(res.bookings[1].phone).toBe('+34 600 123 456')
  })

  it('does not mis-map a guide-name column into pickup (the broken-first-tenant case)', () => {
    // Columns: name | guide(name-like) | phone | pax. The profiler sees TWO
    // name-ish columns; the higher-confidence one wins leadName, and a guide
    // column is never silently shoved into pickup.
    const text = [
      ['이름', '담당기사', '전화', '인원'].join(TAB),
      ['김민수', '박기사', '010-1234-5678', '2'].join(TAB),
      ['이영희', '최기사', '010-2222-3333', '4'].join(TAB),
    ].join('\n')
    const res = extractByColumns(text)
    expect(res.bookings.length).toBe(2)
    expect(res.bookings.map(b => b.leadName).sort()).toEqual(['김민수', '이영희'])
    for (const b of res.bookings) {
      expect(b.phone).toMatch(/010-1234-5678|010-2222-3333/)
      // a person/guide name must never have landed in the pickup slot
      expect(b.pickupPointRaw == null || !/기사|민수|영희/.test(b.pickupPointRaw)).toBe(true)
    }
  })

  it('defers (returns empty) when no identity column can be derived', () => {
    const text = [
      ['100', '200', '300'].join(TAB),
      ['101', '201', '301'].join(TAB),
    ].join('\n')
    const res = extractByColumns(text)
    expect(res.bookings).toEqual([])
    expect(res.leftover.length).toBe(1) // whole paste deferred to the LLM
  })
})
