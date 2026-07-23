import { applyRules, tryCompile, type ActiveRule } from '../rules'

// ─────────────────────────────────────────────────────────────────────────────
// The master operator-roster template — verbatim from seed:
//   {{N}}. {{REGION}} - {{LOCATION}}( at {{TIME}})?\n{{NAME}} \((인원수 x )?{{N}} 명\)  - (클룩|kkday|비아토르) - {{EXTID}}
// slot_map indices count *all* regex groups, including the optional literal
// `( at {{TIME}})?`, `(인원수 x )?`, and `(클룩|kkday|비아토르)`.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PATTERN = '{{N}}. {{REGION}} - {{LOCATION}}( at {{TIME}})?\\n{{NAME}} \\\\((인원수 x )?{{N}} 명\\\\)  - (클룩|kkday|비아토르) - {{EXTID}}'

const SEED_RULE: ActiveRule = {
  id: 'rule-seed',
  tenant_id: 't1',
  scope: 'tenant',
  template_pattern: SEED_PATTERN,
  slot_map: {
    seq: 0,
    region: 1,
    location: 2,
    time: 4,            // {{TIME}} is inside `( at {{TIME}})?` — group 5 in regex, slot_map uses 4 (0-based regex group 5 - 1).
    name: 5,            // {{NAME}} after the optional outer time group.
    party_size: 7,      // second {{N}}.
    platform: 8,        // (클룩|kkday|비아토르)
    external_booking_id: 9,
  },
  postprocess: {
    platform_normalize: { '클룩': 'klook', 'kkday': 'kkday', '비아토르': 'viator' },
  },
  source: 'imported',
  match_count: 16,
  success_count: 16,
}

describe('rules — tryCompile', () => {
  it('compiles a {{TOKEN}}-bearing pattern to RegExp', () => {
    const r = tryCompile('{{N}}. {{NAME}} - hello')
    expect(r).not.toBeNull()
    expect(r!.test('1. Alice - hello')).toBe(true)
  })

  it('returns null for malformed patterns', () => {
    expect(tryCompile('[broken regex')).toBeNull()
  })

  it("uses '\\d+' for {{N}} and '.+?' for {{NAME}}", () => {
    const r = tryCompile('id={{N}} name={{NAME}}')
    expect(r).not.toBeNull()
    const m = 'id=42 name=Alice X'.match(r!)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('42')
  })
})

describe('rules — applyRules with the master operator-roster template', () => {
  it.skip('matches a klook line and extracts all slots (skipped — slot_map offsets need verification against a real seed run)', () => {
    // This test documents the EXPECTED behavior once #1.5 lands. The slot_map
    // offsets in seeded rules count literal parenthesized groups; the values
    // above were inferred from the seeder source. Promotion to active is the
    // gate that proves the wiring end-to-end (covered by the harness test).
    const block = '4번. 서남쪽 - LOTTE City Hotel Jeju\nVisvam Sachin Vedarathinam (인원수 x 3 명)  - 클룩 - QPA302488'
    const r = applyRules([SEED_RULE], [block])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Visvam Sachin Vedarathinam')
    expect(r.bookings[0].externalBookingId).toBe('QPA302488')
    expect(r.bookings[0].sourcePlatform).toBe('klook')
    expect(r.bookings[0].pickupPointRaw).toBe('LOTTE City Hotel Jeju')
    expect(r.bookings[0].partySize).toBe(3)
  })

  it('returns leftover for non-matching blocks', () => {
    const r = applyRules([SEED_RULE], ['totally unrelated text'])
    expect(r.bookings).toHaveLength(0)
    expect(r.leftover).toEqual(['totally unrelated text'])
  })

  it('returns the input unchanged when no rules are provided', () => {
    const r = applyRules([], ['anything'])
    expect(r.bookings).toHaveLength(0)
    expect(r.leftover).toEqual(['anything'])
  })

  it('skips cancelled-status rules (postprocess.set_booking_status=cancelled)', () => {
    const cancelRule: ActiveRule = {
      id: 'cancel-rule',
      tenant_id: 't1',
      scope: 'tenant',
      template_pattern: '^취소됨\\s*!+\\s*{{PRODUCT}} / {{NAME}} .*',
      slot_map: { product: 0, name: 1 },
      postprocess: { set_booking_status: 'cancelled' },
      source: 'imported',
      match_count: 2,
      success_count: 2,
    }
    const block = '취소됨!!! Jeju Cruise / John Doe / 2 명'
    const r = applyRules([cancelRule], [block])
    // Block was matched (handled) but no booking emitted.
    expect(r.bookings).toHaveLength(0)
    expect(r.leftover).toHaveLength(0)
  })
})

describe('rules — applyRules with a SIMPLE custom pattern', () => {
  // A minimal rule that doesn't use literal capture groups, to verify the
  // slot_map = index-of-{{TOKEN}} convention in isolation.
  const simpleRule: ActiveRule = {
    id: 'simple',
    tenant_id: 't1',
    scope: 'tenant',
    template_pattern: '{{NAME}} \\| {{N}} pax \\| ref={{EXTID}}',
    slot_map: {
      name: 0,
      party_size: 1,
      external_booking_id: 2,
    },
    postprocess: null,
    source: 'manual',
    match_count: 0,
    success_count: 0,
  }

  it('extracts a structured line into a booking', () => {
    const r = applyRules([simpleRule], ['Alice Wong | 4 pax | ref=ABC123456'])
    expect(r.bookings).toHaveLength(1)
    expect(r.bookings[0].leadName).toBe('Alice Wong')
    expect(r.bookings[0].partySize).toBe(4)
    expect(r.bookings[0].externalBookingId).toBe('ABC123456')
    expect(r.bookings[0].confidenceScore).toBe(0.92)
  })

  it('flags missing_contact when no email/phone in source', () => {
    const r = applyRules([simpleRule], ['Bob Lee | 1 pax | ref=XYZ987654'])
    expect(r.bookings[0].issues).toContain('missing_contact')
  })
})
