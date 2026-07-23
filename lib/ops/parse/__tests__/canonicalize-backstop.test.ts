import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock the canonicalizer — keeps the test free of Supabase + geocoding.
jest.mock('@/lib/ops/pickup/canonicalize', () => ({
  canonicalizePickup: jest.fn(async (raw: string) => {
    if (/lotte/i.test(raw)) {
      return {
        canonical_id: 'loc-lotte',
        canonical_name: 'LOTTE City Hotel Jeju',
        method: 'alias_exact',
        confidence: 1.0,
      }
    }
    if (/ocean suites/i.test(raw)) {
      return {
        canonical_id: 'loc-ocean',
        canonical_name: 'Ocean Suites Jeju Hotel',
        method: 'alias_fuzzy',
        confidence: 0.91,
      }
    }
    if (/low-conf/i.test(raw)) {
      // Below the 0.85 threshold — should NOT be applied.
      return { canonical_id: 'x', canonical_name: 'Bogus', method: 'alias_fuzzy', confidence: 0.7 }
    }
    return { canonical_id: null, method: 'unresolved', confidence: 0 }
  }),
}))

import { canonicalizePickup } from '@/lib/ops/pickup/canonicalize'
import { canonicalizeAllPickups } from '../canonicalize-backstop'

beforeEach(() => {
  jest.clearAllMocks()
})

function mockBooking(over: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    sourcePlatform: 'gyg',
    externalBookingId: 'TEST-1',
    leadName: 'Test',
    partySize: 1,
    confidenceScore: 0.9,
    issues: [],
    ...over,
  }
}

describe('canonicalizeAllPickups', () => {
  it('fills pickupPointNormalized for raws that resolve at ≥0.85 confidence', async () => {
    const bookings = [
      mockBooking({ pickupPointRaw: 'Lotte city Hotel jeju' }),
      mockBooking({ pickupPointRaw: 'Ocean Suites Jeju Hotel' }),
    ]
    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    await canonicalizeAllPickups(bookings, 'tenant-1', e => events.push(e))
    expect(bookings[0].pickupPointNormalized).toBe('LOTTE City Hotel Jeju')
    expect(bookings[1].pickupPointNormalized).toBe('Ocean Suites Jeju Hotel')
    const done = events.find(e => e.event === 'canonicalize_done')
    expect(done?.data.resolved).toBe(2)
    expect(done?.data.attempted).toBe(2)
  })

  it('passes the funnel Supabase client through to the canonicalizer', async () => {
    const bookings = [mockBooking({ pickupPointRaw: 'Lotte city Hotel jeju' })]
    const supabase = { from: jest.fn() } as unknown as SupabaseClient

    await canonicalizeAllPickups(bookings, 'tenant-1', () => {}, supabase)

    expect(canonicalizePickup).toHaveBeenCalledWith(
      'Lotte city Hotel jeju',
      'tenant-1',
      undefined,
      supabase,
    )
  })

  it('resolves duplicate raw pickups once and applies the result to every row', async () => {
    const bookings = [
      mockBooking({ pickupPointRaw: 'Lotte city Hotel jeju' }),
      mockBooking({ pickupPointRaw: 'Lotte city Hotel jeju' }),
      mockBooking({ pickupPointRaw: 'LOTTE CITY HOTEL JEJU' }),
    ]
    const events: Array<{ event: string; data: Record<string, unknown> }> = []

    await canonicalizeAllPickups(bookings, 'tenant-1', e => events.push(e))

    expect(canonicalizePickup).toHaveBeenCalledTimes(1)
    expect(bookings.every(b => b.pickupPointNormalized === 'LOTTE City Hotel Jeju')).toBe(true)
    const done = events.find(e => e.event === 'canonicalize_done')
    expect(done?.data.attempted).toBe(3)
    expect(done?.data.unique).toBe(1)
    expect(done?.data.resolved).toBe(3)
  })

  it('skips bookings that already have pickupPointNormalized', async () => {
    const bookings = [
      mockBooking({
        pickupPointRaw: 'Lotte city Hotel jeju',
        pickupPointNormalized: 'PreAssigned Canonical',
      }),
    ]
    await canonicalizeAllPickups(bookings, 'tenant-1', () => {})
    expect(bookings[0].pickupPointNormalized).toBe('PreAssigned Canonical')
  })

  it('skips resolutions below the 0.85 confidence threshold', async () => {
    const bookings = [
      mockBooking({ pickupPointRaw: 'low-conf place' }),
    ]
    await canonicalizeAllPickups(bookings, 'tenant-1', () => {})
    expect(bookings[0].pickupPointNormalized).toBeUndefined()
  })

  it('emits a single canonicalize_done with attempted=0 when there is nothing to do', async () => {
    const bookings: ParsedBooking[] = [mockBooking({ pickupPointNormalized: 'X' })]
    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    await canonicalizeAllPickups(bookings, 'tenant-1', e => events.push(e))
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('canonicalize_done')
    expect(events[0].data.attempted).toBe(0)
  })

  it('keeps the raw value when the resolver returns unresolved', async () => {
    const bookings = [mockBooking({ pickupPointRaw: 'unknown spot' })]
    await canonicalizeAllPickups(bookings, 'tenant-1', () => {})
    expect(bookings[0].pickupPointRaw).toBe('unknown spot')
    expect(bookings[0].pickupPointNormalized).toBeUndefined()
  })
})
