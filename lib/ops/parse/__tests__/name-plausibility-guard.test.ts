// Regression — deterministic name-plausibility guard at L2.5 (rules.ts).
//
// Bug: rules.ts buildBookingFromMatch() emitted a booking from whatever the
// rule's lazy {{NAME}} slot captured, with no plausibility check. On the live
// 5/10 Jeju cruise manifest (tests/fixtures/import/real-cruise-2026-05-10-jeju.txt)
// some GYG slash-cruise rows produced bookings whose leadName was junk metadata
// rather than a person — observed (parse_metrics layer_l2_hit>0, layer_l3_hit=0,
// i.e. deterministic, not the LLM):
//   - "Traveler 2: Dietary restrictions: Shellfish Allergy"
//   - "Traveler 2: Dietary restrictions:"
//   - "다음 내용을 꼭 참고하세요 !!"   (a Korean "please note the following!!" line)
//
// Fix: rules.ts now reuses the shared isPlausibleName() guard (heuristics.ts,
// also used by L1 adapters + L2) before emitting. A junk capture returns null,
// so the block falls through to leftover → L3 instead of becoming a bogus
// 0.92-confidence deterministic "success".

import { isPlausibleName } from '../heuristics'
import { applyRules, type ActiveRule } from '../rules'

// The three exact strings observed as junk leadNames in the live run.
const JUNK_NAMES = [
  'Traveler 2: Dietary restrictions: Shellfish Allergy',
  'Traveler 2: Dietary restrictions:',
  '다음 내용을 꼭 참고하세요 !!',
]

// Real names that share the same source shapes and MUST stay valid.
const REAL_NAMES = [
  'Annie Chan',          // Latin
  'Naomi McCully',
  "Christopher O'Leary",  // apostrophe
  'Clément Bourassa',     // accented Latin
  '駿宥 蔡',               // CJK (kkday)
  '심상송',                // Hangul
  'Denise Hidalgo',
]

describe('isPlausibleName — rejects junk metadata / instruction lines', () => {
  for (const junk of JUNK_NAMES) {
    it(`rejects ${JSON.stringify(junk)}`, () => {
      expect(isPlausibleName(junk)).toBe(false)
    })
  }

  // Adjacent variants of the same classes (defense in depth, not just the
  // three exact strings).
  it('rejects dietary/special-requirement metadata variants', () => {
    expect(isPlausibleName('Traveler 1: Dietary restrictions: None')).toBe(false)
    expect(isPlausibleName('Special requirements: wheelchair access')).toBe(false)
    expect(isPlausibleName('Allergies: nuts')).toBe(false)
  })

  it('rejects Korean instruction / notice lines (verb endings, bang, keywords)', () => {
    expect(isPlausibleName('아래 내용 확인 부탁드립니다')).toBe(false)
    expect(isPlausibleName('필독!!')).toBe(false)
    expect(isPlausibleName('주의사항: 신분증 지참')).toBe(false)
    expect(isPlausibleName('예약 변경은 미리 연락주세요')).toBe(false)
  })
})

describe('isPlausibleName — keeps real names valid', () => {
  for (const name of REAL_NAMES) {
    it(`accepts ${JSON.stringify(name)}`, () => {
      expect(isPlausibleName(name)).toBe(true)
    })
  }
})

// ── L2.5 integration: the guard blocks junk emits and keeps real ones ────────
//
// Two production rule templates (verbatim from bulk-jeju-coverage.test.ts):
//   489b7039 — region-prefixed roster line; {{NAME}} is the field after the
//              region, captured as a lazy slot that can grab interleaved text.
//   7f24bfc7 — GYG/cruise slash format anchored on "( platform - EXTID )";
//              {{NAME}} sits just before the parens.
const REGION_ROSTER_RULE: ActiveRule = {
  id: '489b7039-1501-40b5-a308-43999c14bb2f',
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

const GYG_CRUISE_RULE: ActiveRule = {
  id: '7f24bfc7-5bf5-465d-b241-a51a7912b107',
  tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
  scope: 'tenant',
  template_pattern:
    '{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*\\(\\s*[^-)]+?\\s*-\\s*{{EXTID}}\\s*\\)\\s*/\\s*{{LANG_OPT}}\\s*/\\s*[^/]*?{{N}}\\s*명(?:\\s*/\\s*{{LOCATION_OPT}}\\s*/)?',
  slot_map: { product: 0, name: 1, external_booking_id: 2, language: 3, party_size: 4, pickup_location: 5 },
  postprocess: null,
  source: 'manual',
  match_count: 0,
  success_count: 0,
}

describe('applyRules — junk NAME capture falls through to leftover (not a bad emit)', () => {
  it('489b7039: a dietary-metadata line in the NAME slot emits nothing and is left for L3', () => {
    const block = '부산항-일반 / Traveler 2: Dietary restrictions: Shellfish Allergy / English / 2 명'
    const r = applyRules([REGION_ROSTER_RULE], [block])
    expect(r.bookings).toHaveLength(0)
    expect(r.leftover).toEqual([block])
  })

  it('489b7039: a Korean instruction line in the NAME slot emits nothing and is left for L3', () => {
    const block = '부산항-일반 / 다음 내용을 꼭 참고하세요 !! / English / 2 명'
    const r = applyRules([REGION_ROSTER_RULE], [block])
    expect(r.bookings).toHaveLength(0)
    expect(r.leftover).toEqual([block])
  })

  it('7f24bfc7: a dietary-metadata line in the GYG-cruise NAME slot emits nothing', () => {
    const block =
      '제주 크루즈 - 버스투어 / Traveler 2: Dietary restrictions: Shellfish Allergy ( 겟유가이드 - GYG48ZG65VY7 ) / English / 2 명'
    const r = applyRules([GYG_CRUISE_RULE], [block])
    expect(r.bookings).toHaveLength(0)
    expect(r.leftover).toEqual([block])
  })

  // Positive controls — the same rules + block shapes still emit real bookings,
  // proving the guard is surgical (it only removes implausible names, the rules
  // themselves still match).
  it('489b7039: a real name in the same shape still emits', () => {
    const block = '부산항-일반 / Annie Chan / English / 2 명'
    const r = applyRules([REGION_ROSTER_RULE], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Annie Chan')
    expect(r.bookings[0].partySize).toBe(2)
  })

  it('7f24bfc7: a real GYG-cruise booking still emits', () => {
    const block = '제주 크루즈 - 버스투어 / Naomi McCully ( 겟유가이드 - GYG6H8YZXW8Q ) / English / 2 명'
    const r = applyRules([GYG_CRUISE_RULE], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Naomi McCully')
    expect(r.bookings[0].externalBookingId).toBe('GYG6H8YZXW8Q')
    expect(r.bookings[0].partySize).toBe(2)
  })
})
