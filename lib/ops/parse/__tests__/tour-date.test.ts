import type { ParsedBooking } from '@/lib/ops/parse/types'
import { applyBusTourDateDefaults, isCruiseTourBooking, kstDateFromIso, kstDateOffset } from '../tour-date'

function booking(overrides: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'TEST-1',
    leadName: 'Test Lead',
    partySize: 2,
    confidenceScore: 0.92,
    issues: [],
    ...overrides,
  }
}

describe('tour date inference policy', () => {
  it('calculates calendar dates in Asia/Seoul', () => {
    const now = new Date('2026-05-20T15:10:00.000Z') // 2026-05-21 00:10 KST
    expect(kstDateOffset(0, now)).toBe('2026-05-21')
    expect(kstDateOffset(1, now)).toBe('2026-05-22')
    expect(kstDateFromIso('2026-05-21T23:30:00+09:00')).toBe('2026-05-21')
  })

  it('defaults undated non-cruise bookings to the next KST day', () => {
    const rows = [
      booking({ productName: 'South tour' }),
      booking({ productName: 'East tour', tourDate: '2026-06-01' }),
      booking({ productName: 'Jeju Cruise Small Group', cruiseShipText: 'Celebrity Millennium' }),
    ]

    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    const applied = applyBusTourDateDefaults(
      rows,
      e => events.push(e),
      new Date('2026-05-20T15:10:00.000Z'),
    )

    expect(applied).toBe(1)
    expect(rows[0].tourDate).toBe('2026-05-22')
    expect(rows[1].tourDate).toBe('2026-06-01')
    expect(rows[2].tourDate).toBeUndefined()
    expect(events[0]).toMatchObject({
      event: 'tour_date_default_done',
      data: { applied: 1, defaultDate: '2026-05-22' },
    })
  })

  it('recognizes cruise rows before defaulting bus-tour dates', () => {
    expect(isCruiseTourBooking(booking({ productName: 'Jeju Cruise Small Group' }))).toBe(true)
    expect(isCruiseTourBooking(booking({ pickupPointRaw: 'Seogwipo Gangjeong Cruise Terminal' }))).toBe(true)
    expect(isCruiseTourBooking(booking({ productName: 'South tour' }))).toBe(false)
  })
})
