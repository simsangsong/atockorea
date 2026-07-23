// OTA email ingest — training batch 2026-06-23 (B): three GetYourGuide cruise
// booking emails. The third is a GROUP booking whose participant line reads
// "1 x Group up to 13 (9 Persons)" — the real headcount is the parenthesised
// "9 Persons", NOT the leading "1" (group units) or the "up to 13" cap.
//
// Deterministic (no DB / no LLM): strip forward envelope → adapter detect + parse.

import { stripEmailEnvelope } from '../email-envelope'
import { getYourGuideAdapter } from '../adapters/getyourguide'

const GYG_BUSAN_RAE = `-------- Forwarding messages --------
From: "GetYourGuide" <do-not-reply@notification.getyourguide.com>
Date: 2026-06-21 09:02:11
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Booking - S372901 - GYG2Q9KLYF34

Hi Supply Partner, great news!
Your offer has been booked:

(Return Assurance) Busan Small Group Cruise Shore Excursion
(Return Assurance) Busan Small Group Cruise Shore Excursion
Reference number: GYG2Q9KLYF34
Date: July 7, 2026 7:00 AM
Number of participants: 2 x Adults (Age 4 - 99)
Main customer: Rae Joyce
customer-mhmp7fbenuxf762y@reply.getyourguide.com
Phone: +61423208528
Language: English
Tour language: English (Live tour guide)
Price: ₩254,000

We're here to help`

const GYG_BUSAN_ASHWINITA = `-------- Forwarding messages --------
From: "GetYourGuide" <do-not-reply@notification.getyourguide.com>
Date: 2026-06-21 09:05:44
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Booking - S372902 - GYG7VKW4RFBB

Hi Supply Partner, great news!
Your offer has been booked:

(Guaranteed Return) Busan Shore Excursion for Cruise Guests
Group Tour for Busan Cruise Guests (Van or Bus)
Reference number: GYG7VKW4RFBB
Date: September 17, 2026 8:00 AM
Number of participants: 5 x Adults (Age 0 - 99)
Main customer: ashwinita brzeczek
customer-iidanl6yf74cdplt@reply.getyourguide.com
Phone: +61412621768
Language: English
Tour language: English (Live tour guide)
Price: ₩480,000

We're here to help`

const GYG_BUSAN_GROUP = `-------- Forwarding messages --------
From: "GetYourGuide" <do-not-reply@notification.getyourguide.com>
Date: 2026-06-21 09:09:30
To: "Heun Kim" <rrlagms2@gmail.com>
Subject: Booking - S372903 - GYGZGZZMRVHV

Hi Supply Partner, great news!
Your offer has been booked:

(Guaranteed Return) Busan Shore Excursion for Cruise Guests
Private Tour for Busan Cruise Guest (Max 13 Pax)
Reference number: GYGZGZZMRVHV
Date: July 5, 2026 10:00 AM
Number of participants: 1 x Group up to 13 (9 Persons)
Main customer: Kristine Laurel
customer-hkywm5qbupdxxg6f@reply.getyourguide.com
Phone: +17023088810
Language: English
Tour language: English (Live tour guide)
Price: ₩1,220,000

We're here to help`

describe('GYG cruise email — Rae Joyce / Busan (batch B)', () => {
  const { text } = stripEmailEnvelope(GYG_BUSAN_RAE)
  it('extracts every field (2 pax)', () => {
    const { bookings } = getYourGuideAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('GYG2Q9KLYF34')
    expect(b.leadName).toBe('Rae Joyce')
    expect(b.partySize).toBe(2)
    expect(b.tourDate).toBe('2026-07-07')
    expect(b.pickupTime).toBe('07:00')
    expect(b.phone).toBe('+61423208528')
    expect(b.language).toBe('en')
  })
})

describe('GYG cruise email — ashwinita brzeczek / Busan (batch B)', () => {
  const { text } = stripEmailEnvelope(GYG_BUSAN_ASHWINITA)
  it('extracts every field incl. lowercase lead name (5 pax)', () => {
    const { bookings } = getYourGuideAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('GYG7VKW4RFBB')
    expect(b.leadName?.toLowerCase()).toBe('ashwinita brzeczek')
    expect(b.partySize).toBe(5)
    expect(b.tourDate).toBe('2026-09-17')
    expect(b.pickupTime).toBe('08:00')
    expect(b.phone).toBe('+61412621768')
    expect(b.language).toBe('en')
  })
})

describe('GYG cruise email — Kristine Laurel / GROUP booking (batch B)', () => {
  const { text } = stripEmailEnvelope(GYG_BUSAN_GROUP)
  it('reads the parenthesised "9 Persons" as party size, not "1" or "13"', () => {
    const { bookings } = getYourGuideAdapter.parse(text)
    expect(bookings).toHaveLength(1)
    const b = bookings[0]
    expect(b.externalBookingId).toBe('GYGZGZZMRVHV')
    expect(b.leadName).toBe('Kristine Laurel')
    expect(b.partySize).toBe(9)
    expect(b.tourDate).toBe('2026-07-05')
    expect(b.pickupTime).toBe('10:00')
    expect(b.phone).toBe('+17023088810')
    expect(b.language).toBe('en')
  })
})
