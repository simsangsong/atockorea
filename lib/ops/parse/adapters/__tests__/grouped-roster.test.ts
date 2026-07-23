import { groupedRosterAdapter } from '../grouped-roster'
import { pickAdapter } from '../index'

// Real recurring format (from a recorded draft template sample_input). Header is
// "<productName>  <guideName>"; rows are whitespace-delimited columns
// "MM-DD  rowNum  name  pax  pickup  phone  [notes]  platform".
const SAMPLE = [
  '남부투어 (한라산1100+주상절리대+천제연+송악산+보문사+오설록)  한혜연',
  '',
  '05-01  1  Wei Wei Chua  3  Ocean Suites Jeju Hotel  6588390013  Klook',
  '05-01  2  Jocelyn Sanchez  1  Ocean Suites Jeju Hotel  527714246871  GYG',
  '05-01  3  Haruhito Kowashi  1  Ocean Suites Jeju Hotel  821045989607  no whatsapp  Viator',
  '05-01  4  vania trixie patty  1  Ocean Suites Jeju Hotel  65-81162349  Klook',
  '05-01  6  Griffin Kubik  2  Jeju Airport Gate 3 (3F)  86-15662672976  Viator',
].join('\n')

describe('groupedRosterAdapter — detection', () => {
  it('scores the grouped roster format above the select threshold', () => {
    expect(groupedRosterAdapter.detect(SAMPLE)).toBeGreaterThanOrEqual(0.8)
  })

  it('is the adapter pickAdapter selects for this shape', () => {
    expect(pickAdapter(SAMPLE)?.id).toBe('grouped-roster')
  })

  it('does NOT fire on a CSV / comma-separated export', () => {
    const csv = 'name,pax,pickup,phone,platform\nJohn,2,Hotel A,+8210,Klook\nJane,1,Hotel B,+8210,GYG'
    expect(groupedRosterAdapter.detect(csv)).toBe(0)
  })

  it('does NOT fire on a prose paste', () => {
    expect(groupedRosterAdapter.detect('Hi, please add John Smith 2 pax tomorrow at Lotte.')).toBe(0)
  })
})

describe('groupedRosterAdapter — parsing', () => {
  it('extracts every row with header productName/guideName inherited', () => {
    const out = groupedRosterAdapter.parse(SAMPLE)
    expect(out.bookings).toHaveLength(5)
    expect(out.leftover).toHaveLength(0)
    for (const b of out.bookings) {
      expect(b.productName).toBe('남부투어 (한라산1100+주상절리대+천제연+송악산+보문사+오설록)')
      expect(b.guideName).toBe('한혜연')
      expect(b.leadName).not.toContain(':')
      expect(b.leadName).not.toMatch(/tour_name|guide/i)
    }
  })

  it('maps positional columns to the right fields', () => {
    const out = groupedRosterAdapter.parse(SAMPLE)
    const wei = out.bookings[0]
    expect(wei.leadName).toBe('Wei Wei Chua')
    expect(wei.partySize).toBe(3)
    expect(wei.pickupPointRaw).toBe('Ocean Suites Jeju Hotel')
    expect(wei.phone).toBe('6588390013')
    expect(wei.sourcePlatform).toBe('klook')
    expect(wei.tourDate).toBe('2026-05-01')
  })

  it('captures the mid-row note column without corrupting platform', () => {
    const out = groupedRosterAdapter.parse(SAMPLE)
    const haru = out.bookings.find(b => b.leadName === 'Haruhito Kowashi')!
    expect(haru.sourcePlatform).toBe('viator')
    expect(haru.notes).toBe('no whatsapp')
    expect(haru.phone).toBe('821045989607')
  })

  it('per-row platform varies within one paste', () => {
    const out = groupedRosterAdapter.parse(SAMPLE)
    expect(out.bookings.map(b => b.sourcePlatform)).toEqual(['klook', 'gyg', 'viator', 'klook', 'viator'])
  })

  it('supports a labeled header "tour_name: … | guide: … | tour_date: …"', () => {
    const input = [
      'tour_name: 설악산+낙산사+낙산해수욕장 | guide: 이상윤 | tour_date: 2026-06-01',
      '06-01  1  John Smith  2  Lotte Duty Free  6588390013  Klook',
    ].join('\n')
    const out = groupedRosterAdapter.parse(input)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].productName).toBe('설악산+낙산사+낙산해수욕장')
    expect(out.bookings[0].guideName).toBe('이상윤')
    expect(out.bookings[0].leadName).toBe('John Smith')
    expect(out.bookings[0].tourDate).toBe('2026-06-01')
  })

  it('never throws on malformed input', () => {
    expect(() => groupedRosterAdapter.parse('')).not.toThrow()
    expect(() => groupedRosterAdapter.parse('garbage\n\n\n')).not.toThrow()
  })
})
