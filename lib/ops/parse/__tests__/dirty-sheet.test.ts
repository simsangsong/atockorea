// Phase 27 §45 — dirty operator sheet: junk rows above the header + Korean OTA
// names. Regression for the pressure-test findings (2026-06-03):
//  (1) toGrid must find the REAL header beneath title / author / 주의 rows
//      (otherwise the header leaks as a phantom booking and pickups never map),
//  (2) the column extractor must resolve Korean / variant platform spellings
//      (클룩 / 비아토르 / 트립닷컴 / "GetYourGuide" / "Klook ") to the OTA enum.

import { toGrid } from '../tabular'
import { extractByColumns } from '../column-extract'

const DIRTY = [
  '제주 투어 명단,,,,,', // junk title (mostly-empty)
  '작성: 김실장,,,,,', // junk author row
  '번호,예약자,채널,인원,픽업장소,연락처', // the REAL header (row 3)
  '1,Aiden River,비아토르,2,Myeong-dong Station Exit 2,+8210-9780-8027',
  '2,怡如 潘,클룩,4,Hongik Univ.Station Exit No.8,+8210-9780-8027',
  '3,Lukas Müller,GetYourGuide,3,Ocean Suites Jeju Hotel,+8210-9780-8027',
  '=== 오후 ===,,,,,', // interspersed divider (mostly-empty)
  '4,Riley Wang,트립닷컴,1,DMZ Camp Greaves,+8210-9780-8027',
  '합계,,,,,', // junk footer
].join('\n')

describe('dirty sheet — header beneath junk rows', () => {
  it('finds the real header, not a junk title row', () => {
    const g = toGrid(DIRTY)
    expect(g).not.toBeNull()
    expect(g!.rawHeader?.[1]).toBe('예약자') // the real header's name column
    expect(g!.cols).toBe(6)
  })

  it('extracts the data rows, maps pickup, and resolves Korean OTA names', () => {
    const res = extractByColumns(DIRTY)
    const names = res.bookings.map(b => b.leadName)
    expect(names).toContain('Aiden River')
    // The header label must NOT leak as a booking.
    expect(names).not.toContain('예약자')
    // Junk divider / footer rows have an empty name cell → dropped.
    expect(names).not.toContain('합계')

    const aiden = res.bookings.find(b => b.leadName === 'Aiden River')!
    expect(aiden.pickupPointRaw).toBe('Myeong-dong Station Exit 2') // header-mapped
    expect(aiden.sourcePlatform).toBe('viator') // 비아토르 → viator

    const byName = (n: string) => res.bookings.find(b => b.leadName === n)!
    expect(byName('怡如 潘').sourcePlatform).toBe('klook') // 클룩
    expect(byName('Lukas Müller').sourcePlatform).toBe('gyg') // GetYourGuide
    expect(byName('Riley Wang').sourcePlatform).toBe('tripcom') // 트립닷컴
  })
})
