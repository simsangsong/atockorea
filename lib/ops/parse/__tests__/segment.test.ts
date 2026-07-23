import { detectFragmented, resegmentManualNotes, maybeResegment, splitFusedBookingMarkers, splitAdjacentBookingBoundaries } from '../segment'
import { heuristicExtract } from '../heuristics'

// Synthetic multi-line manual-notes roster (no PII). Bookings separated by a
// blank-line RUN; a single blank line sits inside each booking (after 비고:).
function fragmentedRoster(n: number): string {
  const out: string[] = []
  for (let i = 1; i <= n; i++) {
    out.push(
      [
        `서남쪽 - Ocean Suites Jeju Hotel`,
        `Alex Person${i} (인원수 x ${(i % 4) + 1} 명) - 클룩 - EUX${String(i).padStart(6, '0')}`,
        `English`,
        `비고:`,
        ``, // ← single in-booking blank line (the fragmenting culprit)
        `person${i}@example.com`,
        `+65-8${String(i).padStart(7, '0')}`,
        `WhatsApp: 8${String(i).padStart(7, '0')}`,
      ].join('\n'),
    )
  }
  return out.join('\n\n\n\n') // ≥2 blank lines between bookings
}

// Clean single-blank-separated roster (the v1–v5 convention — must NOT resegment).
function cleanSlashRoster(n: number): string {
  const out: string[] = []
  for (let i = 1; i <= n; i++) {
    out.push(`남쪽 / Alex Person${i} ( 클룩 - WWF${String(i).padStart(6, '0')} ) / English / ${(i % 4) + 1} 명 / Ocean Suites Jeju`)
  }
  return out.join('\n\n') // single blank line between bookings
}

describe('detectFragmented (§45 / Sprint 27.G-B)', () => {
  it('fires on fragmented multi-line manual notes', () => {
    expect(detectFragmented(fragmentedRoster(10))).toBe(true)
  })

  it('stays OFF for single-blank-separated rosters (v1–v5 convention)', () => {
    expect(detectFragmented(cleanSlashRoster(20))).toBe(false)
  })

  it('stays OFF for empty / tiny input', () => {
    expect(detectFragmented('')).toBe(false)
    expect(detectFragmented('서남쪽\n\nAlex / 클룩 - WWF000001 / 2 명')).toBe(false)
  })
})

describe('resegmentManualNotes (§45 / Sprint 27.G-B)', () => {
  it('merges a booking fragmented by an internal blank line into one block', () => {
    const oneBooking = [
      '서남쪽 - Ocean Suites Jeju Hotel',
      'Alex Person1 (인원수 x 1 명) - 클룩 - EUX000001',
      '비고:',
      '', // internal blank
      'person1@example.com',
      '+65-80000001',
    ].join('\n')
    // Under naive blank-line split this is 2 blocks; after reseg it is 1.
    expect(oneBooking.split(/\n\s*\n+/).filter(b => b.trim()).length).toBe(2)
    const reseg = resegmentManualNotes(oneBooking)
    expect(reseg.split(/\n\s*\n+/).filter(b => b.trim()).length).toBe(1)
  })

  it('keeps bookings separated when they are ≥2 blank lines apart', () => {
    const two = resegmentManualNotes(fragmentedRoster(2))
    expect(two.split(/\n\s*\n+/).filter(b => b.trim()).length).toBe(2)
  })
})

describe('maybeResegment + heuristics (the actual win)', () => {
  it('leaves clean rosters byte-identical (behavior-neutral)', () => {
    const clean = cleanSlashRoster(20)
    const r = maybeResegment(clean)
    expect(r.resegmented).toBe(false)
    expect(r.text).toBe(clean)
  })

  it('recovers fragmented bookings so they parse with contact', () => {
    const roster = fragmentedRoster(10)
    // Naive split fragments each booking → fewer parse with a phone attached.
    const before = heuristicExtract(roster).bookings.filter(b => b.phone || b.whatsapp).length
    const r = maybeResegment(roster)
    expect(r.resegmented).toBe(true)
    const after = heuristicExtract(r.text).bookings.filter(b => b.phone || b.whatsapp).length
    expect(after).toBeGreaterThan(before)
    expect(after).toBeGreaterThanOrEqual(8)
  })
})

describe('splitFusedBookingMarkers', () => {
  it('splits a phone value glued to the next numbered course booking', () => {
    const raw = 'WhatsApp:+65369258147번. 제주 벚꽃 동쪽 - Ramada by Wyndham Jeju City Hall'
    expect(splitFusedBookingMarkers(raw)).toBe('WhatsApp:+6536925814\n7번. 제주 벚꽃 동쪽 - Ramada by Wyndham Jeju City Hall')
  })

  it('marks maybeResegment as changed when fused markers are split', () => {
    const raw = '+4458147036925번. 제주 크루즈 스몰 그룹'
    expect(maybeResegment(raw)).toEqual({
      text: '+445814703692\n\n5번. 제주 크루즈 스몰 그룹',
      resegmented: true,
    })
  })

  it('adds a blank boundary before a course heading glued after contact', () => {
    const raw = 'Kakao Talk:candice829\n스몰그룹\n1번. 제주 크루즈 스몰 그룹'
    expect(splitAdjacentBookingBoundaries(raw)).toBe('Kakao Talk:candice829\n\n스몰그룹\n1번. 제주 크루즈 스몰 그룹')
  })
})

describe('resegmentManualNotes boundary regression', () => {
  it('keeps single-blank booking boundaries while folding memo-internal blanks', () => {
    const roster = [
      [
        'Southwest - 83 Doryeong-ro, Cheju,',
        'Jessie Hoo(3 Adults)-GYG6H8LQBRNH',
        'Notes:',
        '',
        'customer-a@example.com',
      ].join('\n'),
      [
        'Southwest - LOTTE City Hotel Jeju',
        'Abhishta Nadsar Venkateshwar (Person X2)-ARR360384',
        'English;',
        'customer-b@example.com',
      ].join('\n'),
    ].join('\n\n')

    const blocks = resegmentManualNotes(roster).split(/\n\s*\n+/).filter(b => b.trim())
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toContain('Jessie Hoo')
    expect(blocks[0]).not.toContain('Abhishta')
    expect(blocks[1]).toContain('ARR360384')
  })
})
