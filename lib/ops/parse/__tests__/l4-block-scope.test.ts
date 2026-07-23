// Phase 27 §45 — L4 input scope reduction (cost).
//
// L4 (Sonnet) must re-extract ONLY the blocks Haiku did not confidently resolve,
// not the whole leftover. Re-sending the resolved blocks was wasted spend — the
// L4 dedup discarded those rows anyway, yet they were billed at Sonnet's 3×/15×
// rate. selectL4Blocks is the pure choke point; these tests pin its contract.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { selectL4Blocks } from '../funnel'

function bk(leadName: string): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: `MANUAL-${leadName}`,
    leadName,
    partySize: 1,
    confidenceScore: 0.8,
    issues: [],
  } as ParsedBooking
}

const BLOCKS = [
  'Alice  +82 10-1111-2222  Lotte Hotel',
  'Bob  +1 415 555 0000  Shilla',
  'Carol  cruise Costa Serena',
]

describe('selectL4Blocks', () => {
  it('returns only the blocks Haiku did NOT resolve', () => {
    // Haiku accepted Alice + Bob; Carol stayed low-confidence (no accepted row).
    const out = selectL4Blocks([bk('Alice'), bk('Bob')], BLOCKS)
    expect(out).toEqual([BLOCKS[2]])
  })

  it('returns every block when Haiku produced no accepted rows', () => {
    const out = selectL4Blocks([], BLOCKS)
    expect(out).toEqual(BLOCKS)
  })

  it('falls back to the full set when pairing marks every block resolved (degrade-safe)', () => {
    // Defensive: never skip a needed re-extract. If accepted rows somehow cover
    // all blocks, return the full set rather than an empty L4 input.
    const out = selectL4Blocks([bk('Alice'), bk('Bob'), bk('Carol')], BLOCKS)
    expect(out).toEqual(BLOCKS)
  })

  it('handles a single unresolved block among many resolved', () => {
    const out = selectL4Blocks([bk('Alice'), bk('Carol')], BLOCKS)
    expect(out).toEqual([BLOCKS[1]])
  })

  it('does not crash when an accepted row has no matching block (empty lead)', () => {
    const ghost = bk('')
    const out = selectL4Blocks([ghost, bk('Alice')], BLOCKS)
    // ghost (empty lead) falls back to its same-index block (BLOCKS[0]); Alice
    // also resolves to BLOCKS[0] by lead-name search. Only BLOCKS[0] is resolved.
    expect(out).toEqual([BLOCKS[1], BLOCKS[2]])
  })
})
