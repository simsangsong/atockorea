// OTA email ingest — training batch 2026-06-23 (operator screenshots).
// Three forwarded booking emails transcribed faithfully into the forwarded-text
// form the ingestion pipeline receives:
//   1. Viator cruise shore excursion — Busan (Caroline Williams, 2 pax)
//   2. Viator cruise shore excursion — Jeju  (Mark Barakat, 12 pax)
//   3. GetYourGuide cruise group tour  — Busan (Dianne Crews, 2 pax)
//
// NEW vs the 2026-06-21 batch: these Viator emails use the label "여행 인솔자
// 이름" (no 자) and "여행자: N Adults" (no 수) — both drifted from the labels the
// adapter was first written against. Deterministic (no DB / no LLM): strips the
// forward envelope, then asserts adapter detection + full field extraction.

import { stripEmailEnvelope } from '../email-envelope'
import { viatorAdapter } from '../adapters/viator'
import { getYourGuideAdapter } from '../adapters/getyourguide'

const VIATOR_BUSAN = `-------- Forwarding messages --------
From: "Viator" <booking@t1.viator.com>
Date: 2026-06-18 09:12:09
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Mon, Jun 14, 2027 (#BR-1412474515)에 대한 새로운 예약

예약 확인
(Guaranteed Return) Busan Shore Excursion for Cruise Guests에 대한 새로운 예약이 있습니다. 이는 즉시 확인 예약이므로 어떤 조치도 취하실 필요가 없습니다.
자세한 내용은 아래를 참조하시거나 대시보드를 방문하여 모든 예약을 관리하십시오.

예약 세부 정보
예약 참조: BR-1412474515
투어 이름: (Guaranteed Return) Busan Shore Excursion for Cruise Guests
여행 날짜: Mon, Jun 14, 2027
여행 인솔자 이름: Caroline Williams
여행자 이름: Caroline Williams, Passenger Two
여행자: 2 Adults
상품 코드: 458105P21
투어 등급 코드: TG1
투어 등급 설명: (Guaranteed Return) Busan Shore Excursion for Cruise Guests
투어 언어: English - Guide
위치: Busan, South Korea
기본 요금: KRW 143,080
만남의 장소: Busan Port International Passenger Terminal 2, 206 Chungjang-daero, Jung-gu, Busan, South Korea
Cruise Ship: Celebrity Millenium
Boarding Time: Don't know yet
Departure Date: 14/06/2027
Drop Off Location: Cruise terminal
Pick up Location: Cruise terminal
Disembarkation Time: Do not know yet
특별 요구 사항: No
전화: (Alternate Phone)GB+44 07730193981 고객에게 메시지를 전송합니다.
선택 사항: 기록을 위해 이 예약을 승인하십시오.

질문이 있거나 도움이 필요하십니까?
도움말 센터로 이동하여 자세한 내용을 확인하실 수 있습니다.`

const VIATOR_JEJU = `-------- Forwarding messages --------
From: "Viator" <booking@t1.viator.com>
Date: 2026-06-18 09:14:55
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Wed, Oct 21, 2026 (#BR-1413157347)에 대한 새로운 예약

예약 확인
(Guaranteed Return) Jeju Authentic Shore Excursion Cruise에 대한 새로운 예약이 있습니다. 이는 즉시 확인 예약이므로 어떤 조치도 취하실 필요가 없습니다.

예약 세부 정보
예약 참조: BR-1413157347
투어 이름: (Guaranteed Return) Jeju Authentic Shore Excursion Cruise
여행 날짜: Wed, Oct 21, 2026
여행 인솔자 이름: Mark Barakat
여행자 이름: Mark Barakat, Passenger Two, Passenger Three, Passenger Four, Passenger Five, Passenger Six, Passenger Seven, Passenger Eight, Passenger Nine, Passenger Ten, Passenger Eleven, Passenger Twelve
여행자: 12 Adults
상품 코드: 458105P15
투어 등급: [Join-in] Jeju UNESCO Tour 10:00
투어 등급 코드: TG1~10:00
투어 등급 설명: [Join-in] Jeju UNESCO Tour
투어 언어: English - Guide
위치: Jeju-si, South Korea
기본 요금: KRW 739,200
만남의 장소: Seogwipo Gangjeong Cruise Terminal, Gangjeong-dong, Seogwipo-si, Jeju-do, South Korea
Cruise Ship: Navigator of the Seas Royal Caribbean
Drop Off Location: Cruise ship
Disembarkation Time: 8 am
특별 요구 사항: 5 kids, 8 adults
전화: (Alternate Phone)US+1 2145020045 고객에게 메시지를 전송합니다.
선택 사항: 기록을 위해 이 예약을 승인하십시오.`

const GYG_BUSAN = `-------- Forwarding messages --------
From: "GetYourGuide" <do-not-reply@notification.getyourguide.com>
Date: 2026-06-20 18:12:38
To: "Heun Kim" <rrlagms2@gmail.com>,
  "Jisu Lee" <lovekoreajs@gmail.com>,
  "AN JUNG" <anjongking@naver.com>,
  "Xiaohua Shi" <shixh1004@163.com>,
  "lovekorea Dev" <lovekoreadv@gmail.com>
Subject: Booking - S372829 - GYG83XF36F4F

Hi Supply Partner, great news!
Your offer has been booked:

(Guaranteed Return) Busan Shore Excursion for Cruise Guests
Group Tour for Busan Cruise Guests (Van or Bus)
Reference number: GYG83XF36F4F
Date: July 5, 2026 8:00 AM
Number of participants: 2 x Adults (Age 0 - 99)
Main customer: Dianne Crews
customer-sltl55g3hq7p43rt@reply.getyourguide.com
Phone: +14035960144
Language: English
Tour language: English (Live tour guide)
Price: ₩165,120

We're here to help
If you have any questions, you can contact our team or learn more in our help center.`

describe('Viator cruise email — Busan (2026-06-23 batch)', () => {
  const { stripped, text } = stripEmailEnvelope(VIATOR_BUSAN)

  it('strips the forward envelope', () => {
    expect(stripped).toBe(true)
    expect(text).toMatch(/^예약 확인/m)
    expect(text).not.toContain('booking@t1.viator.com')
  })

  it('detects Viator above threshold', () => {
    expect(viatorAdapter.detect(text)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts every field', () => {
    const { bookings } = viatorAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('BR-1412474515')
    expect(b.leadName).toBe('Caroline Williams')
    expect(b.partySize).toBe(2)
    expect(b.tourDate).toBe('2027-06-14')
    expect(b.cruiseShipText).toBe('Celebrity Millenium')
    expect(b.pickupPointRaw).toMatch(/Busan Port International Passenger Terminal 2/)
    expect(b.language).toBe('en')
    expect(b.phone?.replace(/\D/g, '')).toContain('7730193981')
    expect(b.productName).toMatch(/Busan Shore Excursion/)
  })
})

describe('Viator cruise email — Jeju (2026-06-23 batch)', () => {
  const { text } = stripEmailEnvelope(VIATOR_JEJU)

  it('detects Viator above threshold', () => {
    expect(viatorAdapter.detect(text)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts every field (12 pax, lead from 여행 인솔자)', () => {
    const { bookings } = viatorAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('BR-1413157347')
    expect(b.leadName).toBe('Mark Barakat')
    expect(b.partySize).toBe(12)
    expect(b.tourDate).toBe('2026-10-21')
    expect(b.cruiseShipText).toBe('Navigator of the Seas Royal Caribbean')
    expect(b.pickupPointRaw).toMatch(/Seogwipo Gangjeong Cruise Terminal/)
    expect(b.pickupTime).toBe('10:00') // from the join-in grade "[Join-in] … Tour 10:00"
    expect(b.language).toBe('en')
    expect(b.phone?.replace(/\D/g, '')).toContain('2145020045')
  })
})

describe('GetYourGuide cruise email — Busan (2026-06-23 batch)', () => {
  const { text } = stripEmailEnvelope(GYG_BUSAN)

  it('detects GYG above threshold', () => {
    expect(getYourGuideAdapter.detect(text)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts every field', () => {
    const { bookings } = getYourGuideAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('GYG83XF36F4F')
    expect(b.leadName).toBe('Dianne Crews')
    expect(b.partySize).toBe(2)
    expect(b.tourDate).toBe('2026-07-05')
    expect(b.pickupTime).toBe('08:00')
    expect(b.phone).toBe('+14035960144')
    expect(b.language).toBe('en')
    expect(b.productName).toMatch(/Busan Shore Excursion/)
  })
})
