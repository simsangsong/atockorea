// Phase 2 — 명단 그룹핑 로직 (plan §3.2). Pure, network 0.

import {
  groupBookingsByPickup,
  manifestTotals,
  extractHighlights,
  normalizePickupKey,
  UNASSIGNED_GROUP_KEY,
  type ManifestBooking,
} from '../group'

function booking(overrides: Partial<ManifestBooking> = {}): ManifestBooking {
  return {
    id: `b-${Math.random().toString(36).slice(2, 8)}`,
    contactName: 'Guest',
    contactPhone: '+82 10 1234 5678',
    contactEmail: null,
    partySize: 2,
    preferredLanguage: 'en',
    status: 'confirmed',
    source: 'klook',
    externalBookingId: null,
    pickupName: 'Lotte Hotel Jeju',
    pickupTime: '08:30',
    specialRequests: null,
    ...overrides,
  }
}

describe('normalizePickupKey', () => {
  it('unifies spacing/case/punctuation variants (canonical-lite)', () => {
    expect(normalizePickupKey('Lotte Hotel Jeju')).toBe(normalizePickupKey('lotte  hotel-jeju'))
    expect(normalizePickupKey('Jeju Airport, Gate 3')).toBe(normalizePickupKey('jeju airport gate 3'))
  })

  it('maps empty to the unassigned key', () => {
    expect(normalizePickupKey(null)).toBe(UNASSIGNED_GROUP_KEY)
    expect(normalizePickupKey('  ')).toBe(UNASSIGNED_GROUP_KEY)
  })
})

describe('groupBookingsByPickup', () => {
  it('groups spelling variants of the same pickup and counts teams/pax', () => {
    const groups = groupBookingsByPickup([
      booking({ contactName: 'Bora', pickupName: 'Lotte Hotel Jeju', partySize: 2 }),
      booking({ contactName: 'Anna', pickupName: 'lotte hotel-jeju', partySize: 3 }),
      booking({ contactName: 'Chan', pickupName: 'Jeju Airport Gate 3', pickupTime: '08:45', partySize: 1 }),
    ])
    expect(groups).toHaveLength(2)
    const lotte = groups[0]
    expect(lotte.displayName).toBe('Lotte Hotel Jeju')
    expect(lotte.teamCount).toBe(2)
    expect(lotte.paxCount).toBe(5)
    // 그룹 내부는 이름 알파벳순
    expect(lotte.bookings.map((b) => b.contactName)).toEqual(['Anna', 'Bora'])
  })

  it('sorts groups by earliest pickup time, unassigned last', () => {
    const groups = groupBookingsByPickup([
      booking({ pickupName: null, pickupTime: null }),
      booking({ pickupName: 'Shin Jeju Rotary', pickupTime: '08:55' }),
      booking({ pickupName: 'Airport', pickupTime: '08:10' }),
    ])
    expect(groups.map((g) => g.key === UNASSIGNED_GROUP_KEY ? 'unassigned' : g.displayName)).toEqual([
      'Airport',
      'Shin Jeju Rotary',
      'unassigned',
    ])
    expect(groups[0].firstPickupTime).toBe('08:10')
    expect(groups[2].displayName).toBe('픽업 미지정')
  })

  it('keeps the earliest time when a group has several pickups', () => {
    const groups = groupBookingsByPickup([
      booking({ pickupName: 'Lotte', pickupTime: '08:40' }),
      booking({ pickupName: 'Lotte', pickupTime: '08:20' }),
    ])
    expect(groups[0].firstPickupTime).toBe('08:20')
  })
})

describe('extractHighlights', () => {
  it('flags allergy / dietary / mobility / infant keywords', () => {
    expect(extractHighlights('Peanut allergy, vegetarian')).toEqual(['allergy', 'dietary'])
    expect(extractHighlights('휠체어 이용, 유아 동반')).toEqual(['mobility', 'infant'])
    expect(extractHighlights('No pork please')).toEqual(['dietary'])
    expect(extractHighlights(null)).toEqual([])
    expect(extractHighlights('window seat please')).toEqual([])
  })
})

describe('manifestTotals', () => {
  it('counts pax and wa contact state', () => {
    const totals = manifestTotals([
      booking({ partySize: 2, waMarkedSentAt: '2026-08-16T09:00:00Z' }),
      booking({ partySize: 3 }),
      booking({ partySize: 0 }), // 0/누락 인원은 1로 보정
    ])
    expect(totals.teams).toBe(3)
    expect(totals.pax).toBe(6)
    expect(totals.contacted).toBe(1)
    expect(totals.uncontacted).toBe(2)
  })
})
