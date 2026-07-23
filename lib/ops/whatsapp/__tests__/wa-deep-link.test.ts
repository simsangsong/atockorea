// Phase 2 — wa.me deep link builder (plan §4.2). Pure, network 0.

import {
  normalizeWaPhone,
  resolveWhatsAppDigits,
  renderWaTemplate,
  buildWhatsAppDeepLink,
  buildWhatsAppMessage,
} from '../wa-deep-link'
import { WA_PRESETS, WA_LOCALES, getPreset, presetBodyForLocale } from '../presets'

describe('normalizeWaPhone', () => {
  it('strips to E.164 digits without +', () => {
    expect(normalizeWaPhone('+82 10-1234-5678')).toBe('821012345678')
    expect(normalizeWaPhone('(+1) 714 555 0134')).toBe('17145550134')
  })

  it('rejects unusable numbers', () => {
    expect(normalizeWaPhone('12345')).toBeNull() // too short
    expect(normalizeWaPhone('1234567890123456')).toBeNull() // >15
    expect(normalizeWaPhone('')).toBeNull()
    expect(normalizeWaPhone(null)).toBeNull()
  })
})

describe('resolveWhatsAppDigits', () => {
  it('prefers the country-coded phone when WA is its local suffix', () => {
    expect(resolveWhatsAppDigits({ phone: '+1 714 555 0134', whatsapp: '714 555 0134' })).toBe('17145550134')
  })

  it('falls back across missing fields', () => {
    expect(resolveWhatsAppDigits({ phone: '+82 10 1234 5678', whatsapp: null })).toBe('821012345678')
    expect(resolveWhatsAppDigits({ phone: null, whatsapp: '+65 8870 1234' })).toBe('6588701234')
    expect(resolveWhatsAppDigits({ phone: null, whatsapp: null })).toBeNull()
  })

  it('keeps a distinct whatsapp number', () => {
    expect(resolveWhatsAppDigits({ phone: '+82 10 1111 2222', whatsapp: '+39 333 123 4567' })).toBe('393331234567')
  })
})

describe('renderWaTemplate', () => {
  const input = {
    guestName: 'Massimo',
    tourName: 'Jeju East Tour',
    tourDate: '2026-08-17',
    pickupPoint: 'Lotte Hotel',
    pickupTime: '08:30',
    roomLink: 'https://atockorea.com/r/x',
    passLink: 'https://atockorea.com/p/y',
    operatorName: 'AtoC Korea',
  }

  it('substitutes the plan §4.2 variable set', () => {
    const out = renderWaTemplate(
      '{guest_name} | {tour_date} | {pickup_time} | {room_link} | {pass_link}',
      input,
    )
    expect(out).toBe('Massimo | 2026-08-17 | 08:30 | https://atockorea.com/r/x | https://atockorea.com/p/y')
  })

  it('supports kursoflow aliases', () => {
    const out = renderWaTemplate('{name} {tour_name} {pickup} {pass_url} {operator}', input)
    expect(out).toBe('Massimo Jeju East Tour Lotte Hotel 08:30 https://atockorea.com/p/y AtoC Korea')
  })

  it('renders empty values without leaking tokens', () => {
    const out = renderWaTemplate('{pickup_point}|{room_link}', { guestName: 'A' })
    expect(out).toBe('|')
  })
})

describe('buildWhatsAppDeepLink', () => {
  it('builds wa.me/<digits>?text=<encoded>', () => {
    const url = buildWhatsAppDeepLink(
      { phone: '+39 333 123 4567', guestName: 'Massimo', tourDate: '2026-08-17' },
      'Hi {guest_name} — {tour_date}',
    )
    expect(url).toBe(`https://wa.me/393331234567?text=${encodeURIComponent('Hi Massimo — 2026-08-17')}`)
  })

  it('returns null on an unusable phone (button disable contract)', () => {
    expect(buildWhatsAppDeepLink({ phone: 'n/a', guestName: 'X' }, 'body')).toBeNull()
  })

  it('URL-encodes multi-line unicode bodies', () => {
    const url = buildWhatsAppDeepLink(
      { phone: '+82 10 1234 5678', guestName: '김철수' },
      '안녕하세요 {guest_name}님\n내일 뵙겠습니다',
    )
    expect(url).toContain('wa.me/821012345678?text=')
    expect(decodeURIComponent(url!.split('?text=')[1])).toBe('안녕하세요 김철수님\n내일 뵙겠습니다')
  })
})

describe('presets (6 locale × 5)', () => {
  it('ships 5 presets, each with all 6 locales non-empty', () => {
    expect(WA_PRESETS).toHaveLength(5)
    for (const preset of WA_PRESETS) {
      for (const locale of WA_LOCALES) {
        expect(preset.bodies[locale]).toBeTruthy()
        expect(preset.bodies[locale]).toContain('{guest_name}')
      }
    }
  })

  it('room_invite carries {room_link}; day_pass carries {pass_link}', () => {
    for (const locale of WA_LOCALES) {
      expect(getPreset('room_invite')!.bodies[locale]).toContain('{room_link}')
      expect(getPreset('day_pass')!.bodies[locale]).toContain('{pass_link}')
    }
  })

  it('presetBodyForLocale normalizes zh-TW and falls back to en', () => {
    const preset = getPreset('pickup_d1')!
    expect(presetBodyForLocale(preset, 'zh-TW')).toBe(preset.bodies['zh-TW'])
    expect(presetBodyForLocale(preset, 'zh_Hant')).toBe(preset.bodies['zh-TW'])
    expect(presetBodyForLocale(preset, 'zh')).toBe(preset.bodies.zh)
    expect(presetBodyForLocale(preset, 'fr')).toBe(preset.bodies.en) // Phase 2.5 locale
    expect(presetBodyForLocale(preset, null)).toBe(preset.bodies.en)
  })

  it('renders a full preset without leftover known tokens', () => {
    const body = presetBodyForLocale(getPreset('pickup_d1')!, 'en')
    const out = buildWhatsAppMessage(
      {
        guestName: 'Massimo',
        tourName: 'Jeju East Tour',
        tourDate: '2026-08-17',
        pickupPoint: 'Lotte Hotel',
        pickupTime: '08:30',
        operatorName: 'AtoC Korea',
      },
      body,
    )
    expect(out).not.toMatch(/\{(guest_name|tour_name|tour_date|pickup_point|pickup_time|room_link|pass_link|operator)\}/)
    expect(out).toContain('Massimo')
    expect(out).toContain('08:30')
  })
})
