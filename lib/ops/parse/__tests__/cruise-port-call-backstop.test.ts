// Tests for the cruise-port-call-backstop: attaches port_call_id when
// (cruiseShipId, tourDate) match a scheduled voyage, sets ambiguity flag,
// emits start/done events.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { FunnelEvent } from '../funnel-events'
import { inferMissingCruiseDatesFromPortCalls, resolveAllCruisePortCalls } from '../cruise-port-call-backstop'

jest.mock('@/lib/ops/cruise/find-port-call', () => ({
  findPortCallByShipDate: jest.fn(),
}))
import { findPortCallByShipDate } from '@/lib/ops/cruise/find-port-call'

function booking(overrides: Partial<ParsedBooking>): ParsedBooking {
  return {
    sourcePlatform: 'gyg',
    externalBookingId: overrides.externalBookingId ?? 'TEST-001',
    leadName: 'Test Lead',
    partySize: 2,
    confidenceScore: 0.92,
    issues: [],
    ...overrides,
  }
}

describe('resolveAllCruisePortCalls', () => {
  const supabase = {} as Parameters<typeof resolveAllCruisePortCalls>[0]
  let events: FunnelEvent[]
  const emit = (e: FunnelEvent) => events.push(e)

  beforeEach(() => {
    events = []
    jest.mocked(findPortCallByShipDate).mockReset()
  })

  it('emits attempted=0 when no booking has both cruiseShipId and tourDate', async () => {
    const bookings = [
      booking({ cruiseShipId: 'ship-1' }),                          // missing date
      booking({ tourDate: '2026-09-04' }),                          // missing ship
      booking({ cruiseShipId: null, tourDate: '2026-09-04' }),      // null ship_id
    ]
    await resolveAllCruisePortCalls(supabase, bookings, emit)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('cruise_port_call_resolve_done')
    expect(events[0].data.attempted).toBe(0)
    expect(findPortCallByShipDate).not.toHaveBeenCalled()
  })

  it('attaches port_call_id on hit and sets the multiple-flag', async () => {
    jest.mocked(findPortCallByShipDate).mockImplementation(async (_sb, shipId) => {
      if (shipId === 'ship-clean') {
        return {
          port_call_id: 'pc-1',
          port_canonical_id: 'port-jeju',
          arrival_at: '2026-09-04T08:00:00+09:00',
          departure_at: '2026-09-04T16:00:00+09:00',
          terminal_info: '제주항',
          multiple: false,
        }
      }
      if (shipId === 'ship-ambiguous') {
        return {
          port_call_id: 'pc-AM',
          port_canonical_id: 'port-busan',
          arrival_at: '2026-09-04T09:00:00+09:00',
          departure_at: null,
          terminal_info: null,
          multiple: true,
        }
      }
      return null
    })

    const bookings = [
      booking({ cruiseShipId: 'ship-clean', tourDate: '2026-09-04' }),
      booking({ cruiseShipId: 'ship-ambiguous', tourDate: '2026-09-04' }),
      booking({ cruiseShipId: 'ship-no-match', tourDate: '2030-01-01' }),
    ]
    await resolveAllCruisePortCalls(supabase, bookings, emit)

    expect(bookings[0].cruisePortCallId).toBe('pc-1')
    expect(bookings[0].cruisePortCallMultiple).toBeUndefined()

    expect(bookings[1].cruisePortCallId).toBe('pc-AM')
    expect(bookings[1].cruisePortCallMultiple).toBe(true)
    expect(bookings[1].issues).toContain('cruise_port_call_multiple')

    expect(bookings[2].cruisePortCallId).toBeNull()
    expect(bookings[2].issues).toContain('cruise_port_call_unmatched')

    const done = events.find(e => e.event === 'cruise_port_call_resolve_done')!
    expect(done.data.attempted).toBe(3)
    expect(done.data.resolved).toBe(2)
    expect(done.data.ambiguous).toBe(1)
  })

  it('looks up duplicate ship-date pairs once and applies the match to every row', async () => {
    jest.mocked(findPortCallByShipDate).mockResolvedValue({
      port_call_id: 'pc-spectrum',
      port_canonical_id: 'port-jeju',
      arrival_at: '2026-09-04T08:00:00+09:00',
      departure_at: '2026-09-04T16:00:00+09:00',
      terminal_info: 'Jeju Cruise Terminal',
      multiple: false,
    })
    const bookings = [
      booking({ externalBookingId: 'A', cruiseShipId: 'ship-spectrum', tourDate: '2026-09-04' }),
      booking({ externalBookingId: 'B', cruiseShipId: 'ship-spectrum', tourDate: '2026-09-04' }),
      booking({ externalBookingId: 'C', cruiseShipId: 'ship-spectrum', tourDate: '2026-09-04' }),
    ]

    await resolveAllCruisePortCalls(supabase, bookings, emit)

    expect(findPortCallByShipDate).toHaveBeenCalledTimes(1)
    expect(bookings.every(b => b.cruisePortCallId === 'pc-spectrum')).toBe(true)
    const done = events.find(e => e.event === 'cruise_port_call_resolve_done')!
    expect(done.data.attempted).toBe(3)
    expect(done.data.resolved).toBe(3)
    expect(done.data.unique).toBe(1)
  })

  it('treats exceptions as misses (null sentinel)', async () => {
    jest.mocked(findPortCallByShipDate).mockRejectedValue(new Error('db down'))
    const bookings = [booking({ cruiseShipId: 'ship-1', tourDate: '2026-09-04' })]
    await resolveAllCruisePortCalls(supabase, bookings, emit)
    expect(bookings[0].cruisePortCallId).toBeNull()
    expect(bookings[0].issues).toContain('cruise_port_call_unmatched')
  })

  it('skips bookings that already have cruisePortCallId set', async () => {
    jest.mocked(findPortCallByShipDate).mockResolvedValue(null)
    const bookings = [
      booking({ cruiseShipId: 'ship-1', tourDate: '2026-09-04', cruisePortCallId: 'pre-set' }),
    ]
    await resolveAllCruisePortCalls(supabase, bookings, emit)
    expect(bookings[0].cruisePortCallId).toBe('pre-set')
    expect(findPortCallByShipDate).not.toHaveBeenCalled()
  })

  it('retries a cached previous port-call miss when cruisePortCallId is null', async () => {
    jest.mocked(findPortCallByShipDate).mockResolvedValue({
      port_call_id: 'pc-new',
      port_canonical_id: 'port-jeju',
      arrival_at: '2026-09-04T08:00:00+09:00',
      departure_at: null,
      terminal_info: null,
      multiple: false,
    })
    const bookings = [
      booking({ cruiseShipId: 'ship-1', tourDate: '2026-09-04', cruisePortCallId: null }),
    ]

    await resolveAllCruisePortCalls(supabase, bookings, emit)

    expect(bookings[0].cruisePortCallId).toBe('pc-new')
    expect(findPortCallByShipDate).toHaveBeenCalledTimes(1)
  })
})

function mockSupabaseForPortCalls(returnedRows: Array<{
  id: string
  port_canonical_id: string
  arrival_at: string
  departure_at?: string | null
  terminal_info?: string | null
  pickup_locations?: { canonical_name?: string | null; address?: string | null } | null
}>) {
  const captured = { table: '', shipId: '', gte: '', lte: '' }
  const supabase = {
    from(table: string) {
      captured.table = table
      return {
        select() { return this },
        eq(col: string, val: string) {
          if (col === 'cruise_ship_id') captured.shipId = val
          return this
        },
        gte(_col: string, val: string) { captured.gte = val; return this },
        lte(_col: string, val: string) { captured.lte = val; return this },
        async order() { return { data: returnedRows } },
      }
    },
  } as unknown as Parameters<typeof inferMissingCruiseDatesFromPortCalls>[0]

  return { supabase, captured }
}

describe('inferMissingCruiseDatesFromPortCalls', () => {
  const baseNow = new Date('2026-05-20T15:10:00.000Z') // 2026-05-21 KST
  let events: FunnelEvent[]
  const emit = (e: FunnelEvent) => events.push(e)

  beforeEach(() => {
    events = []
  })

  it('fills date and port-call id from ship plus Gangjeong port hint', async () => {
    const { supabase, captured } = mockSupabaseForPortCalls([
      {
        id: 'pc-gangjeong',
        port_canonical_id: 'port-gangjeong',
        arrival_at: '2026-05-22T08:00:00+09:00',
        departure_at: '2026-05-22T18:00:00+09:00',
        terminal_info: 'Gangjeong berth',
        pickup_locations: { canonical_name: 'Seogwipo Gangjeong Cruise Terminal' },
      },
      {
        id: 'pc-jeju',
        port_canonical_id: 'port-jeju',
        arrival_at: '2026-06-10T08:00:00+09:00',
        pickup_locations: { canonical_name: 'Jeju International Cruise Terminal' },
      },
    ])
    const rows = [
      booking({
        cruiseShipId: 'ship-1',
        cruiseShipText: 'Celebrity Millennium',
        productName: 'Jeju Cruise Small Group',
        pickupPointRaw: 'Seogwipo Gangjeong Cruise Terminal',
      }),
    ]

    await inferMissingCruiseDatesFromPortCalls(supabase, rows, emit, baseNow)

    expect(captured.table).toBe('ops_cruise_port_calls')
    expect(captured.shipId).toBe('ship-1')
    expect(captured.gte).toBe('2026-05-22T00:00:00+09:00')
    expect(rows[0].tourDate).toBe('2026-05-22')
    expect(rows[0].cruisePortCallId).toBe('pc-gangjeong')
    expect(rows[0].issues).not.toContain('cruise_port_call_date_ambiguous')
  })

  it('uses a single next-day ship call when no port hint is available', async () => {
    const { supabase } = mockSupabaseForPortCalls([
      {
        id: 'pc-only',
        port_canonical_id: 'port-jeju',
        arrival_at: '2026-05-22T09:00:00+09:00',
        pickup_locations: { canonical_name: 'Jeju International Cruise Terminal' },
      },
    ])
    const rows = [booking({ cruiseShipId: 'ship-1', cruiseShipText: 'Celebrity Millennium' })]

    await inferMissingCruiseDatesFromPortCalls(supabase, rows, emit, baseNow)

    expect(rows[0].tourDate).toBe('2026-05-22')
    expect(rows[0].cruisePortCallId).toBe('pc-only')
  })

  it('flags ambiguous repeated ship-and-port matches instead of guessing a date', async () => {
    const { supabase } = mockSupabaseForPortCalls([
      {
        id: 'pc-a',
        port_canonical_id: 'port-jeju',
        arrival_at: '2026-06-10T09:00:00+09:00',
        pickup_locations: { canonical_name: 'Jeju International Cruise Terminal' },
      },
      {
        id: 'pc-b',
        port_canonical_id: 'port-jeju',
        arrival_at: '2026-06-24T09:00:00+09:00',
        pickup_locations: { canonical_name: 'Jeju International Cruise Terminal' },
      },
    ])
    const rows = [
      booking({
        cruiseShipId: 'ship-1',
        cruiseShipText: 'Celebrity Millennium',
        pickupPointRaw: 'Port of Jeju',
      }),
    ]

    await inferMissingCruiseDatesFromPortCalls(supabase, rows, emit, baseNow)

    expect(rows[0].tourDate).toBeUndefined()
    expect(rows[0].cruisePortCallId).toBeUndefined()
    expect(rows[0].issues).toContain('cruise_port_call_date_ambiguous')
  })
})
