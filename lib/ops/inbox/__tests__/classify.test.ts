// Slice 2 — deterministic inbox channel + intent classification (plan A-3/A-4).

import { classifyChannel, classifyIntent, classifyInbound } from '../classify'

describe('classifyChannel', () => {
  it('maps OTA sender domains', () => {
    expect(classifyChannel('no-reply@klook.com', '')).toBe('klook')
    expect(classifyChannel('bookings@notifications.viator.com', '')).toBe('viator')
    expect(classifyChannel('supplier@getyourguide.com', '')).toBe('gyg')
    expect(classifyChannel('noreply@kkday.com', '')).toBe('kkday')
    expect(classifyChannel('orders@atockorea.com', '')).toBe('atoc')
  })

  it('falls back to subject keywords for Gmail-forwarded OTA mail (plan A-1)', () => {
    expect(classifyChannel('simsangsong@gmail.com', 'Fwd: [Klook] New booking received')).toBe('klook')
    expect(classifyChannel('simsangsong@gmail.com', 'Fwd: GetYourGuide booking confirmation')).toBe('gyg')
    expect(classifyChannel('simsangsong@gmail.com', 'Fwd: Viator - New booking')).toBe('viator')
    expect(classifyChannel('simsangsong@gmail.com', 'Fwd: KKday 新訂單')).toBe('kkday')
  })

  it('detects atoc own-confirmation via booking reference pattern', () => {
    expect(classifyChannel('someone@gmail.com', 'Your booking A2C-B4542D3E is confirmed')).toBe('atoc')
  })

  it('scans the body excerpt when subject is opaque', () => {
    expect(classifyChannel('fw@gmail.com', 'FW:', 'Thank you for booking with Klook! Ref KLK123')).toBe('klook')
  })

  it('returns unknown for unrelated senders', () => {
    expect(classifyChannel('newsletter@random.io', 'Weekly deals')).toBe('unknown')
    expect(classifyChannel(null, '')).toBe('unknown')
    // Must NOT substring-match lookalike domains.
    expect(classifyChannel('x@notklook.com.evil.io', '')).toBe('unknown')
  })
})

describe('classifyIntent', () => {
  it('cancel outranks everything', () => {
    expect(classifyIntent('Booking cancelled - #KLK-123')).toBe('cancel')
    expect(classifyIntent('Booking canceled and refunded')).toBe('cancel')
    expect(classifyIntent('예약 취소 안내')).toBe('cancel')
  })

  it('change ranks above confirm', () => {
    expect(classifyIntent('Booking amendment: date change')).toBe('change')
    expect(classifyIntent('Your booking was rescheduled')).toBe('change')
    expect(classifyIntent('예약 변경 안내')).toBe('change')
  })

  it('confirm keywords', () => {
    expect(classifyIntent('New booking: Jeju East Bus Tour')).toBe('confirm')
    expect(classifyIntent('Booking confirmation - voucher attached')).toBe('confirm')
    expect(classifyIntent('예약 확정')).toBe('confirm')
  })

  it('known channel + booking-ish subject defaults to confirm', () => {
    expect(classifyIntent('Ref GYGVXNMRE9 - Mr. Kim', '', 'gyg')).toBe('confirm')
  })

  it('unknown channel with no intent keyword is unrelated', () => {
    expect(classifyIntent('Weekly product newsletter', '', 'unknown')).toBe('unrelated')
    expect(classifyIntent('', '', 'unknown')).toBe('unrelated')
  })
})

describe('classifyInbound', () => {
  it('combines channel + intent deterministically', () => {
    expect(
      classifyInbound({ fromEmail: 'no-reply@klook.com', subject: 'New booking received' }),
    ).toEqual({ channel: 'klook', intent: 'confirm' })
  })

  it('unrelated marketing mail short-circuits', () => {
    expect(
      classifyInbound({ fromEmail: 'promo@random.io', subject: 'Big summer sale!' }),
    ).toEqual({ channel: 'unknown', intent: 'unrelated' })
  })
})
