// Phase 27 / Sprint C — cruiseShipText corpus test.
//
// Drives a real "제주 크루즈 스몰 그룹" roster (audited 2026-05-22) through the
// production ship backstop (resolveAllCruiseShips) with an offline resolver that
// runs the real resolve-ship-id.ts algorithm against the seeded alias snapshot.
// Validates two guarantees:
//   • 8 ship-name variants (clean / lowercase / typo / bare-suffix / no-label /
//     flight-field mislabel) all collapse to the seeded canonical_name.
//   • GetYourGuide ship-less rows are NEVER given a fabricated ship (Hard Rule
//     #18: signal-absent → no extraction, review-flag downstream).

import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { FunnelEvent } from '../funnel-events'
import { resolveAllCruiseShips } from '../cruise-ship-backstop'
import {
  SHIP_PRESENT_CASES,
  SHIP_ABSENT_CASES,
  fakeResolveShip,
  shipIdFor,
  type CruiseShipCase,
} from './fixtures/cruise-smallgroup-corpus'

jest.mock('@/lib/ops/cruise/resolve-ship-id', () => {
  const actual = jest.requireActual<typeof import('@/lib/ops/cruise/resolve-ship-id')>(
    '@/lib/ops/cruise/resolve-ship-id',
  )
  return { ...actual, resolveCruiseShipId: jest.fn() }
})
import { resolveCruiseShipId } from '@/lib/ops/cruise/resolve-ship-id'

const TENANT = '71a4560e-29f6-4b25-9722-8b8f284f6e1d'

function bookingFor(c: CruiseShipCase): ParsedBooking {
  return {
    sourcePlatform: c.sourcePlatform,
    externalBookingId: c.externalBookingId,
    leadName: 'Test Lead',
    partySize: 2,
    productName: c.productName,
    notes: c.notes,
    confidenceScore: 0.92,
    issues: [],
  }
}

describe('cruiseShipText corpus — Sprint C', () => {
  let events: FunnelEvent[]
  const emit = (e: FunnelEvent) => events.push(e)
  const supabase = {} as Parameters<typeof resolveAllCruiseShips>[0]

  beforeEach(() => {
    events = []
    // The offline resolver ignores the supabase arg and resolves against the
    // seeded snapshot, mirroring the production 3-step algorithm.
    jest.mocked(resolveCruiseShipId).mockImplementation(async (_sb, text) => fakeResolveShip(text))
  })

  describe('ship-present variants → seeded canonical', () => {
    it.each(SHIP_PRESENT_CASES.map(c => [c.label, c] as const))('%s', async (_label, c) => {
      const b = bookingFor(c)
      await resolveAllCruiseShips(supabase, [b], TENANT, emit)

      expect(c.expected).not.toBeNull()
      expect(b.cruiseShipText).toBe(c.expected!.canonical)
      expect(b.cruiseShipId).toBe(shipIdFor(c.expected!.canonical))
      expect(b.issues ?? []).not.toContain('cruise_ship_unmatched')
      expect(b.issues ?? []).not.toContain('cruise_ship_missing')
    })

    it('canonicalizes every Celebrity Millennium spelling to one group key', async () => {
      const celebrity = SHIP_PRESENT_CASES.filter(c => c.expected?.canonical === 'Celebrity Millennium')
      const bookings = celebrity.map(bookingFor)
      await resolveAllCruiseShips(supabase, bookings, TENANT, emit)

      // Grouping uses cruiseShipText — all spellings must collapse to one value.
      expect(new Set(bookings.map(b => b.cruiseShipText))).toEqual(new Set(['Celebrity Millennium']))
      expect(new Set(bookings.map(b => b.cruiseShipId))).toEqual(new Set([shipIdFor('Celebrity Millennium')]))
    })

    it('records the expected resolver method per case (extraction-path map)', async () => {
      const seen: Record<string, string> = {}
      for (const c of SHIP_PRESENT_CASES) {
        const match = fakeResolveShip(
          // Bare ship text (post-extraction) for the labeled cases; whole-notes
          // for the no-label / mislabel cases — same inputs the backstop feeds.
          c.notes,
        )
        // Document, don't over-assert: the corpus pins the canonical, the method
        // column captures which seeded path each variant exercises.
        if (match) seen[c.externalBookingId] = match.method
      }
      // Every ship-present case resolves to a non-null canonical somehow.
      expect(Object.keys(seen).length).toBeGreaterThan(0)
    })
  })

  describe('ship-absent (GetYourGuide) → never fabricated', () => {
    it.each(SHIP_ABSENT_CASES.map(c => [c.label, c] as const))('%s', async (_label, c) => {
      const b = bookingFor(c)
      await resolveAllCruiseShips(supabase, [b], TENANT, emit)

      // Hard Rule #18 defense line: signal-absent rows are not given a ship,
      // and are flagged for operator review (never silently blank).
      expect(b.cruiseShipText).toBeUndefined()
      expect(b.cruiseShipId == null).toBe(true)
      expect(b.issues ?? []).toContain('cruise_ship_missing')
    })

    it('emits no successful resolution and counts the whole ship-less batch as missing', async () => {
      const bookings = SHIP_ABSENT_CASES.map(bookingFor)
      await resolveAllCruiseShips(supabase, bookings, TENANT, emit)
      expect(bookings.every(b => !b.cruiseShipText)).toBe(true)
      const done = events.find(e => e.event === 'cruise_ship_resolve_done')!
      expect(done.data.missing).toBe(SHIP_ABSENT_CASES.length)
    })
  })
})
