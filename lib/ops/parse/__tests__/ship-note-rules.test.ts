// Phase 26 §44.5.18 — L2.5 rules.ts cruise-ship note preservation.
// Single-line GYG cruise rows carry the ship in a trailing free-text field, but
// the basic GYG rule has no ship slot. Pre-§44.5.18 that ship was dropped and
// the booking fell into the ship-less manual bucket. The rule now preserves any
// ship-bearing trailing segment into `notes` so the cruise-ship-backstop lift
// can substring-resolve it. (Live 5/10 manifest: ship lift 33 → 82.)
import { applyRules, type ActiveRule } from '../rules'

// Rule with NO ship slot — matches the head, leaving the trailing ship text to
// the block scan (mirror of whatsapp-rules.test.ts SIMPLE_RULE).
const NO_SHIP_RULE: ActiveRule = {
  id: 'test-noship-gyg',
  tenant_id: 't1',
  scope: 'tenant',
  template_pattern: '{{PRODUCT}} / {{NAME}} \\( {{PLATFORM}} - {{EXTID}} \\)',
  slot_map: { product: 0, name: 1, platform: 2, external_booking_id: 3 },
  postprocess: { platform_normalize: { '겟유가이드': 'gyg' } },
  source: 'seeded',
  match_count: 100,
  success_count: 100,
}

describe('rules — cruise ship-note preservation (Phase 26 §44.5.18)', () => {
  it('preserves a trailing ship segment into notes', () => {
    const block =
      '제주 크루즈 - 버스투어 / Christine Pearson ( 겟유가이드 - GYG48ZH7VQNH ) / English / 3 명 /  /  / x@reply.getyourguide.com / 14165787045 / Celebrity Millennium / arrive: 7:00am / depart 4:00pm'
    const out = applyRules([NO_SHIP_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes ?? '').toMatch(/Celebrity Millennium/i)
  })

  it('preserves a ship embedded in a free-text sentence', () => {
    const block =
      '제주 크루즈 - 버스투어 / Alex Psarras ( 겟유가이드 - GYGG46HB35V2 ) / English / 2 명 /  /  / y@reply.getyourguide.com / 447470423476 / We will be arriving at Jeju on the Celebrity Millennium ship. The ship arrives at 7am.'
    const out = applyRules([NO_SHIP_RULE], [block])
    expect(out.bookings[0].notes ?? '').toMatch(/celebrity millennium/i)
  })

  it('preserves a "Royal Caribbean Ovation" trailing segment', () => {
    const block =
      '제주 크루즈 - 버스투어 / Tamas N ( 겟유가이드 - GYG83X6R9V7N ) / English / 4 명 /  /  / z@reply.getyourguide.com / 36306128823 / Royal Caribbean Cruise Ovation of the Seas, dokking 07:00AM'
    const out = applyRules([NO_SHIP_RULE], [block])
    expect(out.bookings[0].notes ?? '').toMatch(/ovation of the seas/i)
  })

  it('leaves notes ship-free when no ship signal is present', () => {
    const block =
      '제주 크루즈 - 버스투어 / Andrea Luna ( 겟유가이드 - GYGMX5HFN7ZF ) / English / 2 명 /  /  / a@reply.getyourguide.com / 19257261922 /'
    const out = applyRules([NO_SHIP_RULE], [block])
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes ?? '').not.toMatch(/ovation|anthem|celebrity|millennium/i)
  })
})
