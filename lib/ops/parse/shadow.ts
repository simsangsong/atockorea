// Phase 27 §45 (learning loop, Sprint D follow-through) — shadow-rule agreement
// scoring. THE missing link that lets the statistical promotion path (Hard Rule
// #20: match_count ≥ 100, success_count ≥ 0.95·match_count) ever fire from real
// traffic.
//
// The problem this closes: mined rules are created at status='shadow', but
// nothing ever evaluated them against live imports, so success_count stayed 0 →
// meetsStatThreshold() was always false → the only promotion path was a manual
// override reason. The compound lever (LLM resolves a shape → mine a rule → rule
// goes active → that shape is free forever) never turned automatically.
//
// How it turns now: on every import, AFTER the LLM resolves the ambiguous blocks
// (the ground truth), we replay the tenant's SHADOW rules over those same blocks
// and compare. A shadow rule that reproduces the LLM's core extraction accrues a
// success; a match that contradicts it accrues a plain match. Over enough imports
// of a recurring shape, a faithful rule crosses the threshold and becomes
// promotion-eligible WITHOUT an override — data, not a typed reason.
//
// Invariants:
//  • Behavior-neutral — shadow rules NEVER emit into the parse result. This module
//    is pure scoring + a best-effort stat write; the funnel output is unchanged.
//  • #20-aligned — only `match`/`success` counters move; promotion still requires
//    the admin transition + the governance gate. We never flip status here.
//  • Best-effort — any error (RPC absent before migration, RLS, network) no-ops.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { applyRuleToBlock, type ActiveRule } from './rules'

export interface GroundTruthPair {
  block: string
  /** The LLM-resolved booking for this block (the agreement target). */
  expected: ParsedBooking
}

export interface ShadowStat {
  rule_id: string
  /** Times the rule matched a ground-truth block this import. */
  matched: number
  /** Of those, times it AGREED with the LLM's core extraction. */
  agreed: number
}

/**
 * Pure: replay each shadow rule over every ground-truth block, tallying matches
 * and agreements. Returns one entry per rule that matched at least once.
 */
export function scoreShadowRules(rules: ActiveRule[], pairs: GroundTruthPair[]): ShadowStat[] {
  const out: ShadowStat[] = []
  for (const rule of rules) {
    let matched = 0
    let agreed = 0
    for (const { block, expected } of pairs) {
      const got = applyRuleToBlock(rule, block)
      if (!got) continue
      matched++
      if (agreesOnCore(got, expected)) agreed++
    }
    if (matched > 0) out.push({ rule_id: rule.id, matched, agreed })
  }
  return out
}

/**
 * Agreement = the shadow rule reproduces the LLM's IDENTITY (lead name + party
 * size) AND contradicts none of the fields both populated (phone / email / date).
 * Lenient on absence (a field one side left empty is not a contradiction) but
 * strict on conflict — a rule that grabs the wrong name/pax/phone never accrues a
 * success, so it can never cross the promotion threshold.
 */
export function agreesOnCore(got: ParsedBooking, expected: ParsedBooking): boolean {
  if (!leadNamesMatch(got.leadName, expected.leadName)) return false
  if (got.partySize !== expected.partySize) return false
  if (conflicts(digits(got.phone), digits(expected.phone))) return false
  if (conflicts(lower(got.email), lower(expected.email))) return false
  if (conflicts(got.tourDate?.trim(), expected.tourDate?.trim())) return false
  return true
}

// ── internals ────────────────────────────────────────────────────────────────

function leadNamesMatch(a: string | undefined, b: string | undefined): boolean {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function normName(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Two optional values conflict only when BOTH are present and differ. */
function conflicts(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a !== b
}

function digits(s: string | undefined): string | undefined {
  if (!s) return undefined
  const d = s.replace(/\D/g, '')
  return d.length >= 7 ? d : undefined
}

function lower(s: string | undefined): string | undefined {
  return s ? s.toLowerCase().trim() : undefined
}

/**
 * Best-effort atomic stat write. Increments match_count / success_count on the
 * tenant's SHADOW rules via the increment_parse_rule_stats RPC (tenant-scoped,
 * shadow-only, race-safe). No-ops if the RPC is absent (migration unapplied) or
 * on any error — never affects the parse response.
 */
export async function persistShadowStats(
  supabase: SupabaseClient,
  tenantId: string,
  stats: ShadowStat[],
): Promise<void> {
  if (stats.length === 0) return
  try {
    await supabase.rpc('increment_ops_parse_rule_stats', {
      p_tenant_id: tenantId,
      p_stats: stats,
    })
  } catch {
    // best-effort
  }
}

/**
 * Convenience: load shadow rules, score them against the LLM ground truth, and
 * persist. Returns the stats for telemetry. Fully best-effort.
 */
export async function recordShadowAgreement(
  supabase: SupabaseClient,
  tenantId: string,
  loadShadowRules: (s: SupabaseClient, t: string) => Promise<ActiveRule[]>,
  pairs: GroundTruthPair[],
): Promise<ShadowStat[]> {
  if (pairs.length === 0) return []
  try {
    const rules = await loadShadowRules(supabase, tenantId)
    if (rules.length === 0) return []
    const stats = scoreShadowRules(rules, pairs)
    await persistShadowStats(supabase, tenantId, stats)
    return stats
  } catch {
    return []
  }
}
