// Phase 27 §45 Sprint 27.H — auto-repair + structural rescore (no human).
//
// The product constraint is fully-automatic import: no operator reviews rows,
// ever. So when the LLM mis-maps a field, the system must CORRECT it itself,
// using the block's own deterministic tokens as ground truth — never "flag for
// a human". repairBooking does two things to each LLM-produced row:
//
//   1. Re-route mis-typed values: an email-shaped value sitting in `phone`
//      moves to `email` (if empty); a phone-shaped value in `email` moves to
//      `phone`; a value that validates as nothing recognized is parked in
//      `notes` (lossless) rather than left masquerading as a real field.
//   2. Pull-from-block: a field the block clearly carries a token for but the
//      LLM left empty (or filled with junk) is filled from extractSignalTokens.
//      The block's own email/phone/date/time is authoritative over the guess.
//
// applyValidationRepair then overwrites confidenceScore with the HONEST
// structural score (confidence.ts), so the funnel's accept/escalate decision
// runs on what actually validated — not on the LLM's self-report.
//
// Invariants:
//  • #17 — block tokens come from signals.extractSignalTokens (the one signal
//    source); no regex is authored here.
//  • #19 — fill-empty-only: pull/fill never overwrites a value that already
//    validates correctly. A re-route only moves INTO an empty target.
//  • Conservative: re-route only when the value strongly matches the
//    destination type AND its current field strongly rejects it, so a correct-
//    but-unusual value is left alone (tune against bulk-jeju corpus).
//
// Pure. No I/O.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { extractSignalTokens } from './signals'
import { computeStructuralConfidence } from './confidence'
import { isEmailLike, isPhoneLike, isTimeLike, isDateLike } from './field-validators'

export interface RepairOp {
  field: string
  /** rerouted: moved to another field · pulled: replaced junk with block token
   *  · cleared: junk removed (parked in notes) · filled: empty field topped up */
  kind: 'rerouted' | 'pulled' | 'cleared' | 'filled'
  detail?: string
}

export interface RepairResult {
  booking: ParsedBooking
  repairs: RepairOp[]
}

/** A row with its honest structural score and the repairs that produced it. */
export interface RepairedBooking {
  booking: ParsedBooking
  repairs: RepairOp[]
  /** confidenceScore at LLM emit time, before structural rescore (telemetry). */
  llmConfidence: number
  structural: number
}

/**
 * Repair one LLM-produced booking against its source block. Returns a NEW
 * booking (input not mutated) and the list of operations applied.
 */
export function repairBooking(input: ParsedBooking, sourceBlock: string): RepairResult {
  const tok = extractSignalTokens(sourceBlock)
  const b: ParsedBooking = { ...input, issues: [...input.issues] }
  const repairs: RepairOp[] = []
  const noteAdds: string[] = []

  // ── 1. fix mis-typed string fields ─────────────────────────────────────────

  // email holds a non-email value
  if (nonEmpty(b.email) && !isEmailLike(b.email!)) {
    if (isPhoneLike(b.email!) && !nonEmpty(b.phone)) {
      b.phone = b.email
      tag(repairs, b, 'email', 'rerouted', 'phone-shaped value moved to phone')
    } else if (tok.emails[0]) {
      b.email = tok.emails[0]
      tag(repairs, b, 'email', 'pulled')
    } else {
      noteAdds.push(`email?=${b.email}`)
      tag(repairs, b, 'email', 'cleared')
    }
    if (b.email && !isEmailLike(b.email)) b.email = tok.emails[0]
    if (b.email && !isEmailLike(b.email)) b.email = undefined
  }

  // phone holds a non-phone value
  if (nonEmpty(b.phone) && !isPhoneLike(b.phone!)) {
    if (isEmailLike(b.phone!) && !nonEmpty(b.email)) {
      b.email = b.phone!.toLowerCase()
      b.phone = tok.phones[0]
      tag(repairs, b, 'phone', 'rerouted', 'email-shaped value moved to email')
    } else if (tok.phones[0]) {
      b.phone = tok.phones[0]
      tag(repairs, b, 'phone', 'pulled')
    } else {
      noteAdds.push(`phone?=${b.phone}`)
      b.phone = undefined
      tag(repairs, b, 'phone', 'cleared')
    }
  }

  // whatsapp holds a non-phone value
  if (nonEmpty(b.whatsapp) && !isPhoneLike(b.whatsapp!)) {
    const repl = tok.whatsapps[0] ?? tok.phones[0]
    if (repl) {
      b.whatsapp = repl
      tag(repairs, b, 'whatsapp', 'pulled')
    } else {
      b.whatsapp = undefined
      tag(repairs, b, 'whatsapp', 'cleared')
    }
  }

  // pickupTime holds a non-time value
  if (nonEmpty(b.pickupTime) && !isTimeLike(b.pickupTime!)) {
    if (tok.times[0]) {
      b.pickupTime = tok.times[0]
      tag(repairs, b, 'pickupTime', 'pulled')
    } else {
      b.pickupTime = undefined
      tag(repairs, b, 'pickupTime', 'cleared')
    }
  }

  // tourDate holds a non-date value
  if (nonEmpty(b.tourDate) && !isDateLike(b.tourDate!)) {
    if (tok.dates[0]) {
      b.tourDate = tok.dates[0]
      tag(repairs, b, 'tourDate', 'pulled')
    } else {
      b.tourDate = undefined
      tag(repairs, b, 'tourDate', 'cleared')
    }
  }

  // ── 2. fill empty fields from block ground-truth tokens (#19 fill-empty) ────
  if (!nonEmpty(b.email) && tok.emails[0]) {
    b.email = tok.emails[0]
    tag(repairs, b, 'email', 'filled')
  }
  if (!nonEmpty(b.phone) && tok.phones[0]) {
    b.phone = tok.phones[0]
    tag(repairs, b, 'phone', 'filled')
  }
  if (!nonEmpty(b.whatsapp) && tok.whatsapps[0]) {
    b.whatsapp = tok.whatsapps[0]
    tag(repairs, b, 'whatsapp', 'filled')
  }
  if (!nonEmpty(b.tourDate) && tok.dates[0]) {
    b.tourDate = tok.dates[0]
    tag(repairs, b, 'tourDate', 'filled')
  }

  if (noteAdds.length > 0) {
    b.notes = [b.notes, ...noteAdds].filter(Boolean).join(' | ')
  }

  return { booking: b, repairs }
}

/**
 * Repair + structural-rescore a batch of LLM bookings, pairing each to its
 * source block (same lead-name heuristic the funnel uses elsewhere). The
 * returned bookings carry the HONEST structural score in confidenceScore; the
 * funnel filters/escalates on that. `repairs` is surfaced for metrics + the
 * failure corpus.
 */
export function applyValidationRepair(bookings: ParsedBooking[], blocks: string[]): RepairedBooking[] {
  return bookings.map((raw, i) => {
    const block = matchBlock(raw, blocks, i)
    const { booking, repairs } = repairBooking(raw, block)
    const tok = extractSignalTokens(block)
    const llmConfidence = booking.confidenceScore
    const structural = computeStructuralConfidence(booking, tok, repairs)
    booking.confidenceScore = structural
    return { booking, repairs, llmConfidence, structural }
  })
}

// ── internals ──────────────────────────────────────────────────────────────

function tag(repairs: RepairOp[], b: ParsedBooking, field: string, kind: RepairOp['kind'], detail?: string): void {
  repairs.push({ field, kind, detail })
  const issue = `repaired_${field}`
  if (!b.issues.includes(issue)) b.issues.push(issue)
}

function nonEmpty(v: string | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/** Same lead-name attribution the funnel uses (matchBlockForBooking / gate). */
function matchBlock(b: ParsedBooking, blocks: string[], idx: number): string {
  if (blocks[idx] && b.leadName && blocks[idx].includes(b.leadName)) return blocks[idx]
  if (b.leadName && b.leadName.length >= 2) {
    const hit = blocks.find(blk => blk.includes(b.leadName))
    if (hit) return hit
  }
  return blocks[idx] ?? blocks[0] ?? ''
}
