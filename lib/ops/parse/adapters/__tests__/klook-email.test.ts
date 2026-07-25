import { klookEmailAdapter } from '../klook-email'
import { pickAdapter } from '../index'

/**
 * 골든 픽스처 — 2026-07-25 라이브 수신분(PGB730438)의 **구조를 그대로** 옮기되
 * 손님 PII는 전부 가공값으로 치환했다(실 고객 이름·이메일·전화는 리포에 넣지
 * 않는다). 링크/이미지 자리표시자, "()" 여권란, Extra Details 블록 등 오파싱을
 * 유발했던 요소는 원본과 동일하게 유지한다.
 */
const KLOOK_ORDER_EMAIL = `<https://click.klook.com/ls/click?upn=u001.ABCDEF-2Fxyz>
Hey there PARTNER NAME,

Klook has confirmed an order for Jeju Top Spots Full-Day Small Group Tour -
Jeju Top Spots Full-Day Small Group Tour and issued a voucher to the
participant. See order details below for your record.
Jeju Top Spots Full-Day Small Group Tour

Package:   Jeju Top Spots Full-Day Small Group Tour
Booking reference ID: PGB730438
Date Request: 2026-07-23
Time Request: 08:00
Lead participant: ()Ana Beatriz Fixture Sample
Country/region of passport:
Lead person email: lead.fixture@example.com
Lead person mobile: 52-5500000001
Participant: 2 x Person
Activity URL: https://www.klook.com/en-US/activity/224343
<https://click.klook.com/ls/click?upn=u001.GHIJKL-2Fabc>
Extra Details
Special requirements:
Departure location: Aeropuerto Internacional de Jeju
First name: Companion
Last name: Fixture
Phone number: +52-5500000002
Email: companion.fixture@example.com

If you have any questions, please contact us at merchant@klook.com. We
typically reply within 7 days, though response times may vary. Thank you
for your patience.
Cheers,
Klook Team

Email: merchant@klook.com`

describe('klookEmailAdapter — Klook order-confirmed email', () => {
  it('is the adapter the registry picks for this template', () => {
    expect(pickAdapter(KLOOK_ORDER_EMAIL)?.id).toBe('klook-email')
  })

  it('🔴 extracts ONE booking, not two (Extra Details is a companion, not a booking)', () => {
    // 라이브 회귀: L3가 Extra Details 블록을 별도 예약으로 쪼개 같은 예약번호로
    // 두 번 upsert 했고, 뒤엣것이 앞엣것을 덮으며 픽업이 유실됐다.
    const out = klookEmailAdapter.parse(KLOOK_ORDER_EMAIL)
    expect(out.bookings).toHaveLength(1)
    expect(out.leftover).toHaveLength(0)
  })

  it('🔴 reads "Participant: 2 x Person" as 2 (좌석 배분 직결)', () => {
    // 라이브 회귀: 1명으로 읽혀 조인투어 좌석이 한 자리만 잡혔다.
    expect(klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0].partySize).toBe(2)
  })

  it('🔴 does not take the "Package:" label line as the lead name', () => {
    // 라이브 회귀: lead_name이 "Package: J."로 저장됐다.
    const name = klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0].leadName
    expect(name).toBe('Ana Beatriz Fixture Sample')
    expect(name).not.toMatch(/package/i)
  })

  it('strips the empty "()" passport marker from the lead name', () => {
    expect(klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0].leadName).not.toContain('(')
  })

  it('keeps the pickup that the split had been dropping', () => {
    const b = klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0]
    expect(b.pickupPointRaw).toBe('Aeropuerto Internacional de Jeju')
    expect(b.pickupTime).toBe('08:00')
  })

  it('extracts the remaining core fields', () => {
    const b = klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0]
    expect(b.externalBookingId).toBe('PGB730438')
    expect(b.tourDate).toBe('2026-07-23')
    expect(b.productName).toBe('Jeju Top Spots Full-Day Small Group Tour')
    expect(b.email).toBe('lead.fixture@example.com')
    expect(b.phone).toBe('52-5500000001')
    expect(b.sourcePlatform).toBe('klook')
    expect(b.confidenceScore).toBeGreaterThanOrEqual(0.85)
    expect(b.issues).toEqual([])
  })

  it('preserves the companion contact in notes instead of inventing a booking', () => {
    const notes = klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0].notes ?? ''
    expect(notes).toContain('Companion Fixture')
    expect(notes).toContain('companion.fixture@example.com')
  })

  it('does not let an empty "Special requirements:" swallow the next line', () => {
    // 라이브 회귀: \s* 가 개행을 넘어 "Departure location: …"을 특이사항으로
    // 잡아 notes에 픽업이 중복 기재됐다.
    const notes = klookEmailAdapter.parse(KLOOK_ORDER_EMAIL).bookings[0].notes ?? ''
    expect(notes).not.toContain('Departure location')
  })

  it('still captures a real special requirement when one is present', () => {
    const withReq = KLOOK_ORDER_EMAIL.replace(
      'Special requirements:\n',
      'Special requirements: Vegetarian meal, wheelchair access\n',
    )
    expect(klookEmailAdapter.parse(withReq).bookings[0].notes).toContain('Vegetarian meal')
  })

  it('degrades to leftover (never throws) when the template is not this one', () => {
    for (const junk of ['', 'hello world', 'Klook order confirmed but no labels at all']) {
      const out = klookEmailAdapter.parse(junk)
      expect(out.bookings).toHaveLength(0)
      expect(out.leftover).toEqual([junk])
    }
  })

  it('does not claim the Korean operator-paste format (그건 klookAdapter 담당)', () => {
    // 명단 어댑터는 레퍼런스 2개 이상을 요구하므로 실제 명단처럼 두 블록을 준다.
    const roster = [
      '4번. 서남쪽 - LOTTE City Hotel Jeju',
      'Joy Park (인원수 x 2 명)  - 클룩 - SHG596977',
      'English',
      'joyjpark5@example.com',
      '',
      '6번. 동쪽 - [08:55] Lotte City Hotel Jeju',
      'Wong Mavis (2 명)  - 클룩 - TKY453520',
      'Chinese',
      'wongmavis@example.com',
    ].join('\n')
    expect(klookEmailAdapter.detect(roster)).toBeLessThan(0.8)
    // 이 어댑터가 명단을 가로채지 않는 것이 요점.
    // ⚠ 사전존재 quirk(이 변경과 무관, 손대지 않음): klookAdapter의
    // KLOOK_HEADER_RE = /\bklook|클룩\b/i 에서 `\b`는 한글 뒤에 성립하지 않아
    // "클룩"만 있는 순한글 명단은 0.5 가산을 못 받고 문턱(0.8)에 못 닿는다.
    // 그래서 여기서 pickAdapter는 null이다 — klookAdapter는 명단 테스트에서
    // parse()를 직접 호출하므로 지금까지 드러나지 않았다.
    expect(pickAdapter(roster)?.id).not.toBe('klook-email')
  })
})
