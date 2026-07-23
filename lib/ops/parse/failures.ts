// Phase 27 §45 Sprint 27.B-lite — failure intelligence.
//
// Final unparsed leftover blocks (and, from Sprint A, source-signal-present
// partials) are first-class, MASKED training data, not "fix it in the review
// UI" (master skill Hard Rule #21). This module turns the funnel's end-state
// into masked `parse_failures` rows.
//
// `buildFinalLeftoverFailures` is PURE (no I/O) so it is unit-testable. It READS
// the Sprint 27.0 `ParsedInputContext.signals` to set `source_signal_present`
// — it does NOT recompute signals (Hard Rule #17, single source of truth).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { maskLine, type DictEntry } from './mask'
import { splitBlocks, type ParsedInputContext, type BlockSignals } from './normalize'

/** Cap on the masked excerpt stored per failure (avoid bloating the table). */
const MAX_EXCERPT = 2000

export interface ParseFailureRecord {
  rawLineMasked: string
  shape: string
  layer: string
  failedField: string | null
  reason: string | null
  ruleId: string | null
  sourcePlatform: string | null
  sourceSignalPresent: boolean
}

/**
 * Derive failure records for blocks that reached L3 but no LLM booking was
 * attributed to them (the genuinely-unparsed leftover). Pure — masking only,
 * no Supabase. Returns [] when nothing failed.
 */
export function buildFinalLeftoverFailures(input: {
  leftoverBlocks: string[]
  llmBookings: ParsedBooking[]
  ctx: ParsedInputContext
  dict?: DictEntry[]
}): ParseFailureRecord[] {
  const { leftoverBlocks, llmBookings, ctx, dict = [] } = input
  if (leftoverBlocks.length === 0) return []

  // Map normalized block text → its 27.0 signals (read, never recompute).
  const normBlocks = splitBlocks(ctx.normalized)
  const signalByBlock = new Map<string, BlockSignals>()
  normBlocks.forEach((b, i) => {
    if (ctx.signals[i]) signalByBlock.set(b, ctx.signals[i])
  })

  const records: ParseFailureRecord[] = []
  for (const block of leftoverBlocks) {
    if (isAttributed(block, llmBookings)) continue
    const sig = signalByBlock.get(block.trim())
    records.push({
      rawLineMasked: maskLine(block, dict).masked.slice(0, MAX_EXCERPT),
      shape: ctx.shape,
      layer: 'final_leftover',
      failedField: null,
      reason: 'unparsed_block',
      ruleId: null,
      sourcePlatform: null,
      sourceSignalPresent: sig ? anySignal(sig) : false,
    })
  }
  return records
}

/**
 * Sprint 27.A — failure records for deterministic partials whose signaled field
 * was STILL empty after the enrichment pass (or was over the per-import
 * enrichment cap). One record per missing field. source_signal_present is true
 * by definition (a partial only exists because the source carried the signal).
 */
export function buildPartialFailureRecords(input: {
  partials: Array<{ block: string; fields: string[]; reason: string }>
  shape: string
  dict?: DictEntry[]
}): ParseFailureRecord[] {
  const { partials, shape, dict = [] } = input
  const records: ParseFailureRecord[] = []
  for (const p of partials) {
    if (p.fields.length === 0) continue
    const masked = maskLine(p.block, dict).masked.slice(0, MAX_EXCERPT)
    for (const field of p.fields) {
      records.push({
        rawLineMasked: masked,
        shape,
        layer: 'partial',
        failedField: field,
        reason: p.reason,
        ruleId: null,
        sourcePlatform: null,
        sourceSignalPresent: true,
      })
    }
  }
  return records
}

/** A leftover block is "handled" if an LLM booking's lead name appears in it. */
function isAttributed(block: string, bookings: ParsedBooking[]): boolean {
  return bookings.some(b => b.leadName && b.leadName.length >= 2 && block.includes(b.leadName))
}

// Hard Rule #18 — a block that names an OTA channel (`platform`) is carrying
// extractable booking signal just as surely as one with a phone/email. A
// platform-first roster row ("klook / Name / Jeju / 6 / Hotel") has no labeled
// phone/email/pickup, so the original phone||email||…||pickup test mislabeled it
// source_signal_present=false ("genuinely absent, normal") and let it escape the
// failure-intelligence review path. `date` is deliberately NOT counted: it is
// noisy (DATE_SIGNAL_RE matches address fragments like "22-13") and a bare-date
// announcement/section-header line carries no booking to miss.
function anySignal(s: BlockSignals): boolean {
  return s.phone || s.email || s.whatsapp || s.ship || s.pickup || s.platform
}

/**
 * Persist failure records (best-effort). Errors are swallowed so a single failed
 * insert — or the table not existing yet pre-migration — never blocks the
 * user-facing import response. raw_line_masked is already PII-free (maskLine).
 */
export async function recordParseFailures(
  supabase: SupabaseClient,
  tenantId: string,
  records: ParseFailureRecord[],
): Promise<void> {
  if (records.length === 0) return
  try {
    await supabase.from('ops_parse_failures').insert(
      records.map(r => ({
        tenant_id: tenantId,
        raw_line_masked: r.rawLineMasked,
        shape: r.shape,
        layer: r.layer,
        failed_field: r.failedField,
        reason: r.reason,
        rule_id: r.ruleId,
        source_platform: r.sourcePlatform,
        source_signal_present: r.sourceSignalPresent,
      })),
    )
  } catch {
    // best-effort
  }
}
