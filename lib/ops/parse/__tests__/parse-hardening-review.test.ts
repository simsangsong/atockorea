// Regression tests for the parser-hardening review fixes (2026-06-04):
//   #2 inheritSectionDates / locateBookingOffset — no wrong-date on repeated names
//   #3 extractBookingId — loose label/bracket fallbacks require a digit (no phantom refs)
//   #5 clearJunkProductName — only wipes a real header row (strong header word), not a legit course name
import { inheritSectionDates, clearJunkProductName, isColumnHeaderRow } from '../section-header'
import { extractBookingId } from '../heuristics'
import type { ParsedBooking } from '@/lib/ops/parse/types'

function makeBooking(p: Partial<ParsedBooking>): ParsedBooking {
  return {
    sourcePlatform: 'manual', leadName: null, partySize: 1, productName: null, tourDate: null,
    pickupTime: null, pickupPointRaw: null, pickupPointNormalized: null, language: null,
    email: null, phone: null, whatsapp: null, externalBookingId: null, notes: null,
    cruiseShipId: null, cruisePortCallId: null, confidenceScore: 0.9, ...p,
  } as ParsedBooking
}

describe('#2 inheritSectionDates — repeated-name anchor safety', () => {
  const raw = [
    '===== 6/8 (월) 출발분 =====',
    '1. Bob 3명 010-3333-4444',
    '2. Sam 2명 010-1111-2222',
    '===== 6/9 (화) 출발분 =====',
    '3. Carol 1명 010-5555-6666',
    '4. Sam 2명 010-8888-9999',
  ].join('\n')
  const now = new Date('2026-06-01T00:00:00Z')

  it('inherits by unique name and by FORMATTED phone (digit-stripped line match)', () => {
    const bob = makeBooking({ leadName: 'Bob', phone: '010-3333-4444' })
    const carol = makeBooking({ leadName: 'Carol', phone: '010-5555-6666' })
    inheritSectionDates(raw, [bob, carol], now)
    expect(bob.tourDate).toBe('2026-06-08')
    expect(carol.tourDate).toBe('2026-06-09') // located by phone even though raw is formatted
  })

  it('does NOT guess a date for a repeated name with no phone (wrong date is worse than none)', () => {
    const samNoPhone = makeBooking({ leadName: 'Sam' }) // appears under BOTH dividers
    inheritSectionDates(raw, [samNoPhone], now)
    expect(samNoPhone.tourDate).toBeNull()
  })

  it('a repeated name WITH a phone is disambiguated to the correct divider', () => {
    const sam9 = makeBooking({ leadName: 'Sam', phone: '010-8888-9999' })
    inheritSectionDates(raw, [sam9], now)
    expect(sam9.tourDate).toBe('2026-06-09')
  })
})

describe('#3 extractBookingId — loose fallbacks require a digit', () => {
  it('rejects plain words captured after a "booking"/bracket label', () => {
    expect(extractBookingId('Booking note: special meal')).toBeUndefined()
    expect(extractBookingId('booking confirmed today')).toBeUndefined()
    expect(extractBookingId('[Note] meet at lobby')).toBeUndefined()
    expect(extractBookingId('[Info]')).toBeUndefined()
  })
  it('still captures real refs (which contain digits)', () => {
    expect(extractBookingId('예약# AT0603R3N026')).toBe('AT0603R3N026')
    expect(extractBookingId('[AT0603R3N026]')).toBe('AT0603R3N026')
    expect(extractBookingId('voucher: BR-1279360183')).toBe('BR-1279360183')
    expect(extractBookingId('booking ref 25KK229300245')).toBe('25KK229300245')
    expect(extractBookingId('GYG99697LZBH 확정')).toBe('GYG99697LZBH')
  })
})

describe('#5 clearJunkProductName — preserves legit comma course names', () => {
  it('does NOT wipe a comma-listed course name that lacks a strong header word', () => {
    const b = makeBooking({ productName: '데이 투어, 포토 투어, 나이트 투어' })
    expect(isColumnHeaderRow(b.productName!)).toBe(true) // matches the shape…
    expect(clearJunkProductName(b)).toBe(false) // …but is NOT cleared (no header-only word)
    expect(b.productName).toBe('데이 투어, 포토 투어, 나이트 투어')
  })
  it('wipes an actual column-header row absorbed into productName', () => {
    const b = makeBooking({ productName: '구분, 예약번호, 인원, 연락처' })
    expect(clearJunkProductName(b)).toBe(true)
    expect(b.productName).toBeUndefined()
  })
})
