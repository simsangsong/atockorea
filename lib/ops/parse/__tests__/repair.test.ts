// Phase 27 §45 Sprint 27.H — auto-repair + structural rescore unit tests.
// Covers the three named real-world mis-map failure modes plus the cheap
// fill-from-block path that also rescues omitted LLM fields.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import { repairBooking, applyValidationRepair } from '../repair'

function booking(p: Partial<ParsedBooking> & { leadName: string }): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'X',
    partySize: 2,
    confidenceScore: 0.8, // LLM self-report — deliberately optimistic
    issues: [],
    ...p,
  }
}

describe('repairBooking — re-route mis-typed fields', () => {
  it('moves an email-shaped value out of phone into empty email', () => {
    const block = 'John Smith\njohn@x.com\n2명'
    const b = booking({ leadName: 'John Smith', phone: 'john@x.com' })
    const { booking: r, repairs } = repairBooking(b, block)
    expect(r.email).toBe('john@x.com')
    expect(r.phone).toBeUndefined()
    expect(repairs.some(x => x.field === 'phone' && x.kind === 'rerouted')).toBe(true)
  })

  it('replaces a name sitting in email with the block email token, or clears it', () => {
    const withToken = 'Maria Lopez\nmaria@y.com\n+34 600 123 456'
    const b = booking({ leadName: 'Maria Lopez', email: 'Maria Lopez', phone: '+34600123456' })
    const { booking: r } = repairBooking(b, withToken)
    expect(r.email).toBe('maria@y.com')

    const noToken = 'Maria Lopez\n+34 600 123 456'
    const b2 = booking({ leadName: 'Maria Lopez', email: 'Maria Lopez', phone: '+34600123456' })
    const { booking: r2 } = repairBooking(b2, noToken)
    expect(r2.email).toBeUndefined() // junk cleared, not shipped as an "email"
    expect(r2.notes ?? '').toContain('email?=')
  })
})

describe('repairBooking — pull-from-block (LLM omitted a signaled field)', () => {
  it('fills empty email/phone/date from the block ground truth', () => {
    const block = 'Wang Sihan\nEmail: wang@z.com\nPhone: +86 138 0000 1111\n2026-05-31'
    const b = booking({ leadName: 'Wang Sihan' }) // LLM left contacts empty
    const { booking: r, repairs } = repairBooking(b, block)
    expect(r.email).toBe('wang@z.com')
    expect(r.phone).toBe('+8613800001111')
    expect(r.tourDate).toBe('2026-05-31')
    expect(repairs.filter(x => x.kind === 'filled').length).toBeGreaterThanOrEqual(3)
  })
})

describe('applyValidationRepair — structural rescore drives accept/escalate', () => {
  it('a header row mis-mapped as leadName is forced below the 0.6 floor', () => {
    // The classic broken-first-tenant case: a header row became a booking.
    const blocks = ['이름 / 전화 / 픽업\n홍길동 / 010-1234-5678 / 신라호텔']
    const phantom = booking({
      leadName: '이름 / 전화 / 픽업',
      confidenceScore: 0.82, // LLM was "confident"
    })
    const [res] = applyValidationRepair([phantom], blocks)
    expect(res.structural).toBeLessThan(0.6)
    expect(res.booking.confidenceScore).toBe(res.structural)
  })

  it('a fully valid row scores high even when the LLM under-reported', () => {
    const blocks = ['John Smith\njohn@x.com\n+1 202 555 0101\n2026-05-31']
    const good = booking({
      leadName: 'John Smith',
      email: 'john@x.com',
      phone: '+12025550101',
      tourDate: '2026-05-31',
      confidenceScore: 0.7, // pessimistic LLM self-report
    })
    const [res] = applyValidationRepair([good], blocks)
    expect(res.structural).toBeGreaterThanOrEqual(0.9)
  })

  it('does not overwrite a valid deterministic value (fill-empty-only, #19)', () => {
    const blocks = ['John Smith\nEmail: other@x.com\n+1 202 555 0101']
    const b = booking({ leadName: 'John Smith', email: 'john@x.com', phone: '+12025550101' })
    const [res] = applyValidationRepair([b], blocks)
    expect(res.booking.email).toBe('john@x.com') // kept, not replaced by block token
  })
})
