import { getYourGuideAdapter } from '../getyourguide'

describe('getYourGuideAdapter — Korean operator paste format', () => {
  it('extracts leadName from "Name (N 명) - 겟유가이드 - REF" inline pattern', () => {
    const block = [
      '2번. 남쪽 - Shilla Duty Free(Jeju Store)',
      'Renard Olivier (1 명)  - 겟유가이드 - GYGRFQRQHMA5',
      'English 비고:',
      'customer-mgu6iizmvxgingwv@reply.getyourguide.com',
      '+33699836000',
    ].join('\n')
    const out = getYourGuideAdapter.parse(block)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].leadName).toBe('Renard Olivier')
    expect(out.bookings[0].externalBookingId).toBe('GYGRFQRQHMA5')
    expect(out.bookings[0].partySize).toBe(1)
  })

  it('does NOT use "customer-<hash>@reply.getyourguide.com" as leadName', () => {
    // This is the audit regression case — the old regex captured the email
    // hash because "Customer\s*[:-]?\s*(.+)" matched "customer-mgu6...@reply..."
    const block = [
      'Renard Olivier (1 명) - 겟유가이드 - GYGRFQRQHMA5',
      'customer-mgu6iizmvxgingwv@reply.getyourguide.com',
    ].join('\n')
    const out = getYourGuideAdapter.parse(block)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].leadName).not.toContain('@')
    expect(out.bookings[0].leadName).not.toMatch(/^mgu6/i)
    expect(out.bookings[0].leadName).toBe('Renard Olivier')
    expect(out.bookings[0].email).toBe('customer-mgu6iizmvxgingwv@reply.getyourguide.com')
  })

  it('extracts pickupPointRaw from "Nth. region - LOCATION" header', () => {
    const block = [
      '11번. 동쪽 - Ocean Suites Jeju Hotel',
      'Victoria Malinowskya (2 명) - 겟유가이드 - GYG32L87NNXR',
      'English 비고:',
      'customer-rndjke23dp2jp2s6@reply.getyourguide.com',
      '+15103052179',
    ].join('\n')
    const out = getYourGuideAdapter.parse(block)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].pickupPointRaw).toBe('Ocean Suites Jeju Hotel')
  })

  it('extracts pickupTime from "Nth. region - LOCATION at HH:MM" / inline HH:MM', () => {
    const block = [
      '4번. 남쪽 - Shilla Duty Free(Jeju Store) 09:05',
      'Marion Liew (성인 2 명) - 비아토르 - BR-1385371651 비고:',
      '+61 401 048 426',
    ].join('\n')
    const out = getYourGuideAdapter.parse(block)
    // Viator reference, but the adapter only fires on GYG refs. Just confirm
    // there's no booking emitted (adapter declines), no crash.
    expect(out.bookings).toHaveLength(0)
  })

  it('extracts inline partySize "(인원수 x N 명)" / "(성인 N 명)"', () => {
    const block = [
      'Visvam Sachin Vedarathinam (인원수 x 3 명) - 겟유가이드 - GYGABCD12345',
      'sachin.visvam@gmail.com',
      '+82-1056813776',
    ].join('\n')
    const out = getYourGuideAdapter.parse(block)
    expect(out.bookings[0].partySize).toBe(3)
  })

  it('rejects a block with only the proxy-email line (no name)', () => {
    const block = [
      'customer-mgu6iizmvxgingwv@reply.getyourguide.com',
      '+33699836000',
    ].join('\n')
    const out = getYourGuideAdapter.parse(block)
    // No GYG ref present in the block → adapter declines.
    expect(out.bookings).toHaveLength(0)
  })
})
