// Phase 27 §45 Sprint 27.H — semantic field validator unit tests.

import {
  isEmailLike,
  isPhoneLike,
  isTimeLike,
  isDateLike,
  isPaxLike,
  isNameLike,
  isPlatformLike,
  classifyValue,
} from '../field-validators'

describe('isEmailLike', () => {
  it('accepts real addresses, rejects names/phones', () => {
    expect(isEmailLike('john@example.com')).toBe(true)
    expect(isEmailLike('a.b+c@sub.domain.co.kr')).toBe(true)
    expect(isEmailLike('John Kim')).toBe(false)
    expect(isEmailLike('+1 202 555 0101')).toBe(false)
    expect(isEmailLike('john@ example.com')).toBe(false) // embedded space
  })
})

describe('isPhoneLike', () => {
  it('accepts 7–15 digit phone shapes, rejects emails and pax', () => {
    expect(isPhoneLike('+1 202-555-0101')).toBe(true)
    expect(isPhoneLike('821012345678')).toBe(true)
    expect(isPhoneLike('(852) 9397 1724')).toBe(true)
    expect(isPhoneLike('john@x.com')).toBe(false)
    expect(isPhoneLike('3')).toBe(false) // a pax count is not a phone
    expect(isPhoneLike('12345')).toBe(false) // too few digits
  })
})

describe('isTimeLike / isDateLike / isPaxLike', () => {
  it('validates time, date and pax', () => {
    expect(isTimeLike('09:00')).toBe(true)
    expect(isTimeLike('23:59')).toBe(true)
    expect(isTimeLike('24:00')).toBe(false)
    expect(isDateLike('2026-05-31')).toBe(true)
    expect(isDateLike('not a date')).toBe(false)
    expect(isPaxLike(3)).toBe(true)
    expect(isPaxLike('50')).toBe(true)
    expect(isPaxLike(0)).toBe(false)
    expect(isPaxLike(99)).toBe(false)
  })
})

describe('isNameLike — language-agnostic (i18n)', () => {
  it('accepts names across scripts', () => {
    expect(isNameLike('John Smith')).toBe(true)
    expect(isNameLike('김민수')).toBe(true) // Hangul
    expect(isNameLike('林淑婷')).toBe(true) // Han
    expect(isNameLike('田中太郎')).toBe(true) // kanji/kana
  })
  it('rejects header rows, labels, emails, phones, dates', () => {
    expect(isNameLike('이름 / 전화 / 픽업')).toBe(false) // header row
    expect(isNameLike('Traveler 2: Dietary restrictions')).toBe(false)
    expect(isNameLike('john@x.com')).toBe(false)
    expect(isNameLike('+1 202 555 0101')).toBe(false)
    expect(isNameLike('2026-05-31')).toBe(false)
  })
})

describe('isPlatformLike', () => {
  it('detects OTA channel names', () => {
    expect(isPlatformLike('Klook')).toBe(true)
    expect(isPlatformLike('클룩')).toBe(true)
    expect(isPlatformLike('John Smith')).toBe(false)
  })
})

describe('classifyValue', () => {
  it('returns every plausible type (phone ⇒ phone+whatsapp)', () => {
    expect(classifyValue('+1 202 555 0101').sort()).toEqual(['phone', 'whatsapp'])
    expect(classifyValue('john@x.com')).toEqual(['email'])
    expect(classifyValue('김민수')).toEqual(['name'])
    expect(classifyValue(3)).toEqual(['pax'])
    expect(classifyValue('   ')).toEqual([])
    expect(classifyValue('!!!')).toEqual([]) // junk matches nothing
  })
})
