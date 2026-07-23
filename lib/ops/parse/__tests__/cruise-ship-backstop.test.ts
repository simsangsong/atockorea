// Tests for the cruise-ship-backstop: ensures it fills cruiseShipId on
// bookings that carry cruiseShipText, marks misses with explicit null, and
// emits the start/done events.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { FunnelEvent } from '../funnel-events'
import { resolveAllCruiseShips } from '../cruise-ship-backstop'

// Mock resolve-ship-id so the backstop doesn't need a real Supabase client.
jest.mock('@/lib/ops/cruise/resolve-ship-id', () => ({
  resolveCruiseShipId: jest.fn(),
}))
import { resolveCruiseShipId } from '@/lib/ops/cruise/resolve-ship-id'

function booking(overrides: Partial<ParsedBooking>): ParsedBooking {
  return {
    sourcePlatform: 'gyg',
    externalBookingId: overrides.externalBookingId ?? 'TEST-001',
    leadName: overrides.leadName ?? 'Test Lead',
    partySize: 2,
    confidenceScore: 0.92,
    issues: [],
    ...overrides,
  }
}

describe('resolveAllCruiseShips', () => {
  const supabase = {} as Parameters<typeof resolveAllCruiseShips>[0]
  const tenant = '71a4560e-29f6-4b25-9722-8b8f284f6e1d'
  let events: FunnelEvent[]
  const emit = (e: FunnelEvent) => events.push(e)

  beforeEach(() => {
    events = []
    jest.mocked(resolveCruiseShipId).mockReset()
  })

  it('emits done with attempted=0 when no booking has cruiseShipText', async () => {
    const bookings = [booking({}), booking({})]
    await resolveAllCruiseShips(supabase, bookings, tenant, emit)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ event: 'cruise_ship_resolve_done', data: { attempted: 0, resolved: 0, missing: 0 } })
    expect(resolveCruiseShipId).not.toHaveBeenCalled()
  })

  it('fills cruiseShipId on success and counts methods', async () => {
    jest.mocked(resolveCruiseShipId).mockImplementation(async (_sb, text) => {
      if (text === 'Norwegian Spirit') {
        return { id: 'ship-1', canonical_name: 'Norwegian Spirit', method: 'exact_canonical', confidence: 1.0 }
      }
      if (text === 'NCL Spirit') {
        return { id: 'ship-1', canonical_name: 'Norwegian Spirit', method: 'alias_normalized', confidence: 0.95 }
      }
      return null
    })
    const bookings = [
      booking({ cruiseShipText: 'Norwegian Spirit' }),
      booking({ cruiseShipText: 'NCL Spirit' }),
      booking({ cruiseShipText: 'Unknown Ship' }),
    ]
    await resolveAllCruiseShips(supabase, bookings, tenant, emit)
    expect(bookings[0].cruiseShipId).toBe('ship-1')
    expect(bookings[1].cruiseShipId).toBe('ship-1')
    expect(bookings[2].cruiseShipId).toBeNull()   // explicit-null sentinel
    // Canonical writeback: a raw alias spelling collapses to canonical_name so
    // grouping keys (which use cruiseShipText) don't fragment by spelling.
    expect(bookings[1].cruiseShipText).toBe('Norwegian Spirit')  // was 'NCL Spirit'
    expect(bookings[2].cruiseShipText).toBe('Unknown Ship')      // miss → raw kept
    expect(bookings[2].issues).toContain('cruise_ship_unmatched')

    const done = events.find(e => e.event === 'cruise_ship_resolve_done')!
    expect(done.data.attempted).toBe(3)
    expect(done.data.resolved).toBe(2)
    expect(done.data.methods).toEqual({ exact_canonical: 1, alias_normalized: 1 })
  })

  // Fragmentation fix: rule/heuristic-emitted ship slots arrive with many raw
  // spellings of the same ship. After resolution every one carries the single
  // canonical_name, so the wizard's `cruise|<text>|port|date` key collapses
  // them into one group instead of one-group-per-spelling.
  it('canonicalizes every spelling variant of one ship to a single text', async () => {
    jest.mocked(resolveCruiseShipId).mockImplementation(async (_sb, text) =>
      /anthem|athems/i.test(text)
        ? { id: 'ship-anthem', canonical_name: 'Anthem of the Seas', method: 'partial_substring', confidence: 0.75 }
        : null,
    )
    const variants = [
      'Anthem of the seas',
      'Anthem OF the Seas',
      'Royal Caribbean anthem',
      'Anthem of the Sea',
      'Anthems of the sea',
    ]
    const bookings = variants.map(v => booking({ cruiseShipText: v }))
    await resolveAllCruiseShips(supabase, bookings, tenant, emit)
    expect(bookings.every(b => b.cruiseShipId === 'ship-anthem')).toBe(true)
    expect(new Set(bookings.map(b => b.cruiseShipText))).toEqual(new Set(['Anthem of the Seas']))
  })

  it('resolves duplicate ship text only once and applies the result to every row', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({
      id: 'ship-spectrum',
      canonical_name: 'Spectrum of the Seas',
      method: 'exact_canonical',
      confidence: 1.0,
    })
    const bookings = [
      booking({ externalBookingId: 'A', cruiseShipText: 'Spectrum of the Seas' }),
      booking({ externalBookingId: 'B', cruiseShipText: 'Spectrum of the Seas' }),
      booking({ externalBookingId: 'C', cruiseShipText: 'Spectrum of the Seas' }),
    ]

    await resolveAllCruiseShips(supabase, bookings, tenant, emit)

    expect(resolveCruiseShipId).toHaveBeenCalledTimes(1)
    expect(bookings.every(b => b.cruiseShipId === 'ship-spectrum')).toBe(true)
    const done = events.find(e => e.event === 'cruise_ship_resolve_done')!
    expect(done.data.attempted).toBe(3)
    expect(done.data.resolved).toBe(3)
    expect(done.data.unique).toBe(1)
  })

  it('does NOT re-process a booking whose cruiseShipId was already set', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({
      id: 'ship-new',
      canonical_name: 'New Ship',
      method: 'exact_canonical',
      confidence: 1.0,
    })
    const bookings = [
      booking({ cruiseShipText: 'Norwegian Spirit', cruiseShipId: 'ship-pre-resolved' }),
    ]
    await resolveAllCruiseShips(supabase, bookings, tenant, emit)
    expect(bookings[0].cruiseShipId).toBe('ship-pre-resolved')
    expect(resolveCruiseShipId).not.toHaveBeenCalled()
  })

  it('retries a cached previous miss when cruiseShipId is null', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({
      id: 'ship-spectrum',
      canonical_name: 'SPECTRUM OF THE SEAS',
      method: 'alias_normalized',
      confidence: 0.95,
    })
    const bookings = [
      booking({ cruiseShipText: 'Spectrum f the Seaso', cruiseShipId: null }),
    ]

    await resolveAllCruiseShips(supabase, bookings, tenant, emit)

    expect(bookings[0].cruiseShipId).toBe('ship-spectrum')
    expect(bookings[0].cruiseShipText).toBe('SPECTRUM OF THE SEAS')
    expect(resolveCruiseShipId).toHaveBeenCalledTimes(1)
  })

  it('treats resolver exceptions as misses (sets cruiseShipId=null) and continues', async () => {
    jest.mocked(resolveCruiseShipId).mockRejectedValueOnce(new Error('db down'))
    const bookings = [booking({ cruiseShipText: 'Norwegian Spirit' })]
    await resolveAllCruiseShips(supabase, bookings, tenant, emit)
    expect(bookings[0].cruiseShipId).toBeNull()
  })

  // §44.5.14 — lift a ship out of the pickup field (kkday "/ Celebrity Millennium /")
  it('lifts a ship name out of an UN-canonicalized pickup field', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({ id: 'ship-1', canonical_name: 'Celebrity Millennium', method: 'alias_normalized', confidence: 1 })
    const b = booking({ pickupPointRaw: 'Celebrity Millennium' })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBe('Celebrity Millennium')
    expect(b.cruiseShipId).toBe('ship-1')
    expect(b.pickupPointRaw).toBeUndefined()
    expect(events.some(e => e.event === 'cruise_ship_lifted_from_pickup')).toBe(true)
  })

  // §44.5.17 — a ship that canonicalize already turned into a ship-shaped fake
  // pickup ("Royal Caribbean — Ovation of the Seas") is still lifted: if the raw
  // pickup resolves as a ship it was never a real place. cruiseShipText takes
  // the clean canonical name, and the bogus pickup is cleared.
  it('lifts a ship even after canonicalize normalized it into a fake pickup', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({ id: 'ship-9', canonical_name: 'Ovation of the Seas', method: 'partial_substring', confidence: 0.75 })
    const b = booking({
      pickupPointRaw: 'Royal Carribean (Ovation of the Seas)',
      pickupPointNormalized: 'Royal Caribbean — Ovation of the Seas',
    })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBe('Ovation of the Seas')
    expect(b.cruiseShipId).toBe('ship-9')
    expect(b.pickupPointRaw).toBeUndefined()
    expect(b.pickupPointNormalized).toBeUndefined()
  })

  // §44.5.17 — cruise OTAs misuse "Flight number:" for the ship. The ship lives
  // only in notes; copy it to cruiseShipText, keep the notes intact.
  it('lifts a ship embedded in notes (Flight number: Costa Serena)', async () => {
    // Pickup is a real port (resolver misses); only the notes carry the ship.
    jest.mocked(resolveCruiseShipId).mockImplementation(async (_sb, text) =>
      /serena/i.test(text)
        ? { id: 'ship-7', canonical_name: 'Costa Serena', method: 'partial_substring', confidence: 0.75 }
        : null,
    )
    const notes = 'Flight number: Costa Serena | No. of participants: 9'
    const b = booking({ pickupPointRaw: 'Seogwipo Gangjeong Cruise Terminal', pickupPointNormalized: 'Seogwipo Gangjeong Cruise Terminal', notes })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBe('Costa Serena')
    expect(b.cruiseShipId).toBe('ship-7')
    expect(b.notes).toBe(notes)                 // notes preserved
    expect(b.pickupPointNormalized).toBe('Seogwipo Gangjeong Cruise Terminal') // real port kept
  })

  it('lifts a labeled unknown ship from notes as a manual-confirm candidate', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue(null)
    const b = booking({
      productName: 'Jeju Cruise Small Group',
      notes: 'Flight number: Blue Dream | No. of participants: 2',
    })

    await resolveAllCruiseShips(supabase, [b], tenant, emit)

    expect(b.cruiseShipText).toBe('Blue Dream')
    expect(b.cruiseShipId).toBeNull()
    expect(b.issues).toContain('cruise_ship_unmatched')
  })

  it('trims Korean arrival fields after an unknown ship label', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue(null)
    const b = booking({
      productName: 'Jeju Cruise Small Group',
      notes: '도착 정보:\n크루즈선: Blue Dream 하선 시간: 8:30 하차 위치: Port of Jeju',
    })

    await resolveAllCruiseShips(supabase, [b], tenant, emit)

    expect(b.cruiseShipText).toBe('Blue Dream')
    expect(b.cruiseShipId).toBeNull()
    expect(b.issues).toContain('cruise_ship_unmatched')
  })

  // §44.5.17 — ship in the product/title line.
  it('lifts a ship from the product header', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({ id: 'ship-3', canonical_name: 'Anthem of the Seas', method: 'partial_substring', confidence: 0.75 })
    const b = booking({ productName: '제주 크루즈 - Anthem of the Seas (버스투어)' })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBe('Anthem of the Seas')
    expect(b.cruiseShipId).toBe('ship-3')
  })

  it('does NOT lift a real place (ship resolver misses → pickup kept)', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue(null)
    const b = booking({ pickupPointRaw: 'LOTTE City Hotel Jeju' })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBeUndefined()
    expect(b.pickupPointRaw).toBe('LOTTE City Hotel Jeju')
  })

  // No cruise context anywhere → the lift probe never runs (RPC-cost guard),
  // so a real canonicalized place is untouched even if a resolver would hit.
  it('does NOT probe a booking with no cruise context', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({ id: 'x', canonical_name: 'X', method: 'exact_canonical', confidence: 1 })
    const b = booking({ pickupPointRaw: 'Lotte Hotel Jeju', pickupPointNormalized: 'Lotte Hotel Jeju' })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBeUndefined()
    expect(resolveCruiseShipId).not.toHaveBeenCalled()
  })

  // Regression (pressure test 2026-05-23): a brand keyword embedded in a longer
  // alphanumeric token must NOT trip cruise context. Chelsea is a regular 남쪽 bus
  // tour whose LINE id "_princesspayapa" contains "princess"; before \b-bounding
  // CRUISE_CONTEXT_RE this resolved her to "Diamond Princess" and mis-grouped her
  // into a cruise team.
  it('does NOT treat a brand keyword inside a LINE/WeChat id as cruise context', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({ id: 'dp', canonical_name: 'Diamond Princess', method: 'partial_substring', confidence: 0.75 })
    const b = booking({
      leadName: 'Chelsea May Abrencillo',
      productName: '남쪽',
      pickupPointRaw: 'Jeju International Airport',
      pickupPointNormalized: 'Jeju International Airport',
      notes: 'LINE=_princesspayapa',
    })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(resolveCruiseShipId).not.toHaveBeenCalled()
    expect(b.cruiseShipText).toBeUndefined()
    expect(b.cruiseShipId).toBeUndefined()
    expect(b.issues).not.toContain('cruise_ship_missing')
  })

  // The whole-word brand keyword still signals context (genuine cruise mention
  // with no Korean 크루즈 nearby).
  it('still treats a standalone brand keyword as cruise context', async () => {
    jest.mocked(resolveCruiseShipId).mockResolvedValue({ id: 'dp', canonical_name: 'Diamond Princess', method: 'alias_normalized', confidence: 0.95 })
    const b = booking({ leadName: 'Real Cruiser', productName: 'Jeju tour', notes: 'Ship: Diamond Princess arrival 9am' })
    await resolveAllCruiseShips(supabase, [b], tenant, emit)
    expect(b.cruiseShipText).toBe('Diamond Princess')
    expect(b.cruiseShipId).toBe('dp')
  })
})
