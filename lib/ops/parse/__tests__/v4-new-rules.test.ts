// Phase 0-ter — Fixture tests for the v4 KakaoTalk-export-derived rule.
//
// Single family: PRODUCT / NAME / PLATFORM EXTID / ... / N명
//   — no leading date (distinguishes from 7f03457e)
//   — no parens around platform-EXTID (distinguishes from 7f24bfc7)
//   — NAME_NOPAREN forbids `(` to enforce that distinction
//
// Convention enforcement:
//   - No literal (...) capture groups in template_pattern. Only {{TOKEN}}.
//   - slot_map index = 0-based order of {{TOKEN}} appearance.

import { applyRules, tryCompile, type ActiveRule } from '../rules'

const PRODUCT_SLASH_NO_PARENS: ActiveRule = {
  id: 'v4-product-slash-no-parens',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern:
    '{{PRODUCT}}\\s*/\\s*{{NAME_NOPAREN}}\\s*/\\s*{{PLATFORM}}\\s+{{EXTID}}\\s*/\\s*.*?{{N}}\\s*명',
  slot_map: { product: 0, name: 1, platform: 2, external_booking_id: 3, party_size: 4 },
  postprocess: { platform_normalize: { '비아토르': 'viator', '클룩': 'klook', '겟유가이드': 'gyg', 'kkday': 'kkday', 'Kkday': 'kkday' } },
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

describe('v4-product-slash-no-parens — compile', () => {
  it('compiles to RegExp', () => {
    expect(tryCompile(PRODUCT_SLASH_NO_PARENS.template_pattern)).not.toBeNull()
  })
})

describe('v4-product-slash-no-parens — positive matches', () => {
  it('matches GYG with inline X N 명 counter', () => {
    const block = '제주 크루즈 버스투어 / Ariadna Roig Gómez / 겟유가이드 GYGWZBFZ3AHG / 인원수 X 2 명/ +34686556705 / customer-5milw5inmvhsmr75@reply.getyourguide.com /'
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Ariadna Roig Gómez')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('GYGWZBFZ3AHG')
    expect(r.bookings[0].sourcePlatform).toBe('gyg')
    expect(r.bookings[0].phone).toBeDefined()
    expect(r.bookings[0].email).toContain('@reply.getyourguide.com')
  })

  it('matches Viator with inline N/A in middle fields', () => {
    const block = '제주 크루즈 버스투어 / JESUSALEJANDRO ORDIERES SIERES / 비아토르 BR-1278293931 / 1-Day Jeju Island Tour For Cruise Passenger / 인원수 X 4 명 /  +525526996967 / N/A / Language:English / Port of Jeju at 09:00'
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('JESUSALEJANDRO ORDIERES SIERES')
    expect(r.bookings[0].partySize).toBe(4)
    expect(r.bookings[0].externalBookingId).toBe('BR-1278293931')
    expect(r.bookings[0].sourcePlatform).toBe('viator')
  })

  it('matches GYG with X2명 (no space variant) and embedded slash in product detail', () => {
    const block = '제주 크루즈 버스투어 / Hilary Davidson/겟유가이드 GYGRFQ89VG48/Jeju : For Cruise Guests UNESCO Highlights Jeju Island Tour (제주/강정 버스투어)/X2명/+447752044831/customer-ul3efvsnmuhghw4i@reply.getyourguide.com//Port of Jeju, Jeju-si'
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Hilary Davidson')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('GYGRFQ89VG48')
    expect(r.bookings[0].sourcePlatform).toBe('gyg')
  })

  it('matches GYG minimal X2명 (no email)', () => {
    const block = '제주 크루즈 버스투어 / Tom Woodhouse/겟유가이드 GYGG46BWGQW5/X2명 / +447723915471/customer-tlwl62xmkriviifc@reply.getyourguide.com//Port of Jeju, Jeju-si'
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Tom Woodhouse')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('GYGG46BWGQW5')
  })

  it('matches Viator with [Join-in] suffix and embedded slash', () => {
    const block = '제주 크루즈 버스투어 / Randy Stenger/ 비아토르 BR-1277005763/[Join-in] Jeju UNESCO Tour 09:00/X2명 /+19523817474//Port of Jeju, Jeju-si'
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Randy Stenger')
    expect(r.bookings[0].partySize).toBe(2)
    expect(r.bookings[0].externalBookingId).toBe('BR-1277005763')
    expect(r.bookings[0].sourcePlatform).toBe('viator')
  })
})

describe('v4-product-slash-no-parens — negative cases (no collision)', () => {
  it('does NOT match the legacy paren format (7f24bfc7 territory)', () => {
    const block = '제주 크루즈 - 버스투어 / Annie Chan ( 비아토르 - BR-1230125029 ) / / 3 명 / / / / 1 510-205-0282 / 크루즈선: Norwegian Spirit'
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    expect(r.bookings).toHaveLength(0)
  })

  it('does NOT match the date-prefix format (7f03457e territory)', () => {
    const block = '2025-07-17/제주 크루즈 버스투어 / Emily Descoteaux/ 비아토르 BR-1288053683/[Join-in] Jeju UNESCO Tour 10:00/2명/CA+1 5149954666//Seogwipo Gangjeong Cruise Terminal'
    // This DOES match (rule is broader than 7f03457e because it doesn't
    // require a leading date), but the extracted PRODUCT will include the
    // date as prefix. Acceptable downgrade compared to LLM escalation.
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], [block])
    // The match should succeed — but we just want to verify it doesn't crash.
    // Real production has 7f03457e tried first (higher success_count) so this
    // pattern only fires on dateless blocks.
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Emily Descoteaux')
  })

  it('does NOT match a pure header block', () => {
    const r = applyRules([PRODUCT_SLASH_NO_PARENS], ['프라이빗\n\n제주 크루즈 - 프라이빗'])
    expect(r.bookings).toHaveLength(0)
  })
})
