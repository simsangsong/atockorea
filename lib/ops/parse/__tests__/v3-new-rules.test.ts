// Phase 0-ter — Fixture tests for the v3 KakaoTalk-export-derived rules.
//
// Mined from tmp/bulk-jeju-v3.txt leftover analysis. Three families:
//   1. REGION_SLASH        — operator-curated rows with region prefix,
//                            slash-separated, NO ( platform - EXTID ) block.
//                            Covers 동쪽/남쪽/서남쪽/제주항/강정항/부산항/인천항
//                            and their -일반 / -프라이빗 variants.
//   2. CRUISE_DATE_EXTID   — Product / Date / Name / EXTID / Product / Adult X N / ...
//                            EXTID is its own field (not parenthesized), party uses
//                            "Adult X N" instead of "N 명".
//   3. CRUISE_DATE_PREFIX  — Date / Product / Name / Platform EXTID / ... / N 명
//                            Date is first field, platform-EXTID is space-separated
//                            inside one field (not parenthesized).
//
// Convention enforcement (feedback_parse_rules_convention memory):
//   - No literal (...) capture groups in template_pattern. Only {{TOKEN}}.
//   - Non-capturing (?:...) groups are allowed.
//   - slot_map index = 0-based order of {{TOKEN}} appearance.

import { applyRules, tryCompile, type ActiveRule } from '../rules'

// ── Rule 1: REGION_SLASH ───────────────────────────────────────────────────
// {{NAME}} → group 1 (idx 0)
// {{LANG_OPT}} → group 2 (idx 1) — inside non-capturing optional, undefined when skipped
// {{N}} → group 3 (idx 2)
const REGION_SLASH: ActiveRule = {
  id: 'region-slash',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern:
    '(?:동쪽|남쪽|서남쪽|북쪽|동남쪽|서북쪽|동북쪽|제주항|강정항|부산항|인천항)(?:-(?:일반|프라이빗))?\\s*/\\s*{{NAME}}\\s*/\\s*(?:{{LANG_OPT}}\\s*/\\s*)?[^/]*?{{N}}\\s*명',
  slot_map: { name: 0, language: 1, party_size: 2 },
  postprocess: null,
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

// ── Rule 2: CRUISE_DATE_EXTID ──────────────────────────────────────────────
// {{PRODUCT}} → idx 0
// {{DATE}} → idx 1
// {{NAME}} → idx 2
// {{EXTID}} → idx 3
// {{PRODUCT}} → idx 4 (product detail, second occurrence)
// {{N}} → idx 5
const CRUISE_DATE_EXTID: ActiveRule = {
  id: 'cruise-date-extid-adult',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern:
    '{{PRODUCT}}\\s*/\\s*{{DATE}}\\s*/\\s*{{NAME}}\\s*/\\s*{{EXTID}}\\s*/\\s*{{PRODUCT}}\\s*/\\s*Adult\\s+[xX×]\\s*{{N}}',
  slot_map: { product: 0, tour_date: 1, name: 2, external_booking_id: 3, product_detail: 4, party_size: 5 },
  postprocess: null,
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

// ── Rule 3: CRUISE_DATE_PREFIX ─────────────────────────────────────────────
// {{DATE}} → idx 0
// {{PRODUCT}} → idx 1
// {{NAME}} → idx 2
// {{PLATFORM}} → idx 3
// {{EXTID}} → idx 4
// {{N}} → idx 5
const CRUISE_DATE_PREFIX: ActiveRule = {
  id: 'cruise-date-prefix',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern:
    '{{DATE}}\\s*/\\s*{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*/\\s*{{PLATFORM}}\\s+{{EXTID}}\\s*/\\s*.*?{{N}}\\s*명',
  slot_map: { tour_date: 0, product: 1, name: 2, platform: 3, external_booking_id: 4, party_size: 5 },
  postprocess: { platform_normalize: { '비아토르': 'viator', '클룩': 'klook', '겟유가이드': 'gyg', 'kkday': 'kkday' } },
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

describe('v3 rules compile', () => {
  it('REGION_SLASH compiles', () => {
    expect(tryCompile(REGION_SLASH.template_pattern)).not.toBeNull()
  })
  it('CRUISE_DATE_EXTID compiles', () => {
    expect(tryCompile(CRUISE_DATE_EXTID.template_pattern)).not.toBeNull()
  })
  it('CRUISE_DATE_PREFIX compiles', () => {
    expect(tryCompile(CRUISE_DATE_PREFIX.template_pattern)).not.toBeNull()
  })
})

describe('REGION_SLASH rule — operator-curated slash rows without ( - EXTID )', () => {
  it('matches 동쪽 / NAME / English / 인원수 x N 명 (Format F)', () => {
    const block = '동쪽 / JEANY GOLING / English / 인원수 x 2 명 / [08:55] Lotte city Hotel jeju / WhatsApp: 91149073 / jeanygoling@yahoo.com.sg / 65-91149073 /'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('JEANY GOLING')
    expect(b.partySize).toBe(2)
    expect(b.language).toBe('en')   // §44.5.9 — "English" normalized to ISO
    expect(b.email).toBe('jeanygoling@yahoo.com.sg')
    expect(b.phone).toBeDefined()
  })

  it('matches 제주항 / NAME / 영어 / N 명 / pickup / phone / email / phone / cruise notes (Format G short)', () => {
    const block = '제주항 / Nina Henderson / 영어 / 4 명 / Port of Jeju / WhatsApp: +61419438898 / jetsetter70@hotmail.com / 61-419438898 / Flight number: Norwegian spirit'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Nina Henderson')
    expect(r.bookings[0].partySize).toBe(4)
    expect(r.bookings[0].language).toBe('en')   // §44.5.9 — "영어" normalized to ISO
    expect(r.bookings[0].email).toBe('jetsetter70@hotmail.com')
  })

  it('matches 제주항 / NAME / N 명 / phone / cruise notes — NO language field (Format G ultra-short)', () => {
    const block = '제주항 / Laura Iosifescu / 2 명 / 44 7979 683901 / 크루즈선: Norwegian Spirit / 하선 시간: 12.30 PM / 하차 위치: Jeju Port'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Laura Iosifescu')
    expect(r.bookings[0].partySize).toBe(2)
    // Phase 26 §44.5.1 — language is now inferred from phone CC (+44 → en)
    // even when no language field is captured. Pre-Phase-26 expected undefined.
    expect(r.bookings[0].language).toBe('en')
    expect(r.bookings[0].phone).toContain('44')
  })

  it('matches 제주항-일반 / NAME / 영어 / N 명 / ... (Format I with -일반 suffix)', () => {
    const block = '제주항-일반 / Kathryn Escher / 영어 / 3 명 / Port of Jeju, Port of Jeju, Jeju-si / / / 1 812-369-8082 / 크루즈선: Holland America Noordam / 하선 시간: 0800 / 하차 위치: Cruise Port'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Kathryn Escher')
    expect(r.bookings[0].partySize).toBe(3)
    expect(r.bookings[0].language).toBe('en')   // §44.5.9 — "영어" normalized to ISO
  })

  it('matches 남쪽 / NAME / 영어 / 1 명 / 미정 / ... (Format J with empty pickup)', () => {
    const block = '남쪽 / Monica Sæves / 영어 / 1 명 / 미정 / / / 47 92 65 20 61 /'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Monica Sæves')
    expect(r.bookings[0].partySize).toBe(1)
  })

  it('matches 서남쪽 / NAME / / 인원수 x N 명 (empty language)', () => {
    const block = '서남쪽 / Anna Jiang / / 인원수 x 2 명 / LOTTE City Hotel Jeju / WeChat: magikarpmagic / jiang.anna96@gmail.com / 1-6502786452 /'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Anna Jiang')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].email).toBe('jiang.anna96@gmail.com')
  })

  it('matches 강정항 / NAME / English / N 명 with proxy email', () => {
    const block = '강정항 / Ruth Santos / English / 9 명 / customer-ggrrkgxwu7na3g6l@reply.getyourguide.com / 17809025236 /'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Ruth Santos')
    expect(r.bookings[0].partySize).toBe(9)
    expect(r.bookings[0].sourcePlatform).toBe('gyg')   // from proxy domain detection
  })

  it('does NOT match a bare header like 제주항 (no slash)', () => {
    const block = '제주항'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(0)
  })

  it('does NOT match a header like 부산항 6명 (no slash, header-shaped)', () => {
    const block = '부산항 6명'
    const r = applyRules([REGION_SLASH], [block])
    expect(r.bookings).toHaveLength(0)
  })
})

describe('CRUISE_DATE_EXTID rule — Product / Date / Name / EXTID / Product2 / Adult X N', () => {
  it('matches GYG Adult X 1 (Format A)', () => {
    const block = '제주 크루즈 버스투어 / 2025-09-04 / Gary Parsons / GYGZG2GA9L74 / Jeju: For Cruise Guests UNESCO Highlights Jeju Island Tour / Adult X 1 / +447831676892 / customer-tsiqhxns64iytr4q@reply.getyourguide.com / N/A / Port of Jeju'
    const r = applyRules([CRUISE_DATE_EXTID], [block])
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('Gary Parsons')
    expect(b.partySize).toBe(1)
    expect(b.externalBookingId).toBe('GYGZG2GA9L74')
    expect(b.tourDate).toBe('2025-09-04')
    expect(b.sourcePlatform).toBe('gyg')
    expect(b.email).toBeDefined()
    expect(b.phone).toBeDefined()
  })

  it('matches Viator BR- Adult X 4 (Format A)', () => {
    const block = '제주 크루즈 버스투어 / 2025-09-04 / Odile Pires / BR-1310498731 / 1-Day Jeju Island Tour For Cruise Passenger / Adult X 4 / +33 626112587 / N/A / N/A / Seogwipo Gangjeong Cruise Terminal'
    const r = applyRules([CRUISE_DATE_EXTID], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Odile Pires')
    expect(r.bookings[0].partySize).toBe(4)
    expect(r.bookings[0].externalBookingId).toBe('BR-1310498731')
    expect(r.bookings[0].sourcePlatform).toBe('viator')
  })

  it('does NOT match the 7f24bfc7 cruise-slash bus format (no Date+EXTID-as-field)', () => {
    const block = '제주 크루즈 - 버스투어 / Annie Chan ( 비아토르 - BR-1230125029 ) / / 3 명 / / / / 1 510-205-0282 / 크루즈선: Norwegian Spirit'
    const r = applyRules([CRUISE_DATE_EXTID], [block])
    expect(r.bookings).toHaveLength(0)
  })
})

describe('CRUISE_DATE_PREFIX rule — Date / Product / Name / Platform EXTID / ... / N 명', () => {
  it('matches Viator no-parens variant (Format B)', () => {
    const block = '2025-07-17/제주 크루즈 버스투어 / Emily Descoteaux/ 비아토르 BR-1288053683/[Join-in] Jeju UNESCO Tour 10:00/2명/CA+1 5149954666//Seogwipo Gangjeong Cruise Terminal'
    const r = applyRules([CRUISE_DATE_PREFIX], [block])
    expect(r.bookings).toHaveLength(1)
    const b = r.bookings[0]
    expect(b.leadName).toBe('Emily Descoteaux')
    expect(b.partySize).toBe(2)
    expect(b.externalBookingId).toBe('BR-1288053683')
    expect(b.sourcePlatform).toBe('viator')
    expect(b.tourDate).toBe('2025-07-17')
  })

  it('matches Klook no-parens variant with surrounding whitespace', () => {
    const block = '2025-07-17 / 제주 크루즈 버스투어 / Natalie Reynolds / 클룩 ZEJ423574/(Join-in) B. Gangjeong Port (Seogwipo Gangjeong Cruise Terminal)/2명/44-7740860895/natjrey@gmail.com/whatsapp 447740860895/Seogwipo Gangjeong Cruise Terminal'
    const r = applyRules([CRUISE_DATE_PREFIX], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Natalie Reynolds')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('ZEJ423574')
    expect(r.bookings[0].sourcePlatform).toBe('klook')
    expect(r.bookings[0].email).toBe('natjrey@gmail.com')
  })

  it('matches GYG no-parens with embedded slash in product detail', () => {
    const block = '2025-07-17/제주 크루즈 버스투어 / Ramiro Guerra/ 겟유가이드 GYG6H8XFW4KQ/Join in UNESCO Tour default - 제주/강정 버스투어/2명/+19562072054/customer-gvg4vi3qc5idbfmb@reply.getyourguide.com//Seogwipo Gangjeong Cruise Terminal'
    const r = applyRules([CRUISE_DATE_PREFIX], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Ramiro Guerra')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('GYG6H8XFW4KQ')
    expect(r.bookings[0].sourcePlatform).toBe('gyg')
  })

  it('does NOT match the legacy 7f24bfc7 paren format', () => {
    const block = '제주 크루즈 - 버스투어 / Annie Chan ( 비아토르 - BR-1230125029 ) / / 3 명 /'
    const r = applyRules([CRUISE_DATE_PREFIX], [block])
    expect(r.bookings).toHaveLength(0)
  })
})

describe('v3 rules — combined sanity: all three rules together do not over-match', () => {
  it('a pure header block matches nothing', () => {
    const blocks = ['프라이빗', '제주항', '서남쪽', '4월6일 크루즈 예약', '241116 고객명단']
    const r = applyRules([REGION_SLASH, CRUISE_DATE_EXTID, CRUISE_DATE_PREFIX], blocks)
    expect(r.bookings).toHaveLength(0)
  })
})
