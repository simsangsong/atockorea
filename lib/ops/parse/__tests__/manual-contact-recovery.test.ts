import { heuristicExtract } from '../heuristics'

function first(raw: string) {
  return heuristicExtract(raw).bookings[0]
}

describe('manual roster contact and pickup recovery', () => {
  it('rebuilds proxy emails split across clipboard line breaks', () => {
    const b = first([
      '제주 크루즈 스몰그룹',
      'Lesley Example 2명',
      'customer-',
      'abc123@reply.get',
      'yourguide.com',
      'Phone: +61419705357',
    ].join('\n'))

    expect(b).toBeDefined()
    expect(b.email).toBe('customer-abc123@reply.getyourguide.com')
    expect(b.phone).toBe('+61419705357')
  })

  it('keeps short Korean pickup aliases instead of marking pickup missing', () => {
    const b = first([
      '서남쪽 - 신라',
      'Mitat Example (2명) - 에어비엔비',
      '+90 537 919 21 56',
    ].join('\n'))

    expect(b).toBeDefined()
    expect(b.pickupPointRaw).toBe('신라')
    expect(b.issues).not.toContain('missing_pickup')
  })

  it('uses the previous line as the name when the pax line is only a pickup alias', () => {
    const b = first([
      'Michaela Example',
      '어반 1명',
      'michaela@example.com',
      'Phone number',
      '971-545666969',
    ].join('\n'))

    expect(b).toBeDefined()
    expect(b.leadName).toBe('Michaela Example')
    expect(b.partySize).toBe(1)
    expect(b.pickupPointRaw).toBe('어반')
  })

  it('strips chat export timestamps and parses inline short pickup aliases', () => {
    const b = first([
      '[오후 10:12, 2026. 5. 26.] 심상송: 확인요',
      '[오후 10:24, 2026. 5. 26.] 김기대형님: 제주 서남쪽 WXC415862',
      'Valerie Say Martinez 오션 1명',
      'Email',
      'valeriesay@gmail.com',
      'Phone number 82-01096605447',
    ].join('\n'))

    expect(b).toBeDefined()
    expect(b.externalBookingId).toBe('WXC415862')
    expect(b.leadName).toBe('Valerie Say Martinez')
    expect(b.partySize).toBe(1)
    expect(b.pickupPointRaw).toBe('오션')
    expect(b.pickupTime).toBeUndefined()
    expect(b.email).toBe('valeriesay@gmail.com')
    expect(b.phone).toBe('8201096605447')
    expect(b.issues).not.toContain('missing_pickup')
  })

  it('splits compressed course-pickup-name rows without polluting the lead name', () => {
    const b = first([
      '서남쪽 - Ocean Suites Jeju Hotel Alex Guest(2人) - JFY203760',
      'English',
      'alex@example.com',
      '1-5593755901',
      'WhatsApp: 5593755901',
    ].join('\n'))

    expect(b).toBeDefined()
    expect(b.leadName).toBe('Alex Guest')
    expect(b.pickupPointRaw).toBe('Ocean Suites Jeju Hotel')
  })
})
