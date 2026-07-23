// OTA email ingest — Viator + KKday adapter parsing (CI guard, no LLM).
// Bodies are the post-envelope-strip form the funnel feeds the adapter.

import { stripEmailEnvelope } from '../email-envelope'
import { viatorAdapter } from '../adapters/viator'
import { kkdayAdapter } from '../adapters/kkday'

const VIATOR_EMAIL = `---- Forwarded Message ----
From: Viator <booking@t1.viator.com>
Date: 06/16/2026 18:23
To: shixh1004 <shixh1004@163.com>
Subject: Wed, Jun 17, 2026 (#BR-1411266577)에 대한 새로운 예약

예약 확인
(Return Assurance) Busan Small Group Cruise Shore Excursion에 대한 새로운 예약이 있습니다.
여행 날짜(Wed, Jun 17, 2026)가 다가오고 있습니다.

예약 세부 정보
예약 참조: BR-1411266577
여행자 인솔자 이름: Anna Martinez
여행자 이름: Anna Martinez, Passenger Two, Passenger Three, Passenger Four
여행자 수: 4 Adults
상품 코드: 458105P33
투어 등급: (Return Assurance) Busan Small Group Cruise Shore Excursion
투어 언어: English - Guide
위치: Busan, South Korea
기본 요금: KRW 355,600
만남의 장소 : Busan Port International Passenger Terminal 2, 206 Chungjang-daero, Jung-gu, Busan, South Korea
Disembarkation Time: 0700
Boarding Time: 1500
Departure Date: 06/17/26
Cruise Ship: Diamond princess
Pick up Location: Cruise terminal buson
특별 요구 사항: Diamond Princess 323-383-5476 WhatsApp
전화: (Alternate Phone)US+1 3238061098 고객에게 메시지를 전송합니다.
선택 사항: 기록을 위해 이 예약을 승인하십시오.

© 2026 Viator, Inc. All rights reserved.`

const KKDAY_EMAIL = `---- Forwarded Message ----
From: KKday <no-reply@kkday.cn>
Date: 06/16/2026 15:58
To: rrlagms2 <rrlagms2@gmail.com>
Subject: [KKday] 예약번호: 26KK274890422 주문이 접수되었습니다.

축하드립니다. 새로운 주문이 접수되었습니다.
예약번호: 26KK274890422
상품번호: 262390
상품명: (반일 보장) 크루즈 승객을 위한 부산 정통 한국 관광
패키지: 부산 크루즈 시티 투어 (단체 투어, 조인 투어)
사용 날짜: 2026/07/28
수량: 3명
대표 여행자: YANG, WILLIAM

모든 문의사항은 service@kkday.com로 문의해 주시기 바랍니다.`

describe('viatorAdapter — booking email', () => {
  const body = stripEmailEnvelope(VIATOR_EMAIL).text

  it('detects above threshold from BR-ref + Korean labels (no brand word needed)', () => {
    // Strip the footer brand word too — ref + labels alone must clear 0.8.
    const noBrand = body.replace(/Viator, Inc\./gi, '')
    expect(viatorAdapter.detect(noBrand)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts lead (not placeholder), party, cruise ship, and the right phone vs whatsapp', () => {
    const { bookings } = viatorAdapter.parse(body)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.leadName).toBe('Anna Martinez') // NOT "Passenger Two" / "예약 세부 정보"
    expect(b.partySize).toBe(4) // NOT 1 — "여행자 수: 4 Adults"
    expect(b.externalBookingId).toBe('BR-1411266577')
    expect(b.tourDate).toBe('2026-06-17')
    expect(b.pickupPointRaw).toMatch(/Busan Port International Passenger Terminal 2/)
    expect(b.pickupTime).toBe('07:00') // disembarkation
    expect(b.cruiseShipText).toBe('Diamond princess') // deterministic → no L3 enrichment
    expect(b.phone).toBe('+13238061098') // customer alternate phone
    expect(b.whatsapp).toBe('3233835476') // distinct from phone (was mis-picked by L2)
    expect(b.language).toBe('en')
  })
})

describe('kkdayAdapter — order email', () => {
  const body = stripEmailEnvelope(KKDAY_EMAIL).text

  it('detects above threshold', () => {
    expect(kkdayAdapter.detect(body)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts the sparse booking and leaves absent pickup/contact empty (no hallucination)', () => {
    const { bookings } = kkdayAdapter.parse(body)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.leadName).toBe('YANG, WILLIAM')
    expect(b.partySize).toBe(3)
    expect(b.externalBookingId).toBe('26KK274890422')
    expect(b.tourDate).toBe('2026-07-28')
    expect(b.productName).toMatch(/부산 정통 한국 관광/)
    expect(b.language).toBe('en') // comma name resolves
    expect(b.pickupPointRaw).toBeUndefined() // KKday body has no pickup — stays empty
    expect(b.phone).toBeUndefined()
  })
})
