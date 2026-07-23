import { klookAdapter } from '../klook'

describe('klookAdapter — Korean operator paste format', () => {
  it('extracts leadName from inline "(인원수 x N 명)" pattern', () => {
    const block = [
      '4번. 서남쪽 - LOTTE City Hotel Jeju',
      'Visvam Sachin Vedarathinam (인원수 x 3 명)  - 클룩 - QPA302488',
      'English',
      '비고:',
      'sachin.visvam@gmail.com',
      '+82-1056813776',
      'WhatsApp: 821056813776',
    ].join('\n')
    const out = klookAdapter.parse(block)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].leadName).toBe('Visvam Sachin Vedarathinam')
    expect(out.bookings[0].partySize).toBe(3)
    expect(out.bookings[0].externalBookingId).toBe('QPA302488')
  })

  it('does NOT confuse "Customer-…@reply.…" pattern as leadName', () => {
    // Klook doesn't normally use the reply.getyourguide.com proxy but the
    // labeled-lead regex previously aliased on any "Customer" prefix.
    const block = [
      'Joy Park (인원수 x 2 명)  - 클룩 - SHG596977',
      'Customer-shouldnotbecaught@example.com',
      '+1-2135030187',
    ].join('\n')
    const out = klookAdapter.parse(block)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].leadName).toBe('Joy Park')
  })

  it('extracts pickup from "Nth. region - LOCATION" header line', () => {
    const block = [
      '6번. 서남쪽 - LOTTE City Hotel Jeju',
      'Joy Park (인원수 x 2 명)  - 클룩 - SHG596977',
      'English 비고:',
      'joyjpark5@gmail.com',
      '+1-2135030187',
    ].join('\n')
    const out = klookAdapter.parse(block)
    expect(out.bookings[0].pickupPointRaw).toBe('LOTTE City Hotel Jeju')
  })

  it('strips inline pickupTime from header', () => {
    const block = [
      '8번. 동쪽 - [08:55] Lotte city Hotel jeju',
      'wong Mavis (2 명)  - 클룩 - TKY453520',
      'Chinese 비고:',
      '224mavis@gmail.com',
      '+852-98084961',
    ].join('\n')
    const out = klookAdapter.parse(block)
    expect(out.bookings[0].pickupTime).toBe('08:55')
  })
})
