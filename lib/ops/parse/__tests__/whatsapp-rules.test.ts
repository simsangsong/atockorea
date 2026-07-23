// Phase 26 §44.5.3 — L2.5 rules.ts WhatsApp block scan
// Master plan §44 hard rule #16 — L2.5 rules MUST fill `whatsapp` when source
// text contains a WhatsApp/왓츠앱 marker. Pre-Phase-26, rules.ts hardcoded
// `whatsapp: undefined` at line 261 — the 12 active rules never emitted it.
// Block scan covers all rules without slot_map changes.

import { applyRules, type ActiveRule } from '../rules'

// Minimal rule that matches the head of v3 cruise-slash blocks — we only need
// the rule to FIRE so buildBookingFromMatch runs its block-scan logic. The
// production rules' exact slot_map is regression-tested in bulk-jeju-coverage.
const SIMPLE_RULE: ActiveRule = {
  id: 'test-simple-cruise-slash',
  tenant_id: 't1',
  scope: 'tenant',
  template_pattern: '{{REGION}} / {{NAME}} \\( {{PLATFORM}} - {{EXTID}} \\)',
  slot_map: {
    region: 0,
    name: 1,
    platform: 2,
    external_booking_id: 3,
  },
  postprocess: { platform_normalize: { '클룩': 'klook', 'kkday': 'kkday' } },
  source: 'seeded',
  match_count: 372,
  success_count: 372,
}

describe('rules — WhatsApp block scan (Phase 26 §44.5.3)', () => {
  it('extracts WhatsApp from "WhatsApp: +phone" line', () => {
    // Real v3 line shape (line 5 of bulk-jeju-v3.txt).
    const block =
      '남쪽 / Ke Jing Wong ( 클룩 - WWF456211 ) / English / 1 명 / Ocean Suites Jeju / WhatsApp: +6598226078 / Kejing.wong@gmail.com / 65-98226078 /'
    const out = applyRules([SIMPLE_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].whatsapp).toBe('+6598226078')
  })

  it('extracts WhatsApp from bare-number form (no plus prefix)', () => {
    // Real v3 line shape (line 13).
    const block =
      '서남쪽 / Naw Blessing Htoo ( 클룩 - XHA717367 ) / / 인원수 x 3 명 / LOTTE City Hotel Jeju / WhatsApp: 91384677 / nawblessinghtoo04@gmail.com / 65-82856234 /'
    const out = applyRules([SIMPLE_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].whatsapp).toBe('91384677')
  })

  it('extracts WhatsApp from Korean "왓츠앱/" label', () => {
    // Real v3 line shape (line 62) — KKday cruise format with 왓츠앱/ slash.
    const block =
      '제주 크루즈-일반 / Wai King Chan ( kkday - 25KK284032392 ) / 영어 / 1 명 / Celebrity Millennium / 왓츠앱/85290248278 / chanwkeliza@gmail.com / 852 90248278 /'
    const out = applyRules([SIMPLE_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].whatsapp).toBe('85290248278')
  })

  it('returns undefined whatsapp when no marker in block', () => {
    const block =
      '남쪽 / NoWhatsApp Booking ( 클룩 - ABC123456 ) / English / 1 명 / Ocean Suites Jeju / nowa@example.com / 1-1234567890 /'
    const out = applyRules([SIMPLE_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].whatsapp).toBeUndefined()
  })

  it('normalizes whatsapp value (strips spaces/hyphens/parens)', () => {
    const block =
      '남쪽 / Spaced Number ( 클룩 - WWF999999 ) / English / 1 명 / Ocean Suites Jeju / WhatsApp: +1 (415) 555-1234 / sp@example.com / 1-4155551234 /'
    const out = applyRules([SIMPLE_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].whatsapp).toBe('+14155551234')
  })
})
