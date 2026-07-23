// OTA email ingest — training batch 2026-06-23 (C): a Viator PRIVATE CAR charter
// (not a cruise), a standard GYG Jeju tour with a real hotel pickup, and a KKday
// order whose quantity reads "대인 x3" (not "3명").
//
// Deterministic (no DB / no LLM): strip forward envelope → adapter detect + parse.

import { stripEmailEnvelope } from '../email-envelope'
import { viatorAdapter } from '../adapters/viator'
import { getYourGuideAdapter } from '../adapters/getyourguide'
import { kkdayAdapter } from '../adapters/kkday'

const VIATOR_PRIVATE_CAR = `-------- Forwarding messages --------
From: "Viator" <booking@t1.viator.com>
Date: 2026-06-21 11:02:40
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Thu, Apr 01, 2027 (#BR-1413732497)에 대한 새로운 예약

예약 확인
Jeju Island Popular Sightseeing Private Car Charter Tour 5/9hours에 대한 새로운 예약이 있습니다. 이는 즉석 확인 예약이므로 어떤 조치도 취하실 필요가 없습니다.

예약 세부 정보
예약 참조: BR-1413732497
투어 이름: Jeju Island Popular Sightseeing Private Car Charter Tour 5/9hours
여행 날짜: Thu, Apr 01, 2027
여행 인솔자 이름: Barbara Shimabuku
여행자 이름: Barbara Shimabuku,
여행자: 2 Adults
상품 코드: 458105P12
투어 등급: English/ Jeju Private Car [9H] 09:00
투어 등급 코드: TG1~09:00
투어 등급 설명: Jeju Private Car [9H] English: Jeju Private Car [9Hours] English<br/>Pickup included
투어 언어: English - Guide
위치: Cheju, South Korea
기본 요금: KRW 301,680.
호텔 픽업: My hotel is not yet booked:
특별 요구 사항: No
전화: (Alternate Phone)US+1 (808) 387-6295 고객에게 메시지를 전송합니다.
선택 사항: 기록을 위해 이 예약을 승인하십시오.`

const GYG_JEJU = `-------- Forwarding messages --------
From: "GetYourGuide" <do-not-reply@notification.getyourguide.com>
Date: 2026-06-21 11:30:08
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Booking - S372950 - GYGN6B35H55R

Hi Supply Partner, great news!
Your offer has been booked:

Jeju: East UNESCO Tour Seongsan, Haenyeo Show, Lava Tube
Reference number: GYGN6B35H55R
Date: October 10, 2026 8:30 AM
Number of participants: 2 x Adults (Age 0 - 99)
Main customer: Razvan Costa
customer-2d6tvl4pe3d7lbke@reply.getyourguide.com
Phone: +4542959151
Language: English
Tour language: English (Live tour guide)
Pickup: Ocean Suites Jeju Hotel, 74 Tapdonghaean-ro, Samdo 2(i)-dong, Cheju, Jeju-do, South Korea
Open in Google Maps
Price: ₩160,000`

const KKDAY = `-------- Forwarding messages --------
From: "KKday" <no-reply@kkday.cn>
Date: 2026-06-21 10:58:12
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: [KKday] 예약번호: 26KK279880815 주문이 접수되었습니다.

축하드립니다. 새로운 주문이 접수되었습니다.
예약번호 ： 26KK279880815
상품번호 ： 331797
상품명 ： 부산 출발 경주 유네스코 유적지 체험 투어
패키지 ： [함께 참여하세요] 경주 종일 레거시 투어
사용 날짜 ： 2026/07/21
수량 ： 대인 x3
대표 여행자 ： Sawada, Akane

예약하신 KKday회원에게 주문 확인 메일을 보냈습니다.
모든 문의사항은 service@kkday.com로 문의해 주시기 바랍니다.`

describe('Viator private-car email — Jeju (batch C)', () => {
  const { text } = stripEmailEnvelope(VIATOR_PRIVATE_CAR)

  it('detects Viator above threshold', () => {
    expect(viatorAdapter.detect(text)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts every field; keeps the (808) area code; no cruise ship', () => {
    const { bookings } = viatorAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('BR-1413732497')
    expect(b.leadName).toBe('Barbara Shimabuku')
    expect(b.partySize).toBe(2)
    expect(b.tourDate).toBe('2027-04-01')
    expect(b.pickupTime).toBe('09:00') // from the 투어 등급 "… 09:00"
    expect(b.phone?.replace(/\D/g, '')).toBe('18083876295') // (808) area code preserved
    expect(b.cruiseShipText).toBeUndefined() // private car, not a cruise
    // "호텔 픽업: My hotel is not yet booked:" is a placeholder → no pickup
    expect(b.pickupPointRaw).toBeUndefined()
    expect(b.language).toBe('en')
  })
})

describe('GYG Jeju email — real hotel pickup (batch C)', () => {
  const { text } = stripEmailEnvelope(GYG_JEJU)
  it('extracts every field incl. the hotel pickup', () => {
    const { bookings } = getYourGuideAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('GYGN6B35H55R')
    expect(b.leadName).toBe('Razvan Costa')
    expect(b.partySize).toBe(2)
    expect(b.tourDate).toBe('2026-10-10')
    expect(b.pickupTime).toBe('08:30')
    expect(b.pickupPointRaw).toMatch(/Ocean Suites Jeju Hotel/)
    expect(b.phone).toBe('+4542959151')
    expect(b.language).toBe('en')
  })
})

describe('KKday email — quantity "대인 x3" (batch C)', () => {
  const { text } = stripEmailEnvelope(KKDAY)

  it('detects KKday above threshold', () => {
    expect(kkdayAdapter.detect(text)).toBeGreaterThanOrEqual(0.8)
  })

  it('reads "대인 x3" as party size 3', () => {
    const { bookings } = kkdayAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('26KK279880815')
    expect(b.leadName).toBe('Sawada, Akane')
    expect(b.partySize).toBe(3)
    expect(b.tourDate).toBe('2026-07-21')
    expect(b.productName).toMatch(/경주 유네스코/)
    expect(b.language).toBe('en')
  })
})
