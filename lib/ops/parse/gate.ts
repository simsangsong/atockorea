// Phase 27 §45 Sprint 27.A — source-signal completeness gate + enrichment merge.
//
// The deterministic layers (L1/L2/L2.5) are a FIRST-PASS extractor, not a fast
// success path: if the source block carried a signal for a field the row left
// empty, that is not success — it is an enrichment target (master skill
// Hard Rule #18). This module is PURE (no I/O), so the gate + merge logic is
// unit-testable; the funnel does the LLM call + mutation.
//
//  • #17 — signals are READ from ParsedInputContext.signals (Sprint 0). No
//    second scanner here.
//  • #18 — only signal-present + field-empty rows are partials. signal-ABSENT
//    fields are NEVER flagged (genuinely absent → not sent to L3, no flooding).
//  • #19 — enrichment merge is fill-empty-only and block-scoped: it fills only
//    empty deterministic fields and NEVER overwrites a non-empty one
//    (deterministic wins; disagreement is recorded as a conflict for review).

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { splitBlocks, type ParsedInputContext, type BlockSignals } from './normalize'

export type SignalField = 'ship' | 'pickup' | 'phone' | 'email' | 'whatsapp' | 'date' | 'platform'

/** String fields enrichment is allowed to fill (fill-empty-only). partySize and
 *  ids are never merged — deterministic counts/keys are authoritative. */
type MergeableField =
  | 'cruiseShipText'
  | 'pickupPointRaw'
  | 'pickupTime'
  | 'phone'
  | 'email'
  | 'whatsapp'
  | 'language'
  | 'tourDate'
  | 'productName'
  | 'notes'

const MERGEABLE: MergeableField[] = [
  'cruiseShipText',
  'pickupPointRaw',
  'pickupTime',
  'phone',
  'email',
  'whatsapp',
  'language',
  'tourDate',
  'productName',
  'notes',
]

export interface PartialRow {
  /** Deterministic booking (a reference into the funnel's `all` array). */
  booking: ParsedBooking
  /** Source block — sent to L3 for enrichment. */
  block: string
  /** Fields the source signaled but the row left empty. */
  missingFields: SignalField[]
}

/**
 * Completeness gate. For each deterministic booking, attribute it to its source
 * block (by lead-name containment), read that block's Sprint-0 signals, and flag
 * fields the source signaled but the row left empty.
 */
export function completenessGate(input: {
  deterministicBookings: ParsedBooking[]
  ctx: ParsedInputContext
}): { partials: PartialRow[] } {
  const { deterministicBookings, ctx } = input
  const normBlocks = splitBlocks(ctx.normalized)
  const partials: PartialRow[] = []
  for (const booking of deterministicBookings) {
    const idx = findBlockIndex(booking, normBlocks)
    if (idx < 0) continue
    const sig = ctx.signals[idx]
    if (!sig) continue
    const missingFields = signaledButEmpty(booking, sig)
    if (missingFields.length > 0) partials.push({ booking, block: normBlocks[idx], missingFields })
  }
  return { partials }
}

export interface MergeResult {
  merged: ParsedBooking
  /** Empty deterministic fields filled from the enrichment result. */
  filledFields: string[]
  /** Fields where both sides were set and disagreed (deterministic kept). */
  conflicts: string[]
}

/**
 * Fill-empty-only, block-scoped merge (#19). Returns a NEW booking with empty
 * fields filled from `enriched`; non-empty deterministic values are preserved.
 */
export function mergeEnrichment(deterministic: ParsedBooking, enriched: ParsedBooking): MergeResult {
  const merged: ParsedBooking = { ...deterministic }
  const filledFields: string[] = []
  const conflicts: string[] = []
  for (const f of MERGEABLE) {
    const detVal = deterministic[f]
    const encVal = enriched[f]
    if (!nonEmpty(detVal) && nonEmpty(encVal)) {
      merged[f] = encVal
      filledFields.push(f)
    } else if (nonEmpty(detVal) && nonEmpty(encVal) && detVal !== encVal) {
      conflicts.push(f) // deterministic wins; surface for review
    }
  }
  // Platform is an enum, not a free string: 'manual' is the unrecognized
  // fallback, so treat it as empty and let a recognized OTA from L3 fill it
  // (fill-empty-only — a real deterministic platform is never overwritten).
  const detPlatEmpty = !deterministic.sourcePlatform || deterministic.sourcePlatform === 'manual'
  const encPlat = enriched.sourcePlatform
  if (detPlatEmpty && encPlat && encPlat !== 'manual') {
    merged.sourcePlatform = encPlat
    if (nonEmpty(enriched.sourcePlatformLabel ?? undefined)) {
      merged.sourcePlatformLabel = enriched.sourcePlatformLabel
    }
    filledFields.push('sourcePlatform')
  }
  return { merged, filledFields, conflicts }
}

/** Recompute which signaled fields are STILL empty after a merge. */
export function stillMissing(booking: ParsedBooking, fields: SignalField[]): SignalField[] {
  return fields.filter(f => isFieldEmpty(booking, f))
}

/**
 * Mark a row's unfilled signaled fields for review (#18 — a signal-present row
 * is never a silent success). Mutates `issues` in place (deduped).
 */
export function applyReviewFlags(booking: ParsedBooking, fields: SignalField[]): void {
  for (const f of fields) {
    const tag = `incomplete_${f}`
    if (!booking.issues.includes(tag)) booking.issues.push(tag)
  }
}

// ── internals ────────────────────────────────────────────────────────────────

function signaledButEmpty(b: ParsedBooking, sig: BlockSignals): SignalField[] {
  const out: SignalField[] = []
  if (sig.ship && isFieldEmpty(b, 'ship')) out.push('ship')
  if (sig.pickup && isFieldEmpty(b, 'pickup')) out.push('pickup')
  if (sig.phone && isFieldEmpty(b, 'phone')) out.push('phone')
  if (sig.email && isFieldEmpty(b, 'email')) out.push('email')
  if (sig.whatsapp && isFieldEmpty(b, 'whatsapp')) out.push('whatsapp')
  if (sig.date && isFieldEmpty(b, 'date')) out.push('date')
  if (sig.platform && isFieldEmpty(b, 'platform')) out.push('platform')
  return out
}

function isFieldEmpty(b: ParsedBooking, f: SignalField): boolean {
  switch (f) {
    case 'ship':
      return !nonEmpty(b.cruiseShipText)
    case 'pickup':
      return !nonEmpty(b.pickupPointRaw) && !nonEmpty(b.pickupPointNormalized)
    case 'phone':
      return !nonEmpty(b.phone)
    case 'email':
      return !nonEmpty(b.email)
    case 'whatsapp':
      return !nonEmpty(b.whatsapp)
    case 'date':
      return !nonEmpty(b.tourDate)
    case 'platform':
      // 'manual' (the unrecognized fallback) counts as empty so a block that
      // names an OTA but parsed to manual becomes an enrichment target.
      return (!b.sourcePlatform || b.sourcePlatform === 'manual')
        && !nonEmpty(b.sourcePlatformLabel ?? undefined)
  }
}

function findBlockIndex(b: ParsedBooking, blocks: string[]): number {
  if (!b.leadName || b.leadName.length < 2) return -1
  return blocks.findIndex(blk => blk.includes(b.leadName))
}

function nonEmpty(v: string | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}
