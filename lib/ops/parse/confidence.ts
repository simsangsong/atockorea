// Phase 27 §45 Sprint 27.H — structural confidence.
//
// The LLM SELF-REPORTS confidenceScore, and on an unseen tenant structure it
// happily reports 0.7–0.85 over a mis-mapped row — which then clears the 0.6
// accept floor and the 0.85 auto-approve bar and ships broken. We cannot trust
// that number. computeStructuralConfidence derives an HONEST score from facts
// the validators establish: how many populated fields actually validate, how
// many of the block's own signals ended up correctly filled, and how much
// repair the row needed. The funnel uses THIS score (not the LLM's) for its
// accept / escalate decision — the fully-automatic substitute for a human who
// would have eyeballed the row.
//
// Pure. No I/O.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { SignalTokens } from './signals'
import type { RepairOp } from './repair'
import { isEmailLike, isPhoneLike, isTimeLike, isDateLike, isNameLike, isPaxLike } from './field-validators'

/** Typed string fields that a validator can judge, with their expected check. */
const TYPED_FIELDS: Array<{ field: keyof ParsedBooking; ok: (v: string) => boolean }> = [
  { field: 'leadName', ok: isNameLike },
  { field: 'email', ok: isEmailLike },
  { field: 'phone', ok: isPhoneLike },
  { field: 'whatsapp', ok: isPhoneLike },
  { field: 'pickupTime', ok: isTimeLike },
  { field: 'tourDate', ok: isDateLike },
]

/**
 * Honest, computed confidence in [0,1]. Replaces the LLM's self-reported score
 * for routing. A row whose every populated field validates and whose every
 * block signal is filled scores ≥0.9 even if the LLM said 0.7; a row that
 * needed multiple re-route/clear repairs (a mis-map) drops below the 0.6 floor
 * and is escalated or excluded.
 */
export function computeStructuralConfidence(
  b: ParsedBooking,
  tokens: SignalTokens,
  repairs: RepairOp[],
): number {
  // ── field coverage: of the populated typed fields, how many validate? ──
  let populated = 0
  let valid = 0
  for (const { field, ok } of TYPED_FIELDS) {
    const v = b[field]
    if (typeof v === 'string' && v.trim().length > 0) {
      populated++
      if (ok(v)) valid++
    }
  }
  if (isPaxLike(b.partySize)) {
    populated++
    valid++
  }
  const fieldCoverage = populated === 0 ? 0 : valid / populated

  // ── signal coverage: of the signals the block carries, how many are filled
  //    with a value that validates? (no signals ⇒ nothing to miss ⇒ 1) ──
  const checks: boolean[] = []
  if (tokens.emails.length > 0) checks.push(!!b.email && isEmailLike(b.email))
  if (tokens.phones.length > 0) checks.push(!!b.phone && isPhoneLike(b.phone))
  if (tokens.whatsapps.length > 0) checks.push(!!b.whatsapp && isPhoneLike(b.whatsapp))
  if (tokens.dates.length > 0) checks.push(!!b.tourDate && isDateLike(b.tourDate))
  if (tokens.times.length > 0) checks.push(!!b.pickupTime && isTimeLike(b.pickupTime))
  const signalCoverage = checks.length === 0 ? 1 : checks.filter(Boolean).length / checks.length

  // ── repair penalty: a re-route/clear/pull means the LLM mis-typed a field
  //    (trust less); a plain fill of an omitted field is cheap and forgiven ──
  let penalty = 0
  for (const r of repairs) {
    penalty += r.kind === 'filled' ? 0.02 : 0.08
  }
  penalty = Math.min(penalty, 0.4)

  let score = 0.25 + 0.4 * fieldCoverage + 0.35 * signalCoverage - penalty

  // Hard cap: a row whose leadName is not a plausible name is almost always a
  // phantom header / mis-map. It must not clear the accept floor on the
  // strength of its other fields.
  if (!b.leadName || !isNameLike(b.leadName)) score = Math.min(score, 0.2)

  return clamp01(score)
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
