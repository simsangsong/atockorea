// Reproducer for the 2026-05-26 sample: Viator rows where the partner-label
// line is "Viator" (English) cause heuristicExtract to lose the phone on the
// next line. Twin rows that say "파트너사" instead capture the phone fine.

import { heuristicExtract } from '../heuristics'
import { maybeResegment } from '../segment'

// Trimmed dongjjok-17 corpus — only the rows that exercise the two segment.ts
// bugs (#5-#8 for the Viator/phone split; #12-#14 for the "13번." digit-steal).
// Kept inline so the test runs without external fixture files.
const ROSTER = `동쪽




5번.  동쪽 - 3. Lotte Duty Free Jeju Store 08:55
Eynat mazor (인원수 x 3 명)  - 클룩 - GHY811699
English 비고:
eynat_m@yahoo.com +972-0546168552
WhatsApp: 0546168552
6번.  동쪽 - LOTTE City Hotel Jeju
Christopher Wong (2 명)  - 겟유가이드 - GYGKBGFB2622
English 비고:
customer-iz6g44ihgmko5ohf@reply.getyourguide.com
+971585883682





7번.  동쪽 - LOTTE City Hotel 8:55 08:55
Annette Jeong (성인 2명 명)  - 비아토르 - BR-1400938461 영어 비고:
Viator
+1 510-673-7381





8번.  동쪽 - LOTTE City Hotel 8:55 08:55
Pirjo Kaikkonen (성인 1명 명)  - 비아토르 - BR-1398880879 영어 비고:
파트너사
+358 50 3312947





12번.  동쪽 - Ocean Suites Jeju Hotel
Ricky Stevens (1 명)  - 겟유가이드 - GYG6H8A354M6
English 비고:
+447921803750





13번.  동쪽 - Ocean Suites Hotel 8:30 08:30
Ljiljana Mrakovcic (성인 2명 명)  - 비아토르 - BR-1396745075 영어 비고:
파트너사
+32 491 50 84 41

14번.  동쪽 - Ocean Suites Hotel 8:30 08:30 Sheetal Gowda (성인 1명 명)  - 비아토르 - BR-1365435179 영어 비고:
Viator
+1 217-419-3555
`

describe('Viator phone extraction — Annette Jeong / Sheetal Gowda gap', () => {
  it('captures phone when partner label is "파트너사"', () => {
    const block = `8번.  동쪽 - LOTTE City Hotel 8:55 08:55
Pirjo Kaikkonen (성인 1명 명)  - 비아토르 - BR-1398880879 영어 비고:
파트너사
+358 50 3312947`
    const { bookings } = heuristicExtract(block)
    expect(bookings.length).toBe(1)
    expect(bookings[0].leadName).toContain('Pirjo')
    expect(bookings[0].phone?.replace(/\D/g, '')).toBe('358503312947')
  })

  it('captures phone when partner label is "Viator"', () => {
    const block = `7번.  동쪽 - LOTTE City Hotel 8:55 08:55
Annette Jeong (성인 2명 명)  - 비아토르 - BR-1400938461 영어 비고:
Viator
+1 510-673-7381`
    const { bookings } = heuristicExtract(block)
    expect(bookings.length).toBe(1)
    expect(bookings[0].leadName).toContain('Annette')
    expect(bookings[0].phone?.replace(/\D/g, '')).toBe('15106737381')
  })

  // Regression guard for the 2026-05-26 segment.ts bugs:
  //   - splitFusedBookingMarkers used to eat across blank lines and steal the
  //     "1" from "10번. … 14번." → "1" + "0번." fragmentation.
  //   - isBoundaryStart returned true for a bare "Viator" line, splitting the
  //     phone away from Annette Jeong / Sheetal Gowda.
  it('FULL roster — every block carries its booking ref + phone after segment', () => {
    const r = maybeResegment(ROSTER)
    const blocks = r.text.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
    // No block should start with a stray digit-only line.
    const strayDigitLine = blocks.find(b => /^\d\n/.test(b))
    expect(strayDigitLine).toBeUndefined()
    // The Annette block (row 7) must include the Viator + phone lines.
    const annetteBlock = blocks.find(b => b.includes('Annette Jeong'))
    expect(annetteBlock).toContain('Viator')
    expect(annetteBlock).toContain('+1 510-673-7381')
    // The Sheetal block (row 14) likewise.
    const sheetalBlock = blocks.find(b => b.includes('Sheetal Gowda'))
    expect(sheetalBlock).toContain('Viator')
    expect(sheetalBlock).toContain('+1 217-419-3555')
  })

  it('row 14 (Sheetal Gowda) — name + party on same line as 비고', () => {
    const block = `14번.  동쪽 - Ocean Suites Hotel 8:30 08:30 Sheetal Gowda (성인 1명 명)  - 비아토르 - BR-1365435179 영어 비고:
Viator
+1 217-419-3555`
    const { bookings } = heuristicExtract(block)
    expect(bookings.length).toBe(1)
    expect(bookings[0].leadName).toContain('Sheetal')
    expect(bookings[0].phone?.replace(/\D/g, '')).toBe('12174193555')
  })
})
