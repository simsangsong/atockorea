// Klook **주문확정 이메일** 어댑터 (인박스 자동수집용, plan §3 A-5 L1).
//
// 기존 klook.ts와 다른 물건이다: 그쪽은 운영자가 붙여넣는 한국어 명단
// ("4번. 서남쪽 - 호텔 / 이름 (인원수 x 3 명) - 클룩 - QPA302488") 형식이고,
// 이건 Klook이 파트너에게 보내는 order-confirmed 메일 템플릿이다.
//
// 왜 필요한가 (2026-07-25 라이브 실측, ops_email_parse_logs):
// 전용 어댑터가 없어서 L1 klook(명단용)이 부분 매칭한 뒤 L3(Haiku)가 본문을
// 재분할했고, 결과가 이랬다 —
//   ① 메일 1통 → 예약 2건. 같은 예약번호로 upsert가 두 번 일어나 뒤엣것이
//      앞엣것을 덮어쓰고 **픽업 지점이 유실**된다(조인투어 당일 사고 직결).
//   ② "Package:" 라벨 줄을 이름으로 잡아 lead_name이 "Package: J."
//   ③ **"Participant: 2 x Person"을 1명으로 읽었다** — 좌석 배분이 틀어진다.
// 템플릿이 완전히 결정론적이므로 LLM 없이 정확히 뽑는 게 맞다.
//
// "Extra Details" 블록은 두 번째 예약이 아니라 **동반 연락처**다 (실제 메일에서
// 예약자 Alejandra와 다른 사람 Miguel이 들어 있었다). notes에 보존한다.

import type { PlatformAdapter, AdapterResult } from './types'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { inferLanguage } from '../heuristics'

const REF_RE = /Booking reference ID:\s*([A-Z0-9]{6,20})/i
const PACKAGE_RE = /^\s*Package:\s*(.+?)\s*$/im
const DATE_RE = /Date Request:\s*(\d{4}-\d{2}-\d{2})/i
const TIME_RE = /Time Request:\s*(\d{1,2}:\d{2})/i
// "Lead participant: ()Alejandra Samara Tenorio Arellano"
// 여권 국가란이 비면 Klook이 "()"를 그대로 남긴다 — 이름 앞에서 걷어낸다.
const LEAD_RE = /Lead participant:\s*(?:\([^)]*\))?\s*(.+?)\s*$/im
const LEAD_EMAIL_RE = /Lead person email:\s*([^\s<>]+@[^\s<>]+)/i
const LEAD_PHONE_RE = /Lead person mobile:\s*([+\d][\d\s\-()]{5,})/i
const PARTY_RE = /Participant:\s*(\d{1,2})\s*x\s*(?:Person|People|pax)/i
const PICKUP_RE = /Departure location:\s*(.+?)\s*$/im
const EXTRA_FIRST_RE = /^\s*First name:\s*(.+?)\s*$/im
const EXTRA_LAST_RE = /^\s*Last name:\s*(.+?)\s*$/im
const EXTRA_PHONE_RE = /^\s*Phone number:\s*([+\d][\d\s\-()]{5,})\s*$/im
const EXTRA_EMAIL_RE = /^\s*Email:\s*([^\s<>]+@[^\s<>]+)\s*$/im
// ⚠ `\s*`를 쓰면 개행을 넘어가 다음 줄("Departure location: …")을 삼킨다.
// Klook은 특이사항이 없으면 라벨만 남기고 줄을 비우므로 가로 공백만 허용한다.
const SPECIAL_RE = /Special requirements:[^\S\n]*(\S.*?)[^\S\n]*$/im

const KLOOK_EMAIL_MARKERS = [
  /Klook has confirmed an order/i,
  /Booking reference ID:/i,
  /merchant@klook\.com/i,
]

/** 트래킹 링크·이미지 자리표시자를 걷어내 라벨 매칭을 방해하지 않게 한다. */
function clean(raw: string): string {
  return raw
    .replace(/<https?:\/\/[^>]*>/g, ' ')
    .replace(/\[image:[^\]]*\]/gi, ' ')
    .replace(/\r\n/g, '\n')
}

function firstMatch(re: RegExp, text: string): string | undefined {
  const m = text.match(re)
  return m?.[1]?.trim() || undefined
}

export const klookEmailAdapter: PlatformAdapter = {
  id: 'klook-email',
  label: 'Klook 주문확정 메일',

  detect(raw: string): number {
    const text = clean(raw).slice(0, 6000)
    let score = 0
    for (const marker of KLOOK_EMAIL_MARKERS) if (marker.test(text)) score += 0.34
    // 라벨 골격이 있어야 이 템플릿이다 — "klook" 단어만으로는 올라가지 않는다.
    if (PARTY_RE.test(text) && DATE_RE.test(text)) score += 0.2
    return Math.min(1, score)
  },

  parse(raw: string): AdapterResult {
    const text = clean(raw)

    const externalBookingId = firstMatch(REF_RE, text)
    const tourDate = firstMatch(DATE_RE, text)
    const leadName = firstMatch(LEAD_RE, text)
    if (!externalBookingId || !tourDate || !leadName) {
      return { bookings: [], leftover: [raw] }
    }

    const partyRaw = firstMatch(PARTY_RE, text)
    const partySize = partyRaw ? Math.max(1, Math.min(40, parseInt(partyRaw, 10))) : 1

    const email = firstMatch(LEAD_EMAIL_RE, text)
    const phone = firstMatch(LEAD_PHONE_RE, text)
    const pickup = firstMatch(PICKUP_RE, text)
    const pickupTime = firstMatch(TIME_RE, text)
    const productName = firstMatch(PACKAGE_RE, text)
    const special = firstMatch(SPECIAL_RE, text)

    // Extra Details = 동반 연락처. 별도 예약으로 쪼개지 않고 notes에 보존한다.
    const extraName = [firstMatch(EXTRA_FIRST_RE, text), firstMatch(EXTRA_LAST_RE, text)]
      .filter(Boolean)
      .join(' ')
      .trim()
    const extraPhone = firstMatch(EXTRA_PHONE_RE, text)
    const extraEmail = firstMatch(EXTRA_EMAIL_RE, text)
    const notes = [
      special,
      extraName ? `추가 연락처: ${extraName}${extraPhone ? ` / ${extraPhone}` : ''}${extraEmail ? ` / ${extraEmail}` : ''}` : '',
    ]
      .filter(Boolean)
      .join(' | ')

    const issues: string[] = []
    if (!email) issues.push('missing_contact')
    if (!phone) issues.push('missing_phone')
    if (!pickup) issues.push('missing_pickup')
    if (!partyRaw) issues.push('missing_party_size')

    const booking: ParsedBooking = {
      sourcePlatform: 'klook',
      sourcePlatformLabel: 'Klook',
      externalBookingId,
      leadName,
      partySize,
      tourDate,
      productName,
      pickupPointRaw: pickup,
      pickupTime,
      email,
      phone,
      language: inferLanguage(phone, leadName),
      notes: notes || undefined,
      // 라벨 기반 결정론 추출 — 필수 4필드가 모두 잡혔을 때만 여기 도달한다.
      confidenceScore: issues.length === 0 ? 1 : 0.9,
      issues,
    }

    return { bookings: [booking], leftover: [] }
  },
}
