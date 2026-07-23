// Phase 27 §45 Sprint 27.H — structural confidence unit tests.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { computeStructuralConfidence } from '../confidence'
import { extractSignalTokens } from '../signals'
import type { RepairOp } from '../repair'

function booking(p: Partial<ParsedBooking> & { leadName: string }): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'X',
    partySize: 2,
    confidenceScore: 0.5,
    issues: [],
    ...p,
  }
}

describe('computeStructuralConfidence', () => {
  it('scores a fully-validated, fully-covered row ≥0.9', () => {
    const block = 'John Smith\njohn@x.com\n+1 202 555 0101'
    const b = booking({ leadName: 'John Smith', email: 'john@x.com', phone: '+12025550101' })
    const score = computeStructuralConfidence(b, extractSignalTokens(block), [])
    expect(score).toBeGreaterThanOrEqual(0.9)
  })

  it('caps a row with an invalid leadName below the 0.6 floor', () => {
    const block = 'header\n+1 202 555 0101'
    const b = booking({ leadName: 'Name | Phone | Pickup', phone: '+12025550101' })
    const score = computeStructuralConfidence(b, extractSignalTokens(block), [])
    expect(score).toBeLessThan(0.6)
  })

  it('docks score when the block signals a field the row never filled', () => {
    const block = 'John Smith\njohn@x.com\n+1 202 555 0101' // phone+email signals
    const b = booking({ leadName: 'John Smith' }) // both contacts empty
    const score = computeStructuralConfidence(b, extractSignalTokens(block), [])
    expect(score).toBeLessThan(0.8)
  })

  it('penalizes re-route/clear repairs more than plain fills', () => {
    const block = 'John Smith\njohn@x.com'
    const b = booking({ leadName: 'John Smith', email: 'john@x.com' })
    const tok = extractSignalTokens(block)
    const fills: RepairOp[] = [{ field: 'phone', kind: 'filled' }]
    const reroutes: RepairOp[] = [{ field: 'phone', kind: 'rerouted' }]
    expect(computeStructuralConfidence(b, tok, fills)).toBeGreaterThan(
      computeStructuralConfidence(b, tok, reroutes),
    )
  })
})
