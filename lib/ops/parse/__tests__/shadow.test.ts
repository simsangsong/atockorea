// Phase 27 §45 (learning loop) — shadow-rule agreement scoring.
//
// scoreShadowRules + agreesOnCore are the pure heart of the compound lever: they
// turn LLM ground truth into the match/agreement stats Hard Rule #20's
// statistical promotion path consumes. These tests pin the scoring contract.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { ActiveRule } from '../rules'
import { scoreShadowRules, agreesOnCore } from '../shadow'

function rule(overrides: Partial<ActiveRule> = {}): ActiveRule {
  return {
    id: 'rule-1',
    tenant_id: 'T1',
    scope: 'tenant',
    // "(.+?) / (\d+) 명" — name + party size.
    template_pattern: '{{NAME}} / {{N}} 명',
    slot_map: { name: 0, party_size: 1 },
    postprocess: null,
    source: 'auto_mined',
    match_count: 0,
    success_count: 0,
    ...overrides,
  }
}

function booking(extra: Partial<ParsedBooking>): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'B1',
    leadName: 'Alice',
    partySize: 2,
    confidenceScore: 0.9,
    issues: [],
    ...extra,
  } as ParsedBooking
}

describe('scoreShadowRules', () => {
  it('accrues a match AND agreement when the rule reproduces the LLM output', () => {
    const pairs = [{ block: 'Alice / 2 명', expected: booking({ leadName: 'Alice', partySize: 2 }) }]
    const stats = scoreShadowRules([rule()], pairs)
    expect(stats).toEqual([{ rule_id: 'rule-1', matched: 1, agreed: 1 }])
  })

  it('accrues a match but NOT agreement when party size disagrees', () => {
    const pairs = [{ block: 'Alice / 2 명', expected: booking({ leadName: 'Alice', partySize: 5 }) }]
    const stats = scoreShadowRules([rule()], pairs)
    expect(stats).toEqual([{ rule_id: 'rule-1', matched: 1, agreed: 0 }])
  })

  it('ignores blocks the rule does not match (no phantom stats)', () => {
    const pairs = [{ block: 'no delimiter here', expected: booking({}) }]
    const stats = scoreShadowRules([rule()], pairs)
    expect(stats).toEqual([])
  })

  it('tallies across multiple blocks', () => {
    const pairs = [
      { block: 'Alice / 2 명', expected: booking({ leadName: 'Alice', partySize: 2 }) },
      { block: 'Brian / 3 명', expected: booking({ leadName: 'Brian', partySize: 3 }) },
      { block: 'Cathy / 4 명', expected: booking({ leadName: 'Cathy', partySize: 9 }) }, // disagree
    ]
    const stats = scoreShadowRules([rule()], pairs)
    expect(stats).toEqual([{ rule_id: 'rule-1', matched: 3, agreed: 2 }])
  })

  it('returns one entry per rule that matched at least once', () => {
    const never = rule({ id: 'rule-2', template_pattern: 'ZZZ {{NAME}}', slot_map: { name: 0 } })
    const pairs = [{ block: 'Alice / 2 명', expected: booking({ leadName: 'Alice', partySize: 2 }) }]
    const stats = scoreShadowRules([rule(), never], pairs)
    expect(stats.map(s => s.rule_id)).toEqual(['rule-1'])
  })
})

describe('agreesOnCore', () => {
  it('requires lead name + party size to match', () => {
    expect(agreesOnCore(booking({ leadName: 'Alice', partySize: 2 }), booking({ leadName: 'Alice', partySize: 2 }))).toBe(true)
    expect(agreesOnCore(booking({ leadName: 'Alice' }), booking({ leadName: 'Bob' }))).toBe(false)
    expect(agreesOnCore(booking({ partySize: 2 }), booking({ partySize: 3 }))).toBe(false)
  })

  it('matches lead names by containment (region-prefixed variants)', () => {
    expect(agreesOnCore(booking({ leadName: 'Alice Kim' }), booking({ leadName: 'Alice Kim (Jeju)' }))).toBe(true)
    expect(agreesOnCore(booking({ leadName: 'Alice' }), booking({ leadName: 'Alice Kim' }))).toBe(true)
  })

  it('is lenient on absent fields but strict on conflicts', () => {
    // phone present on one side only → not a conflict.
    expect(agreesOnCore(booking({ phone: '+82 10 1111 2222' }), booking({}))).toBe(true)
    // both present, different → conflict.
    expect(agreesOnCore(booking({ phone: '+82 10 1111 2222' }), booking({ phone: '+82 10 9999 8888' }))).toBe(false)
    // same digits, different formatting → agree.
    expect(agreesOnCore(booking({ phone: '+8210-1111-2222' }), booking({ phone: '+82 10 1111 2222' }))).toBe(true)
  })

  it('treats conflicting email or date as disagreement', () => {
    expect(agreesOnCore(booking({ email: 'a@x.com' }), booking({ email: 'b@x.com' }))).toBe(false)
    expect(agreesOnCore(booking({ tourDate: '2026-06-10' }), booking({ tourDate: '2026-06-11' }))).toBe(false)
    expect(agreesOnCore(booking({ email: 'A@X.com' }), booking({ email: 'a@x.com' }))).toBe(true)
  })
})
