// Phase 27 §45 Sprint 27.E — promotion governance unit tests (Hard Rule #20).

import {
  STAT_MIN_MATCHES,
  STAT_MIN_AGREEMENT,
  meetsStatThreshold,
  hasOverrideMetadata,
  canPromoteToActive,
  governanceState,
  type GovernanceRule,
} from '../rule-governance'

function rule(p: Partial<GovernanceRule>): GovernanceRule {
  return { match_count: 0, success_count: 0, ...p }
}

describe('meetsStatThreshold (§7: N≥100, agreement≥0.95)', () => {
  it('passes at exactly the boundary', () => {
    expect(meetsStatThreshold({ match_count: 100, success_count: 95 })).toBe(true)
  })
  it('fails below the match floor even at 100% agreement', () => {
    expect(meetsStatThreshold({ match_count: 99, success_count: 99 })).toBe(false)
  })
  it('fails below the agreement floor', () => {
    expect(meetsStatThreshold({ match_count: 200, success_count: 189 })).toBe(false) // 0.945
    expect(meetsStatThreshold({ match_count: 200, success_count: 190 })).toBe(true) // 0.95
  })
  it('a zero-hit rule never meets the threshold', () => {
    expect(meetsStatThreshold({ match_count: 0, success_count: 0 })).toBe(false)
  })
  it('exposes the documented constants', () => {
    expect(STAT_MIN_MATCHES).toBe(100)
    expect(STAT_MIN_AGREEMENT).toBe(0.95)
  })
})

describe('hasOverrideMetadata (reason + evidence)', () => {
  it('requires a reason', () => {
    expect(hasOverrideMetadata({ validated_fixture: 'x.test.ts' })).toBe(false)
  })
  it('reason alone is not enough — needs fixture OR promoter', () => {
    expect(hasOverrideMetadata({ promotion_reason: 'because' })).toBe(false)
  })
  it('reason + validated_fixture passes', () => {
    expect(hasOverrideMetadata({ promotion_reason: 'r', validated_fixture: 'x.test.ts' })).toBe(true)
  })
  it('reason + promoted_by passes', () => {
    expect(hasOverrideMetadata({ promotion_reason: 'r', promoted_by: 'user-1' })).toBe(true)
  })
  it('treats whitespace-only strings as empty', () => {
    expect(hasOverrideMetadata({ promotion_reason: '   ', validated_fixture: 'x' })).toBe(false)
  })
})

describe('canPromoteToActive', () => {
  it('threshold rule promotes with no override', () => {
    const d = canPromoteToActive(rule({ match_count: 120, success_count: 118 }))
    expect(d.ok).toBe(true)
    expect(d.via).toBe('threshold')
  })

  it('zero-hit rule promotes when the admin supplies a reason (route adds promotedBy)', () => {
    const d = canPromoteToActive(rule({ match_count: 0 }), { promotionReason: '운영자 검증 명단', promotedBy: 'admin-7' })
    expect(d.ok).toBe(true)
    expect(d.via).toBe('override')
  })

  it('zero-hit rule promotes when it already carries fixture metadata (the seed backfill)', () => {
    const d = canPromoteToActive(rule({ match_count: 0, promotion_reason: 'seeded', validated_fixture: 'bulk-jeju-coverage.test.ts' }))
    expect(d.ok).toBe(true)
    expect(d.via).toBe('override')
  })

  it('REJECTS a zero-hit rule with no reason and no metadata (#20)', () => {
    const d = canPromoteToActive(rule({ match_count: 0 }))
    expect(d.ok).toBe(false)
    expect(d.reason).toMatch(/승급 사유/)
  })

  it('a reason without a promoter id is still rejected (route always supplies promotedBy)', () => {
    // Defensive: reason alone is not override evidence.
    const d = canPromoteToActive(rule({ match_count: 3, success_count: 3 }), { promotionReason: 'looks fine' })
    expect(d.ok).toBe(false)
  })
})

describe('governanceState (admin health view)', () => {
  it('threshold-backed', () => {
    expect(governanceState(rule({ match_count: 150, success_count: 145 }))).toBe('threshold')
  })
  it('override-backed', () => {
    expect(governanceState(rule({ match_count: 4, success_count: 4, promotion_reason: 'r', validated_fixture: 'f' }))).toBe('override')
  })
  it('ungoverned (a defect — should not survive the migration)', () => {
    expect(governanceState(rule({ match_count: 4, success_count: 4 }))).toBe('ungoverned')
  })
})
