// OTA email ingest — forwarded-envelope stripping + GYG email-card parsing.
// CI guard for the 2026-06-21 slice (the live harness under tests/live/** is
// excluded from the default suite).

import { stripEmailEnvelope } from '../email-envelope'
import { getYourGuideAdapter } from '../adapters/getyourguide'

const GYG_EMAIL = `---- Forwarded Message ----
From: GetYourGuide <do-not-reply@notification.getyourguide.com>
Date: 06/16/2026 17:50
To: Heun Kim <rrlagms2@gmail.com>,
  Jisu Lee <lovekoreajs@gmail.com>,
  lovekorea Dev <lovekoreadv@gmail.com>
Subject: Booking - S372829 - GYG99625R33L

Hi Supply Partner, great news!
Your offer has been booked:

Jeju: East UNESCO Tour Seongsan, Haenyeo Show, Lava Tube
Reference number: GYG99625R33L
Date: June 26, 2026 8:30 AM
Number of participants: 1 x Adult (Age 0 - 99)
Main customer: Lilbeth Claessens
customer-pdit5467iqdsbg7g@reply.getyourguide.com
Phone: +33751062870
Language: French
Tour language: English (Live tour guide)
Pickup: Jeju International Airport, 2 Gonghang-ro, Cheju, Jeju-do, South Korea
Price: ₩80,000`

describe('stripEmailEnvelope', () => {
  it('removes the forward marker + header run (incl. wrapped To:) and keeps the body', () => {
    const { stripped, text } = stripEmailEnvelope(GYG_EMAIL)
    expect(stripped).toBe(true)
    // envelope gone
    expect(text).not.toMatch(/Forwarded Message/i)
    expect(text).not.toMatch(/^From:/m)
    expect(text).not.toMatch(/^Subject:/m)
    expect(text).not.toContain('do-not-reply@notification.getyourguide.com')
    expect(text).not.toContain('rrlagms2@gmail.com') // wrapped To: continuation
    // body intact
    expect(text).toMatch(/^Hi Supply Partner/)
    expect(text).toContain('Reference number: GYG99625R33L')
  })

  it('preserves a body "Date:" line (the tour date) — only the envelope Date is stripped', () => {
    const { text } = stripEmailEnvelope(GYG_EMAIL)
    expect(text).toContain('Date: June 26, 2026 8:30 AM') // body tour date kept
    expect(text).not.toContain('06/16/2026 17:50') // envelope forward date gone
  })

  it('is a no-op on a plain operator paste (no marker, no header block)', () => {
    const paste = 'John Smith (2명) - 클룩 - ABC123\n동쪽 - Lotte Hotel'
    const { stripped, text } = stripEmailEnvelope(paste)
    expect(stripped).toBe(false)
    expect(text).toBe(paste)
  })
})

describe('getYourGuideAdapter — email card', () => {
  const body = stripEmailEnvelope(GYG_EMAIL).text

  it('detects the single-booking email above threshold', () => {
    expect(getYourGuideAdapter.detect(body)).toBeGreaterThanOrEqual(0.8)
  })

  it('extracts the customer (not the product title) as leadName, with full fields', () => {
    const { bookings } = getYourGuideAdapter.parse(body)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.leadName).toBe('Lilbeth Claessens')
    expect(b.productName).toContain('East UNESCO Tour')
    expect(b.externalBookingId).toBe('GYG99625R33L')
    expect(b.tourDate).toBe('2026-06-26') // month-name date parsed deterministically
    expect(b.pickupTime).toBe('08:30') // AM time off the Date line
    expect(b.partySize).toBe(1)
    expect(b.phone).toBe('+33751062870')
    expect(b.language).toBe('fr')
    expect(b.pickupPointRaw).toMatch(/Jeju International Airport/)
  })
})
