// Phase 27 §45 Sprint 27.0 — classifyShape() unit + real-corpus sanity tests.
//
// Synthetic samples avoid committing PII. The fixture-gated block reads the
// local tmp/ corpus (when present) and only asserts the SHAPE enum — no content
// is printed or committed.

import * as fs from 'node:fs'
import path from 'node:path'
import { classifyShape } from '../classify'

describe('classifyShape — synthetic per-shape branching', () => {
  it('clean Klook export → ota:klook', () => {
    const raw = [
      'Klook Operator Center',
      'Booking Reference: GUH242924',
      'John Smith (2명)',
      'GUH242924',
      '',
      'Booking Reference: ABC123456',
      'Jane Doe (3명)',
      'ABC123456',
    ].join('\n')
    expect(classifyShape(raw)).toBe('ota:klook')
  })

  it('clean GetYourGuide export → ota:gyg', () => {
    const raw = [
      'GetYourGuide Supplier Portal',
      'Anna Lee ( GYG997VA6WVY )',
      'GYG997VA6WVY',
      '',
      'Tom Park ( GYG83X8QKR5N )',
      'GYG83X8QKR5N',
    ].join('\n')
    expect(classifyShape(raw)).toBe('ota:gyg')
  })

  it('comma CSV with field-name header → ota:csv', () => {
    const raw = [
      'name,pax,date,phone',
      'John Smith,2,2026-05-10,+12025550101',
      'Jane Doe,3,2026-05-11,+8210123456',
    ].join('\n')
    expect(classifyShape(raw)).toBe('ota:csv')
  })

  it('CSV with a multi-OTA platform column still → ota:csv (structure wins)', () => {
    const raw = [
      'name,platform,pax,phone',
      'John Smith,klook,2,+12025550101',
      'Jane Doe,getyourguide,3,+8210123456',
    ].join('\n')
    expect(classifyShape(raw)).toBe('ota:csv')
  })

  it('Korean handwritten roster (no OTA markers) → manual_kr', () => {
    const raw = [
      '제주 단체 명단',
      '홍길동 2명 010-1234-5678',
      '김철수 3명 010-9876-5432',
      '이영희 1명 010-5555-6666',
    ].join('\n')
    expect(classifyShape(raw)).toBe('manual_kr')
  })

  it('Chinese handwritten roster (Han, no Hangul/kana) → manual_cn', () => {
    const raw = [
      '济州岛旅游名单',
      '陈秋蓉 2人 +886912345678',
      '林淑婷 1人 +886987654321',
      '王大明 3人 +85291234567',
    ].join('\n')
    expect(classifyShape(raw)).toBe('manual_cn')
  })

  it('driver / vehicle roster (호차 / 배차) → driver_list', () => {
    const raw = [
      '5월10일 배차표',
      '1호차 김기사 010-1111-2222',
      '  홍길동 2명, 김영수 3명',
      '2호차 박기사 010-3333-4444',
      '  이철수 4명',
    ].join('\n')
    expect(classifyShape(raw)).toBe('driver_list')
  })

  it('tab-delimited excel paste (data-first, no name header) → excel_paste', () => {
    const raw = [
      '2026-05-10\t홍길동\t2\t010-1234-5678',
      '2026-05-11\t김철수\t3\t010-9876-5432',
      '2026-05-12\t이영희\t1\t010-5555-6666',
    ].join('\n')
    expect(classifyShape(raw)).toBe('excel_paste')
  })

  it('forwarded email with ≥2 headers → email', () => {
    const raw = [
      'From: operator@example.com',
      'To: guide@atockorea.com',
      'Subject: 5/10 cruise bookings',
      'Date: Fri, 10 May 2026',
      '',
      'Booking 1: John Smith, 2 pax',
    ].join('\n')
    expect(classifyShape(raw)).toBe('email')
  })

  it('multi-OTA slash manifest (klook + gyg + viator) → mixed', () => {
    const raw = [
      '남쪽 / Sude Ozturk ( 겟유가이드 - GYG997VA6WVY ) / 영어 / 2 명 / Jeju Airport / / a@b.com / 491624109015 /',
      '남쪽 / Ke Wong ( 클룩 - WWF456211 ) / English / 인원수 x 1 명 / Ocean Suites / WhatsApp: +6598226078 / k@gmail.com /',
      '부산항 / Mukesh Jain ( 비아토르 - BR-1331852399 ) / English / 2 명 / Busan Port / / m@gmail.com / Diamond Princess',
    ].join('\n')
    expect(classifyShape(raw)).toBe('mixed')
  })

  it('empty / whitespace input → mixed (safe fallback)', () => {
    expect(classifyShape('')).toBe('mixed')
    expect(classifyShape('   \n\n  ')).toBe('mixed')
  })

  it('does not throw on adversarial input', () => {
    expect(() => classifyShape('('.repeat(5000))).not.toThrow()
    expect(() => classifyShape('/ '.repeat(5000))).not.toThrow()
  })
})

// ── real-corpus sanity (skips when local PII fixtures are absent) ────────────
describe('classifyShape — real corpus sanity', () => {
  const cases: Array<{ file: string; expect: ReadonlyArray<string> }> = [
    // v3/v5 are the cruise-manifest family: Korean region/port prefix + slash-
    // separated multi-OTA fields → 'mixed' (the §45 "5/10 manifest" acceptance).
    { file: 'bulk-jeju-v3.txt', expect: ['mixed'] },
    { file: 'bulk-jeju-v5.txt', expect: ['mixed'] },
    // v1/v2/v4 are Korean operator rosters — mixed or manual_kr both acceptable.
    { file: 'bulk-jeju.txt', expect: ['mixed', 'manual_kr'] },
    { file: 'bulk-jeju-v2.txt', expect: ['mixed', 'manual_kr'] },
    { file: 'bulk-jeju-v4.txt', expect: ['mixed', 'manual_kr'] },
  ]
  for (const c of cases) {
    const p = path.join(process.cwd(), 'tmp', c.file)
    ;((fs.existsSync(p)) ? it : it.skip)(`${c.file} → ${c.expect.join(' | ')}`, () => {
      const raw = fs.readFileSync(p, 'utf-8')
      expect(c.expect).toContain(classifyShape(raw))
    })
  }
})
