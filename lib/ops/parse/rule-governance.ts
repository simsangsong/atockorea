// Phase 27 §45 Sprint 27.E — parse_rules promotion governance (Hard Rule #20).
//
// "No silent active rule." A rule may only become status='active' if it EITHER
// passes the statistical threshold (≥STAT_MIN_MATCHES shadow matches at
// ≥STAT_MIN_AGREEMENT agreement, master plan §7) OR carries explicit override
// metadata (a promotion_reason plus at least one of validated_fixture /
// promoted_by). This module is the single, pure source of that rule — the DB
// CHECK constraint (parse_rules_active_governed) mirrors it as the hard floor,
// and the status route calls canPromoteToActive() to fail early with a friendly
// message instead of surfacing a raw constraint violation.

/** §7 statistical-promotion threshold. */
export const STAT_MIN_MATCHES = 100
export const STAT_MIN_AGREEMENT = 0.95

/** The governance-relevant slice of a parse_rules row. */
export interface GovernanceRule {
  match_count: number
  success_count: number
  promotion_reason?: string | null
  validated_fixture?: string | null
  promoted_by?: string | null
}

/** Override metadata supplied at promotion time (from the admin request). */
export interface PromotionOverride {
  promotionReason?: string | null
  validatedFixture?: string | null
  /** auth.users.id of the promoting admin. */
  promotedBy?: string | null
}

/** Statistical branch — enough validated matches at high enough agreement. */
export function meetsStatThreshold(rule: Pick<GovernanceRule, 'match_count' | 'success_count'>): boolean {
  if (rule.match_count < STAT_MIN_MATCHES) return false
  return rule.success_count >= rule.match_count * STAT_MIN_AGREEMENT
}

/** Override branch — a reason plus at least one piece of evidence. */
export function hasOverrideMetadata(meta: {
  promotion_reason?: string | null
  validated_fixture?: string | null
  promoted_by?: string | null
}): boolean {
  return nonEmpty(meta.promotion_reason) && (nonEmpty(meta.validated_fixture) || nonEmpty(meta.promoted_by))
}

export interface PromotionDecision {
  ok: boolean
  /** Which branch authorized it (for logging / metadata). */
  via?: 'threshold' | 'override'
  /** Why it was rejected (friendly, Korean — surfaced by the route + UI). */
  reason?: string
}

/**
 * Can this rule be promoted to active, given the override the admin supplied?
 * The threshold branch needs nothing extra; the override branch needs a reason
 * (from `override` or already on the row) + evidence (validatedFixture, or the
 * promotedBy admin id the route always supplies).
 */
export function canPromoteToActive(rule: GovernanceRule, override: PromotionOverride = {}): PromotionDecision {
  if (meetsStatThreshold(rule)) return { ok: true, via: 'threshold' }

  const merged = {
    promotion_reason: firstNonEmpty(override.promotionReason, rule.promotion_reason),
    validated_fixture: firstNonEmpty(override.validatedFixture, rule.validated_fixture),
    promoted_by: firstNonEmpty(override.promotedBy, rule.promoted_by),
  }
  if (hasOverrideMetadata(merged)) return { ok: true, via: 'override' }

  return {
    ok: false,
    reason:
      `이 규칙은 통계 임계(매치 ${STAT_MIN_MATCHES}회 이상, 동의율 ${Math.round(STAT_MIN_AGREEMENT * 100)}% 이상)를 ` +
      `충족하지 못했습니다. 활성화하려면 승급 사유를 입력하세요 (현재 매치 ${rule.match_count}회).`,
  }
}

/** Classify an already-active rule for the admin health view. */
export type GovernanceState = 'threshold' | 'override' | 'ungoverned'

export function governanceState(rule: GovernanceRule): GovernanceState {
  if (meetsStatThreshold(rule)) return 'threshold'
  if (hasOverrideMetadata(rule)) return 'override'
  return 'ungoverned' // a defect once the migration lands — shouldn't persist
}

// ── internals ────────────────────────────────────────────────────────────────

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) if (nonEmpty(v)) return v as string
  return null
}
