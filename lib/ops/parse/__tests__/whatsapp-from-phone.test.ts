import {
  phoneImpliesWhatsApp,
  toWhatsAppString,
  inferWhatsappFromPhone,
  propagateCountryCode,
} from '../whatsapp-from-phone'
import type { ParsedBooking } from '@/lib/ops/parse/types'

function makeBooking(p: Partial<ParsedBooking>): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: p.externalBookingId ?? 'ID-1',
    leadName: p.leadName ?? 'X',
    partySize: p.partySize ?? 1,
    confidenceScore: p.confidenceScore ?? 0.9,
    issues: [],
    ...p,
  } as ParsedBooking
}

describe('phoneImpliesWhatsApp', () => {
  it('accepts WhatsApp-dominant international mobile formats', () => {
    expect(phoneImpliesWhatsApp('+18016744017')).toBe(true)   // US
    expect(phoneImpliesWhatsApp('+1 510-673-7381')).toBe(true) // US (Viator)
    expect(phoneImpliesWhatsApp('+358 50 3312947')).toBe(true) // Finland
    expect(phoneImpliesWhatsApp('+447921803750')).toBe(true)   // UK
    expect(phoneImpliesWhatsApp('+971585883682')).toBe(true)   // UAE
    expect(phoneImpliesWhatsApp('+61403965725')).toBe(true)    // Australia
    expect(phoneImpliesWhatsApp('+49 1786916170')).toBe(true)  // Germany
    expect(phoneImpliesWhatsApp('+886 0928702425')).toBe(true) // Taiwan
  })

  it('accepts Korean numbers (+82) for operator WhatsApp CTAs', () => {
    expect(phoneImpliesWhatsApp('+82-10-1234-5678')).toBe(true)
    expect(phoneImpliesWhatsApp('+821012345678')).toBe(true)
    expect(phoneImpliesWhatsApp('82-01096605447')).toBe(true)
    expect(phoneImpliesWhatsApp('01096605447')).toBe(true)
  })

  it('rejects Japanese numbers (+81) — LINE territory', () => {
    expect(phoneImpliesWhatsApp('+81-90-1234-5678')).toBe(false)
  })

  it('rejects Mainland China (+86) — WhatsApp blocked, WeChat used', () => {
    expect(phoneImpliesWhatsApp('+86 138 1234 5678')).toBe(false)
  })

  it('rejects empty / too-short / too-long', () => {
    expect(phoneImpliesWhatsApp(null)).toBe(false)
    expect(phoneImpliesWhatsApp(undefined)).toBe(false)
    expect(phoneImpliesWhatsApp('')).toBe(false)
    expect(phoneImpliesWhatsApp('123')).toBe(false)
    expect(phoneImpliesWhatsApp('1234567890123456')).toBe(false) // 16 digits
  })
})

describe('toWhatsAppString', () => {
  it('normalizes to digits-with-leading-plus', () => {
    expect(toWhatsAppString('+1 510-673-7381')).toBe('+15106737381')
    expect(toWhatsAppString('+358 50 3312947')).toBe('+358503312947')
  })

  it('returns null when out-of-range', () => {
    expect(toWhatsAppString('123')).toBe(null)
  })
})

describe('inferWhatsappFromPhone', () => {
  it('fills whatsapp from a non-Korean international phone', () => {
    const bookings = [
      makeBooking({ phone: '+18016744017', whatsapp: undefined }),
      makeBooking({ phone: '+358 50 3312947', whatsapp: undefined }),
    ]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(2)
    expect(bookings[0].whatsapp).toBe('+18016744017')
    expect(bookings[1].whatsapp).toBe('+358503312947')
  })

  it('does NOT override explicit whatsapp', () => {
    const bookings = [
      makeBooking({ phone: '+18016744017', whatsapp: '+491786916170' }),
    ]
    inferWhatsappFromPhone(bookings)
    expect(bookings[0].whatsapp).toBe('+491786916170')
  })

  it('infers for Korean phone numbers and removes the local trunk zero', () => {
    const bookings = [makeBooking({ phone: '+82-10-1234-5678', whatsapp: undefined })]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(1)
    expect(bookings[0].whatsapp).toBe('+821012345678')
  })

  it('fills the exact Korean phone sample from the 2026-05-26 report', () => {
    const bookings = [makeBooking({ leadName: 'Valerie Say Martinez', phone: '8201096605447' })]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(1)
    expect(bookings[0].whatsapp).toBe('+821096605447')
  })

  it('normalizes bare Korean 010 mobile numbers to +82 for WhatsApp', () => {
    const bookings = [makeBooking({ leadName: 'Local Guest', phone: '01096605447' })]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(1)
    expect(bookings[0].whatsapp).toBe('+821096605447')
  })

  it('respects explicit no-whatsapp sheet signals', () => {
    const bookings = [
      makeBooking({ phone: '+18016744017', notes: 'no_whatsapp' }),
      makeBooking({ phone: '+358 50 3312947', issues: ['no_whatsapp'] }),
    ]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(0)
    expect(bookings[0].whatsapp).toBeUndefined()
    expect(bookings[1].whatsapp).toBeUndefined()
  })

  it('skips when phone is empty', () => {
    const bookings = [makeBooking({ phone: undefined, whatsapp: undefined })]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(0)
  })

  it('handles the exact sample from the 2026-05-26 report', () => {
    const bookings = [
      makeBooking({ leadName: 'Laura Bush', phone: '+18016744017' }),
      makeBooking({ leadName: 'Christopher Wong', phone: '+971585883682' }),
      makeBooking({ leadName: 'Annette Jeong', phone: '+1 510-673-7381' }),
      makeBooking({ leadName: 'Pirjo Kaikkonen', phone: '+358 50 3312947' }),
      makeBooking({ leadName: '張育銘', phone: '+886 0928702425' }),
      makeBooking({ leadName: 'Flora Boros', phone: '+447593946163' }),
      makeBooking({ leadName: 'Malyna Phongthai', phone: '+61403965725' }),
      makeBooking({ leadName: 'Ricky Stevens', phone: '+447921803750' }),
    ]
    const r = inferWhatsappFromPhone(bookings)
    expect(r.filled).toBe(8)
    expect(bookings.every(b => b.whatsapp && b.whatsapp.startsWith('+'))).toBe(true)
  })
})

describe('propagateCountryCode', () => {
  it('Eynat — phone has +972, WhatsApp written without CC → wa gets +972 backfilled', () => {
    const b = [makeBooking({ phone: '+972-0546168552', whatsapp: '0546168552' })]
    const r = propagateCountryCode(b)
    expect(r.filledWhatsapp).toBe(1)
    expect(r.filledPhone).toBe(0)
    expect(b[0].whatsapp).toBe('+972546168552')
    expect(b[0].phone).toBe('+972-0546168552') // phone untouched
  })

  it('Amery — phone has +61, WhatsApp written without CC → wa gets +61 backfilled', () => {
    const b = [makeBooking({ phone: '+61-430425583', whatsapp: '0430425583' })]
    propagateCountryCode(b)
    expect(b[0].whatsapp).toBe('+61430425583')
  })

  it('Sek Kei Ng — both have CC but different numbers → both kept as-is', () => {
    const b = [makeBooking({ phone: '+65-80720658', whatsapp: '+6580353361' })]
    const r = propagateCountryCode(b)
    expect(r.filledWhatsapp).toBe(0)
    expect(r.filledPhone).toBe(0)
    expect(b[0].phone).toBe('+65-80720658')
    expect(b[0].whatsapp).toBe('+6580353361')
  })

  it('symmetric — WhatsApp has CC, phone written without CC → phone backfilled', () => {
    const b = [makeBooking({ phone: '0546168552', whatsapp: '+972-546168552' })]
    const r = propagateCountryCode(b)
    expect(r.filledPhone).toBe(1)
    expect(r.filledWhatsapp).toBe(0)
    expect(b[0].phone).toBe('+972546168552')
  })

  it('symmetric — WhatsApp has CC, phone empty → phone filled from WhatsApp', () => {
    const b = [makeBooking({ phone: undefined, whatsapp: '+491786916170' })]
    const r = propagateCountryCode(b)
    expect(r.filledPhone).toBe(1)
    expect(b[0].phone).toBe('+491786916170')
  })

  it('both have CC and same number → no-op (no spurious filledN counts)', () => {
    const b = [makeBooking({ phone: '+491786916170', whatsapp: '+491786916170' })]
    const r = propagateCountryCode(b)
    expect(r.filledWhatsapp).toBe(0)
    expect(r.filledPhone).toBe(0)
  })

  it('neither has CC → no-op', () => {
    const b = [makeBooking({ phone: '0546168552', whatsapp: '0546168552' })]
    const r = propagateCountryCode(b)
    expect(r.filledWhatsapp).toBe(0)
    expect(r.filledPhone).toBe(0)
  })

  it('digits do NOT match → no backfill (safety guard)', () => {
    // phone has +49, wa "1234567" — unrelated subscriber digits. Skip.
    const b = [makeBooking({ phone: '+491786916170', whatsapp: '1234567' })]
    const r = propagateCountryCode(b)
    expect(r.filledWhatsapp).toBe(0)
    expect(b[0].whatsapp).toBe('1234567')
  })

  it('KR/JP/CN phone with explicit WhatsApp present (no-CC) → still propagates (user wrote it explicitly)', () => {
    // Note: differs from inferWhatsappFromPhone which suppresses these CCs
    // when WA is EMPTY. Here WA is explicitly typed — user wants it usable.
    const b = [makeBooking({ phone: '+82-10-1234-5678', whatsapp: '01012345678' })]
    propagateCountryCode(b)
    expect(b[0].whatsapp).toBe('+821012345678')
  })

  it('explicit "no whatsapp" note → does NOT backfill whatsapp from phone', () => {
    const b = [makeBooking({ phone: '+61-0466310673', whatsapp: '', notes: 'no whatsapp' })]
    const r = propagateCountryCode(b)
    expect(r.filledWhatsapp).toBe(0)
    expect(b[0].whatsapp ?? '').toBe('')
  })
})
