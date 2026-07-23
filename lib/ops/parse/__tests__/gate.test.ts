// Phase 27 §45 Sprint 27.A — completeness gate + enrichment merge unit tests.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { completenessGate, mergeEnrichment, stillMissing, applyReviewFlags } from '../gate'
import { buildInputContext } from '../normalize'

function booking(p: Partial<ParsedBooking> & { leadName: string }): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'X',
    partySize: 1,
    confidenceScore: 0.92,
    issues: [],
    ...p,
  }
}

describe('completenessGate', () => {
  // B0 has phone+email signals; B1 has a ship signal; B2 has no signals.
  const ctx = buildInputContext(
    ['John Smith\n+1 202 555 0101\njohn@x.com', 'Jane Doe\nDiamond Princess cruise', 'Bob Lee'].join('\n\n'),
  )

  it('flags signal-present but field-empty rows as partials', () => {
    const bk0 = booking({ leadName: 'John Smith' }) // phone+email empty
    const bk1 = booking({ leadName: 'Jane Doe' }) // ship empty
    const { partials } = completenessGate({ deterministicBookings: [bk0, bk1], ctx })
    expect(partials.length).toBe(2)
    const p0 = partials.find(p => p.booking === bk0)!
    expect(p0.missingFields.sort()).toEqual(['email', 'phone'])
    const p1 = partials.find(p => p.booking === bk1)!
    expect(p1.missingFields).toEqual(['ship'])
  })

  it('does NOT flag a field that is already filled', () => {
    const bk = booking({ leadName: 'John Smith', phone: '12025550101', email: 'john@x.com' })
    const { partials } = completenessGate({ deterministicBookings: [bk], ctx })
    expect(partials).toEqual([])
  })

  it('does NOT flag a signal-ABSENT block (genuinely absent → no L3 flooding, #18)', () => {
    // Bob Lee's block carries no phone/email/ship signal, so an empty phone is
    // not a partial — it must never be sent to L3.
    const bk = booking({ leadName: 'Bob Lee' })
    const { partials } = completenessGate({ deterministicBookings: [bk], ctx })
    expect(partials).toEqual([])
  })

  it('does not flag a pickup that is present', () => {
    const c = buildInputContext('1. 남쪽 - Lotte City Hotel Jeju\nHong Gildong')
    const bk = booking({ leadName: 'Hong Gildong', pickupPointRaw: 'Lotte City Hotel Jeju' })
    expect(completenessGate({ deterministicBookings: [bk], ctx: c }).partials).toEqual([])
  })

  it('flags a tour date the block carried but the row left empty', () => {
    // Korean date avoids the bare-phone signal that an ISO 2026-05-31 trips.
    const c = buildInputContext('Amy Park\nKlook\n5월 31일')
    const bk = booking({ leadName: 'Amy Park' }) // tourDate + platform empty (manual)
    const { partials } = completenessGate({ deterministicBookings: [bk], ctx: c })
    expect(partials[0]?.missingFields.sort()).toEqual(['date', 'platform'])
  })

  it('does NOT flag platform when the row already parsed an OTA', () => {
    const c = buildInputContext('Amy Park\nKlook')
    const bk = booking({ leadName: 'Amy Park', sourcePlatform: 'klook' })
    expect(completenessGate({ deterministicBookings: [bk], ctx: c }).partials).toEqual([])
  })
})

describe('mergeEnrichment — fill-empty-only, deterministic wins (#19)', () => {
  it('fills empty fields, never overwrites a non-empty deterministic value', () => {
    const deterministic = booking({ leadName: 'John', email: 'det@x.com' }) // phone empty, email set
    const enriched = booking({ leadName: 'John', phone: '12025550101', email: 'llm@y.com', pickupPointRaw: 'Hotel' })
    const { merged, filledFields, conflicts } = mergeEnrichment(deterministic, enriched)
    expect(merged.phone).toBe('12025550101') // filled (was empty)
    expect(merged.pickupPointRaw).toBe('Hotel') // filled (was empty)
    expect(merged.email).toBe('det@x.com') // deterministic preserved
    expect(filledFields.sort()).toEqual(['phone', 'pickupPointRaw'])
    expect(conflicts).toContain('email') // disagreement surfaced, deterministic kept
  })

  it('does not mutate the deterministic input', () => {
    const deterministic = booking({ leadName: 'John' })
    mergeEnrichment(deterministic, booking({ leadName: 'John', phone: '999' }))
    expect(deterministic.phone).toBeUndefined()
  })

  it('fills tour date from L3 and upgrades a manual platform to a recognized OTA', () => {
    const deterministic = booking({ leadName: 'John' }) // sourcePlatform 'manual', tourDate empty
    const enriched = booking({ leadName: 'John', sourcePlatform: 'klook', tourDate: '2026-05-31' })
    const { merged, filledFields } = mergeEnrichment(deterministic, enriched)
    expect(merged.tourDate).toBe('2026-05-31')
    expect(merged.sourcePlatform).toBe('klook')
    expect(filledFields.sort()).toEqual(['sourcePlatform', 'tourDate'])
  })

  it('never overwrites a real deterministic platform (fill-empty-only)', () => {
    const deterministic = booking({ leadName: 'John', sourcePlatform: 'gyg' })
    const enriched = booking({ leadName: 'John', sourcePlatform: 'klook' })
    const { merged, filledFields } = mergeEnrichment(deterministic, enriched)
    expect(merged.sourcePlatform).toBe('gyg')
    expect(filledFields).not.toContain('sourcePlatform')
  })
})

describe('stillMissing + applyReviewFlags', () => {
  it('stillMissing recomputes empties after a partial fill', () => {
    const bk = booking({ leadName: 'John', phone: '12025550101' }) // ship still empty
    expect(stillMissing(bk, ['phone', 'ship'])).toEqual(['ship'])
  })

  it('applyReviewFlags marks unfilled fields without duplicating (#18 — not silent)', () => {
    const bk = booking({ leadName: 'John' })
    applyReviewFlags(bk, ['ship', 'phone'])
    applyReviewFlags(bk, ['ship']) // idempotent
    expect(bk.issues).toEqual(['incomplete_ship', 'incomplete_phone'])
  })
})
