// Phase 0-bis — L2 operator-curated multi-line fallback in heuristicExtract.
//
// These blocks share a first-line shape:
//   "<name> [optional Hangul region] <N>명 [optional Hangul region]"
// followed by 1+ lines of phone/email/country/cruise notes.
//
// They sit below the 0.85 confidence floor in parseBlock (no ref, no date,
// no labeled pickup) — handled by parseOperatorMultiLine as a fallback.
//
// Source: bulk-jeju-v3 leftover analysis (KakaoTalk export).

import { heuristicExtract } from '../heuristics'

describe('parseOperatorMultiLine — Format C (전화번호/크루즈선/하선 시간 labels)', () => {
  it('extracts Victoria Magbutay with trailing region', () => {
    const block = [
      'Victoria Magbutay 2명 제주항',
      '전화번호: +1 619-925-5028',
      '크루즈선: Norwegian Spirit',
      '하선 시간: 1200 Arrival',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('Victoria Magbutay')
    expect(b.partySize).toBe(2)
    expect(b.phone).toContain('619')
    expect(b.notes).toContain('Norwegian Spirit')
    expect(b.externalBookingId).toMatch(/^MANUAL-OP-/)
  })

  it('extracts Linda Fung (no trailing region)', () => {
    const block = [
      'Linda Fung 4명',
      '전화번호: +1 510-240-0574',
      '크루즈선: Norwegian Spirit',
      '하선 시간: 1200 Arrival',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Linda Fung')
    expect(r.bookings[0].partySize).toBe(4)
  })

  it('extracts Luis F Silva with multi-token name and parenthesized country code phone', () => {
    const block = [
      'Luis F Silva 2명',
      '전화번호: (+1-939) 9397172466',
      '크루즈선: Norwegian Spirit',
      '하선 시간: 1200 Arrival',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Luis F Silva')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].phone).toBeDefined()
  })
})

describe('parseOperatorMultiLine — Format D (Country line + email)', () => {
  it('extracts wolfgang roscher with mid-line region (강정)', () => {
    const block = [
      'wolfgang roscher 강정 3명',
      '(Germany)',
      '+491783742884',
      'customer-5j4itnvistoekqiw@reply.getyourguide.com',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('wolfgang roscher')
    expect(b.partySize).toBe(3)
    expect(b.email).toContain('@reply.getyourguide.com')
    expect(b.sourcePlatform).toBe('gyg')
    expect(b.notes).toContain('country=Germany')
  })

  it('extracts Tessa Merrett with mid-line region (제주항)', () => {
    const block = [
      'Tessa Merrett 제주항 2명',
      '(United Kingdom)',
      '+447929369513',
      'customer-dwxux4hl6tgwvf23@reply.getyourguide.com',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Tessa Merrett')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].notes).toContain('country=United Kingdom')
  })

  it('extracts Marcella Salem with hotel-shorthand region (오션)', () => {
    const block = [
      'Marcella Salem 오션 1명',
      '(United States)',
      '+17132945236',
      'customer-ma6g73adv3unawfy@reply.getyourguide.com',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Marcella Salem')
    expect(r.bookings[0].partySize).toBe(1)
  })

  it('extracts Khera single-token name with hotel-shorthand region (롯데)', () => {
    const block = [
      'Khera 롯데 1명',
      '(United Kingdom)',
      '+447875090464',
      'customer-ilc4o434a4alpj6a@reply.getyourguide.com',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Khera')
    expect(r.bookings[0].partySize).toBe(1)
  })
})

describe('parseOperatorMultiLine — Format E (bare phone + email)', () => {
  it('extracts QIU YUYU with mid-line region', () => {
    const block = [
      'QIU YUYU 신라 2명',
      '+886 0973273567',
      'angel94060@gmail.com',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('QIU YUYU')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].email).toBe('angel94060@gmail.com')
  })

  it('extracts Zhuang wei Ting with mid-line region (롯데)', () => {
    const block = [
      'Zhuang wei Ting 롯데 4명',
      '+886 935050267',
      'weiting199310@gmail.com',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Zhuang wei Ting')
    expect(r.bookings[0].partySize).toBe(4)
  })

  it('extracts Malcolm Oxley with only labeled phone (no email)', () => {
    const block = [
      'Malcolm Oxley 1명',
      '전화번호: +64 210 261 0437',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Malcolm Oxley')
    expect(r.bookings[0].partySize).toBe(1)
    expect(r.bookings[0].phone).toContain('64')
  })

  it('extracts Wendy Yohanes (Indonesian-style Latin name + label phone)', () => {
    const block = [
      'Wendy Yohanes 2명',
      '전화번호: +61 434 262 402',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Wendy Yohanes')
    expect(r.bookings[0].partySize).toBe(2)
  })
})

describe('parseOperatorMultiLine — negative cases (do not over-match)', () => {
  it('does not match a bare section header', () => {
    const r = heuristicExtract('남쪽\n\n서남쪽\n\n프라이빗')
    expect(r.bookings).toHaveLength(0)
  })

  it('does not match a date header', () => {
    const r = heuristicExtract('4월6일 크루즈 예약\n\n241116 고객명단')
    expect(r.bookings).toHaveLength(0)
  })

  it('does not match "부산항 6명" header (no contact, no second line)', () => {
    const r = heuristicExtract('부산항 6명')
    expect(r.bookings).toHaveLength(0)
  })

  it('does not match "부산항 6명" even with extra blank lines', () => {
    const r = heuristicExtract('부산항 6명\n\n다른블록')
    expect(r.bookings).toHaveLength(0)
  })

  it('does not match a first-line "N명" without contact in the block', () => {
    const block = [
      'James Smith 3명',
      '체크인 미정',
      '미배정',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(0)
  })

  it('does not match a KakaoTalk message header line', () => {
    const block = [
      '[2025. 4. 13. 오후 12:27] 안정 형: 제주 벚꽃 프라이빗 – 영어 심상송 배정',
      '+82 10 0000 0000',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(0)
  })
})

describe('parseOperatorMultiLine — does not interfere with existing parseBlock path', () => {
  it('still extracts a labeled GYG block via the primary parseBlock path (not fallback)', () => {
    const block = [
      'Lead: Sarah Connor',
      'Pax: 4',
      'Pickup: Ocean Suites Jeju',
      'Phone: +1 555 1234567',
      'Email: sarah@example.com',
      'GYG48ZGBXMM3',
    ].join('\n')
    const r = heuristicExtract(block)
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Sarah Connor')
    // External booking id must come from the GYG- token, not from MANUAL-OP-.
    expect(r.bookings[0].externalBookingId).toBe('GYG48ZGBXMM3')
  })
})
