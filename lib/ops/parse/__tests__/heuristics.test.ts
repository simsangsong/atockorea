import { heuristicExtract } from '../heuristics'

describe('heuristicExtract — leadName regex collision fix', () => {
  it('does not capture "customer-<hash>@..." as leadName', () => {
    // The pre-fix regex /Customer\s*[:-]\s*(.+)/i with anchoring matched
    // "customer-mgu6...@reply.getyourguide.com" with `-` from [:-] and the
    // hash as the capture group.
    const paste = [
      '2번. 남쪽 - Shilla Duty Free(Jeju Store)',
      'Renard Olivier (1 명) - 겟유가이드 - GYGRFQRQHMA5',
      'English 비고:',
      'customer-mgu6iizmvxgingwv@reply.getyourguide.com',
      '+33699836000',
    ].join('\n')
    const out = heuristicExtract(paste)
    // Either the heuristic emits a booking with the correct name, or it skips
    // entirely (passes through to leftover). It MUST NOT emit the email hash.
    for (const b of out.bookings) {
      expect(b.leadName).not.toContain('@')
      expect(b.leadName).not.toMatch(/^mgu6/i)
    }
  })

  it('never picks a "Traveler N: Dietary restrictions" line as leadName', () => {
    // GYG portal copy splits a booking into Traveler 1 / Traveler 2: Dietary…
    // lines. When block-splitting drops the dietary line into its own block,
    // it must NOT become a booking with that text as the name. (Phase 26 bug:
    // ATOC KOREA import showed "Traveler 2: Dietary restrictions: Shellfish
    // Allergy" as a lead name on 3 cards.)
    const paste = [
      'Traveler 2: Dietary restrictions: Shellfish Allergy',
      'customer-dta2ps6fuhishyyt@reply.getyourguide.com',
    ].join('\n')
    const out = heuristicExtract(paste)
    for (const b of out.bookings) {
      expect(b.leadName).not.toMatch(/dietary|restriction|traveler/i)
    }
  })

  it('never picks a tour-category header ("일반투어"/"버스투어") as leadName', () => {
    // ATOC paste interleaves category headers with the real booking row when
    // the row uses the `//` empty-slot form. The header must not become a lead
    // name (Step 5 showed a "일반투어" card). The row should fall to L2.5 rules.
    const paste = [
      '7월19일 예약',
      '일반투어',
      '제주 크루즈 - 버스투어',
      '제주 크루즈 - 버스투어 / Mariia Otchinskaia ( 겟유가이드 - GYGFWWRX42QA )// 2 명 / Seogwipo Gangjeong Cruise Terminal, // customer-fct4lx6gl52mrtsh@reply.getyourguide.com / 16094083736 /',
    ].join('\n')
    const out = heuristicExtract(paste)
    // The exact standalone category label "일반투어" (the one the operator saw
    // on a Step 5 card) must never be a lead name. Broad `투어$` suffix rejection
    // is intentionally NOT done — it caused a ReDoS hang by re-routing long
    // product lines (see §44.5.10).
    for (const b of out.bookings) {
      expect(b.leadName).not.toMatch(/^(?:일반투어|버스투어|프라이빗|일반|크루즈투어|제주크루즈|크루즈)$/)
    }
  })

  it('extracts Korean operator pickup "Nth. region - LOCATION"', () => {
    const paste = [
      '14번. 동쪽 - Ocean Suites Hotel 8:30 08:30',
      'Mi Storm (1 명) - 비아토르 - BR-1385032635',
      '비고:',
      '+45 40 19 50 97',
    ].join('\n')
    const out = heuristicExtract(paste)
    if (out.bookings.length > 0) {
      expect(out.bookings[0].pickupPointRaw).toContain('Ocean Suites Hotel')
    }
  })

  it('extracts cruise ship text from Korean labeled cruise notes before manual grouping', () => {
    const paste = [
      '3번. 제주 크루즈 스몰 그룹 -',
      'Fran Example (성인 2명 명) - 비아토르 - BR-1376440167',
      '비고:',
      '크루즈선: Spectrum of the seas 하선 시간: 1330-2000 하차 위치: Spectrum of the seas',
      '+44 7860 374881',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].cruiseShipText).toBe('Spectrum of the Seas')
  })

  it('normalizes obvious ship OCR typos and flight-number ship fields in cruise context', () => {
    const typo = heuristicExtract([
      '4번. 제주 크루즈 스몰 그룹 -',
      'Milton Example (성인 4명 명) - 비아토르 - BR-1382419871',
      '비고: 도착 정보:',
      '크루즈선: Spectrum f the Seaso 하선 시간: 12:30',
      '하차 위치: As close as possible to Cruise Terminal (Seogwipo)',
      '+1 301-520-1208',
    ].join('\n')).bookings[0]
    expect(typo.cruiseShipText).toBe('Spectrum of the Seas')
    expect(typo.notes).toMatch(/Seogwipo/i)

    const flightField = heuristicExtract([
      '2번. 제주 크루즈 스몰 그룹',
      'Poppy Example (인원수 x 3 명) - 클룩 - GEF350726',
      '비고: 출발 장소: 서귀포 강정 크루즈 터미널 항공편명 (입국): MSC BELLISSIMA',
      'WhatsApp: 00447766932025',
    ].join('\n')).bookings[0]
    expect(flightField.cruiseShipText).toBe('MSC Bellissima')
  })

  it('does not treat ordinary non-cruise flight numbers as cruise ships', () => {
    const b = heuristicExtract([
      '1번. 남쪽 - Lotte city Hotel jeju',
      'Alex Example (인원수 x 2 명) - 클룩 - ABC123456',
      '비고: 항공편명: KE123',
      'alex@example.com',
      '+82-1012345678',
    ].join('\n')).bookings[0]
    expect(b).toBeDefined()
    expect(b.cruiseShipText).toBeUndefined()
  })
})

describe('heuristicExtract — private-vehicle "Per Vehicle … 대" format', () => {
  // Regression (pressure test 2026-05-23): the nested "(Per Vehicle (1-6 Pax)
  // x 1 대)" counter parsed with no pax pattern, the fallback skipped the name
  // line (carries the 6-digit extid), and the bare "중국어" language line below
  // became the leadName. partySize must come from "No. of participants".
  it('extracts the person name (not the language line) and the participant count', () => {
    const out = heuristicExtract([
      '2. 프라이빗-9시간 - Whistle Lark Hotel',
      'Boon Ying Teo (Per Vehicle (1-6 Pax) x 1 대) - 클룩 - TCT204577',
      '중국어',
      '비고:',
      'Itinerary: customise / Pick-up time: 09:00 / No. of participants: 5명',
      'ktbyteo@gmail.com',
      '+65-92246933',
      'WhatsApp: 92246933',
    ].join('\n'))
    const b = out.bookings.find(x => /Whistle Lark/.test(x.pickupPointRaw ?? ''))
    expect(b).toBeDefined()
    expect(b!.leadName).toBe('Boon Ying Teo')
    expect(b!.partySize).toBe(5)
  })

  it('rejects a bare language label as a lead name (English / 영어)', () => {
    const out = heuristicExtract([
      '1. 프라이빗-9시간 - I-Jin Hotel',
      'Jhona Celendro (Per Vehicle (1-6 Pax) x 1 대) - 클룩 - WZW299037',
      '영어',
      '비고:',
      'No. of participants: 5명',
      'wjpcw246@yahoo.com',
      '+65-94815483',
    ].join('\n'))
    for (const b of out.bookings) {
      expect(b.leadName).not.toBe('영어')
      expect(b.leadName).not.toBe('English')
    }
  })
})
