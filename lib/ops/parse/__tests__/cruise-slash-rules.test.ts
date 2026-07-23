// Phase 0-ter — Fixture tests for the slash-separated cruise format rules.
// These rules cover the dominant cruise-paste shape:
//   {PRODUCT} / {NAME} ( {PLATFORM} - {EXTID} ) / {LANG} / {N} 명 / ...trailing fields...
// And the private variant with `대` instead of `명`.
//
// The existing 74ee1941 / c203cdce rules require strict EMAIL+PHONE slot positions
// AND a specific ship-name alternation, so they only fire on the most fully-
// populated cruise rows. These two rules handle the leaner cases that account
// for ~15 blocks in the v2 fixture.

import { applyRules, tryCompile, type ActiveRule } from '../rules'

const SLASH_CRUISE_BUS: ActiveRule = {
  id: 'cruise-slash-bus',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern: '{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*\\(\\s*[^-)]+?\\s*-\\s*{{EXTID}}\\s*\\)\\s*/\\s*([^/]*?)\\s*/\\s*[^/]*?{{N}}\\s*명',
  slot_map: {
    product: 0,
    name: 1,
    external_booking_id: 2,
    language: 3,
    party_size: 4,
  },
  postprocess: null,
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

const SLASH_CRUISE_PRIVATE: ActiveRule = {
  id: 'cruise-slash-private',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern: '{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*\\(\\s*[^-)]+?\\s*-\\s*{{EXTID}}\\s*\\)\\s*/\\s*([^/]*?)\\s*/\\s*[^/]*?{{N}}\\s*대',
  slot_map: {
    product: 0,
    name: 1,
    external_booking_id: 2,
    language: 3,
    vehicle_capacity: 4,
  },
  postprocess: null,
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

describe('cruise slash rules — compile', () => {
  it('both rules compile to RegExp', () => {
    expect(tryCompile(SLASH_CRUISE_BUS.template_pattern)).not.toBeNull()
    expect(tryCompile(SLASH_CRUISE_PRIVATE.template_pattern)).not.toBeNull()
  })
})

describe('cruise slash bus rule — Viator', () => {
  it('extracts a Viator cruise bus booking with empty language', () => {
    const block = '제주 크루즈 - 버스투어 / Annie Chan ( 비아토르 - BR-1230125029 ) / / 3 명 / / / / 1 510-205-0282 / 크루즈선: Norwegian Spirit 하선 시간: 8am 하차 위치: Cruise Port'
    const r = applyRules([SLASH_CRUISE_BUS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Annie Chan')
    expect(r.bookings[0].partySize).toBe(3)
    expect(r.bookings[0].externalBookingId).toBe('BR-1230125029')
    expect(r.bookings[0].sourcePlatform).toBe('viator')
    expect(r.bookings[0].phone).toBeDefined()
    expect(r.bookings[0].phone).toContain('510')
  })

  it('extracts a GYG cruise bus with English language + proxy email + phone via block fallback', () => {
    const block = '제주 크루즈 - 버스투어 / Naomi McCully ( 겟유가이드 - GYG6H8YZXW8Q ) / / 2 명 / Port of Jeju, Port of Jeju, Jeju-si / / customer-37nyflxcm45p2pzp@reply.getyourguide.com / 447480529749 / Number: +44 7480 529749'
    const r = applyRules([SLASH_CRUISE_BUS], [block])
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('Naomi McCully')
    expect(b.partySize).toBe(2)
    expect(b.externalBookingId).toBe('GYG6H8YZXW8Q')
    expect(b.sourcePlatform).toBe('gyg')
    expect(b.email).toContain('@reply.getyourguide.com')
    expect(b.phone).toBeDefined()
  })

  it('extracts a Klook cruise bus with captured English language', () => {
    const block = '제주 크루즈-일반 / Karla Ruvalcaba ( 겟유가이드 - GYGN6FVQ48ML ) / English / 5 명 / / / customer-yrvdundl55hpfxrn@reply.getyourguide.com / 13055873353 / Ship: CELEBRITY MILLENNIUM'
    const r = applyRules([SLASH_CRUISE_BUS], [block])
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('Karla Ruvalcaba')
    expect(b.partySize).toBe(5)
    expect(b.externalBookingId).toBe('GYGN6FVQ48ML')
    expect(b.language).toBe('en')   // Phase 26 §44.5.9 — slot "english" normalized to ISO
  })

  it('extracts a KKday cruise bus', () => {
    const block = '제주 크루즈-일반 / 駿宥 蔡 ( kkday - 25KK273812527 ) / / 2 명 / 항공편명 CostaSerena / 라인/0919015958 / shiu1208@gmail.com / 886 919015958 /'
    const r = applyRules([SLASH_CRUISE_BUS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('駿宥 蔡')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('25KK273812527')
    expect(r.bookings[0].sourcePlatform).toBe('kkday')
  })
})

describe('cruise slash private rule — 대 vehicle counter', () => {
  it('extracts a Viator private cruise (1 대 vehicle)', () => {
    const block = '제주 크루즈 - 프라이빗 / Amanda Plantz ( 비아토르 - BR-1274634861 ) / / 1 대 / / / / 1 402-515-4452 /'
    const r = applyRules([SLASH_CRUISE_PRIVATE], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Amanda Plantz')
    expect(r.bookings[0].externalBookingId).toBe('BR-1274634861')
    expect(r.bookings[0].sourcePlatform).toBe('viator')
  })

  it('extracts a GYG private cruise with English captured', () => {
    const block = '제주 크루즈 - 프라이빗 / Bruno Bouteille ( 겟유가이드 - GYG997XAA852 ) / 영어 / 1 대 / / Total: 6 people / customer-ze5xfpxrzksftaf5@reply.getyourguide.com / 33622193741 /'
    const r = applyRules([SLASH_CRUISE_PRIVATE], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Bruno Bouteille')
    expect(r.bookings[0].language).toBe('en')   // Phase 26 §44.5.9 — "영어" normalized to ISO
  })

  it('does NOT match a bus tour (대 mismatch)', () => {
    const block = '제주 크루즈 - 버스투어 / Annie Chan ( 비아토르 - BR-1230125029 ) / / 3 명 / / / / 1 510-205-0282 /'
    const r = applyRules([SLASH_CRUISE_PRIVATE], [block])
    expect(r.bookings).toHaveLength(0)
  })
})

describe('cruise slash bus rule — does NOT mismatch non-cruise blocks', () => {
  it('does not match the legacy "1. 남쪽 - X" Korean operator format', () => {
    const block = '1. 남쪽 - Shilla Duty-Free Jeju Store at 9:05\nIp Sze Yan (인원수 x 2 명)  - 클룩 - SPT338756'
    const r = applyRules([SLASH_CRUISE_BUS], [block])
    expect(r.bookings).toHaveLength(0)
  })
})
