// Phase 27 / Sprint 27.G-B — manual-notes pickup extraction + name-quality.
// Synthetic blocks (no PII); locks in the variants found in the real roster:
//   - "<region> - <pickup>" header line (no leading digit)
//   - inline "출발 장소:" inside a 비고 run
//   - "… 입장료 (포함|미포함) - <pickup>" product-prefixed header
//   - Korean note-field labels rejected as lead names

import { heuristicExtract, isPlausibleName } from '../heuristics'

function block(lines: string[]): string {
  return lines.join('\n')
}
function firstBooking(raw: string) {
  return heuristicExtract(raw).bookings[0]
}

describe('manual-notes pickup extraction (§45 / Sprint 27.G-B)', () => {
  it('extracts pickup from a "<region> - <pickup>" header line', () => {
    const b = firstBooking(block([
      '서남쪽 - Ocean Suites Jeju Hotel',
      'Alex Rivera (인원수 x 1 명) - 클룩 - EUX000001',
      'English',
      '비고:',
      'alex@example.com',
      '+65-80000001',
    ]))
    expect(b).toBeDefined()
    expect(b.pickupPointRaw).toBe('Ocean Suites Jeju Hotel')
  })

  it('extracts pickup from an inline "출발 장소:" label inside a 비고 run', () => {
    const b = firstBooking(block([
      '제주 크루즈 스몰 그룹',
      'Jordan Kim (3 명) - 클룩 - GEF000002',
      '비고: 선호 언어: 영어 출발 장소: 서귀포 강정 크루즈 터미널 항공편 도착 시간: 11.00am',
      'jordan@example.com',
      '+82-1000000002',
    ]))
    expect(b).toBeDefined()
    expect(b.pickupPointRaw).toBe('서귀포 강정 크루즈 터미널')
  })

  it('extracts pickup from a "… 입장료 (포함|미포함) - <pickup>" product header', () => {
    const b = firstBooking(block([
      '카멜리아 겨울 동쪽 - 입장료 포함 - Guesthouse Brick',
      'Casey Park (인원수 x 2 명) - 클룩 - MXA000003',
      'Chinese',
      'casey@example.com',
      '+86-13600000003',
    ]))
    expect(b).toBeDefined()
    expect(b.pickupPointRaw).toBe('Guesthouse Brick')
  })

  it('does NOT mistake a "<region> - NAME (N명) - 클룩" one-liner pickup as the contact/ref', () => {
    // The region-dash guard rejects a tail carrying a pax/platform marker, so
    // pickup is not polluted with name+platform text.
    const b = firstBooking(block([
      '남쪽 - Riley Lee (2 명) - 클룩 - SJF000004',
      'riley@example.com',
      '+82-1000000004',
    ]))
    // Either no pickup or a clean one — never the "Riley Lee (2 명) - 클룩…" tail.
    expect(b?.pickupPointRaw ?? '').not.toMatch(/명|클룩|SJF/)
  })

  it('does not over-capture a trailing "비고:" into the pickup', () => {
    const b = firstBooking(block([
      '서남쪽 - Shilla Duty Free 비고:',
      'Devon Cho (인원수 x 1 명) - 클룩 - ZJE000005',
      'devon@example.com',
      '+65-80000005',
    ]))
    expect(b?.pickupPointRaw).toBe('Shilla Duty Free')
  })

  // Regression: a bare "<CC>-<number>" phone line (no "+") otherwise reads as
  // "<item-no> - <location>" in the numbered-header pickup pattern and steals
  // the slot from the standalone "<region> - <hotel>" header, surfacing a phone
  // number in the "사전에 없는 픽업지" review list.
  it('does NOT read a bare "<CC>-<number>" phone line as the pickup', () => {
    const b = firstBooking(block([
      '서남쪽 - LOTTE City Hotel Jeju',
      'Alex Rivera (인원수 X2명)-ARR000001',
      'English;',
      'alex@example.com',
      '91-9000000001',
      'WhatsApp:+919000000001',
    ]))
    expect(b).toBeDefined()
    expect(b.pickupPointRaw).toBe('LOTTE City Hotel Jeju')
    expect(b.pickupPointRaw ?? '').not.toMatch(/^\d+$/)
  })

  it('reads the region header as pickup even when "(인원수 X N)" carries no 명 unit', () => {
    const b = firstBooking(block([
      '남쪽 - Lotte city Hotel jeju',
      'Bailey Cho(인원수 X 2)-ACV000002',
      'Chinese;',
      'bailey@example.com',
      '886-930000002',
      'LINE: baileycho',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('Bailey Cho')
    expect(b.pickupPointRaw).toBe('Lotte city Hotel jeju')
  })
})

describe('manual-notes course extraction for wizard grouping', () => {
  it('uses the region before "<region> - <pickup>" as productName', () => {
    const b = firstBooking(block([
      '서남쪽 - Ocean Suites Jeju Hotel',
      'Alex Rivera (인원수 x 1 명) - 클룩 - EUX000001',
      'English',
      'alex@example.com',
      '+65-80000001',
    ]))
    expect(b).toBeDefined()
    expect(b.productName).toBe('서남쪽')
    expect(b.pickupPointRaw).toBe('Ocean Suites Jeju Hotel')
  })

  it('keeps Camellia direction + admission option as productName and hotel as pickup', () => {
    const b = firstBooking(block([
      '카멜리아 겨울 서남쪽 - 입장료 미포함 - Ocean Suites Jeju Hotel',
      'Casey Park (인원수 x 2 명) - 클룩 - MXA000003',
      'Chinese',
      'casey@example.com',
      '+86-13600000003',
    ]))
    expect(b).toBeDefined()
    expect(b.productName).toBe('카멜리아 겨울 서남쪽 - 입장료 미포함')
    expect(b.pickupPointRaw).toBe('Ocean Suites Jeju Hotel')
  })

  it('classifies cherry blossom east and private-tour headers', () => {
    const cherry = firstBooking(block([
      '제주 벚꽃 동쪽 - Jeju Happy Hotel',
      'Yuna Kim (1 명) - kkday - 26KK249690019',
      'yuna@example.com',
      '+82 10 0000 0000',
    ]))
    expect(cherry).toBeDefined()
    expect(cherry.productName).toBe('제주 벚꽃 동쪽')
    expect(cherry.pickupPointRaw).toBe('Jeju Happy Hotel')

    const privateTour = firstBooking(block([
      '프라이빗-9시간 - I-Jin Hotel',
      'Jordan Lee (Per Vehicle (1-6 Pax) x 1 대) - 클룩 - WZW299037',
      'jordan@example.com',
      '+65-94815483',
    ]))
    expect(privateTour).toBeDefined()
    expect(privateTour.productName).toBe('프라이빗-9시간')
    expect(privateTour.pickupPointRaw).toBe('I-Jin Hotel')
  })

  it('normalizes cruise small-group headings as productName', () => {
    const b = firstBooking(block([
      '제주 크루즈 스몰 그룹 - 서귀포 강정 크루즈 터미널',
      'Poppy Compton (인원수 x 3 명) - 클룩 - GEF350726',
      'poppy@example.com',
      '+44-7766932025',
    ]))
    expect(b).toBeDefined()
    expect(b.productName).toBe('제주 크루즈 스몰 그룹')
    expect(b.pickupPointRaw).toBe('서귀포 강정 크루즈 터미널')
  })
})

describe('pax variant — redundant "명" (§45 / Sprint 27.G-B)', () => {
  it('parses "<name> (성인 N명 명) - 비아토르 - EXTID" (double 명 data-entry artifact)', () => {
    const b = firstBooking(block([
      '3번. 제주 크루즈 스몰 그룹 - John Doe (성인 2명 명) - 비아토르 - BR-0000001',
      '비고: 도착 정보:',
      '크루즈선: Spectrum of the Seas 하선 시간: 13:30',
      '+44 7000 000000',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('John Doe')
    expect(b.partySize).toBe(2)
    expect(b.sourcePlatform).toBe('viator')
  })

  // The leadName MUST be the person, never the leading "<region> - <pickup>"
  // line. These pax-paren variants used to fall through to the region line.
  it.each([
    ['남쪽 - Lotte city Hotel jeju\nLai Chen Hsi(인원수 X 2)-ACV321044\nChinese;', 'Lai Chen Hsi', 2],
    ['동쪽 - Ocean Suites Jeju Hotel\nAnil Kumar Kuchipudi(성인 X 2)-26KK204060220\nbookings@pelago.co', 'Anil Kumar Kuchipudi', 2],
    ['동쪽 - Ocean Suites Jeju Hotel\nHuang Qizhou(1인)-ZAM306167\nChinese;', 'Huang Qizhou', 1],
    ['서남쪽 - Shilla Duty Free(Jeju Store)\nLucas Choi (Person X 1) - VCE307176\nEnglish\nlucasleechoi@gmail.com', 'Lucas Choi', 1],
    ['서남쪽 - Shilla Duty Free(Jeju Store),\nLaura Pont Lopez (2 x Adults) - GYGKBGBZHVX3\nEnglish\ncustomer-x@reply.getyourguide.com', 'Laura Pont Lopez', 2],
  ])('extracts the person name (not the region line) from %s', (raw, name, pax) => {
    const b = firstBooking(raw)
    expect(b).toBeDefined()
    expect(b.leadName).toBe(name)
    expect(b.partySize).toBe(pax)
  })
})

describe('bare hand-typed roster (walk-in / Airbnb / agent)', () => {
  it('parses "<name> 롯데 N명 email" + "Phone number <x>" (email on same line)', () => {
    const b = firstBooking(block([
      'Faisal Burayhi 롯데 1명 faisal@example.com',
      'Phone number 966-593272766',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('Faisal Burayhi')
    expect(b.partySize).toBe(1)
    expect(b.phone).toBeTruthy()
  })

  it('uses the "이름: <name>" line, not the "<region> <hotel> N명" header', () => {
    const b = firstBooking(block([
      '동쪽 신라 2명',
      '이름: Karina Audria',
      '여행자: 2 Adults',
      '+66 2 030 4763',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('Karina Audria')
    expect(b.partySize).toBe(2)
  })

  it('parses "<name> N명" + Email/Phone label lines (no hotel abbrev)', () => {
    const b = firstBooking(block([
      'Wang Person 롯데 1명',
      'Email person@example.com',
      'Phone number 86-18362958300',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('Wang Person')
    expect(b.partySize).toBe(1)
  })

  it('extracts phone when email, phone, and messenger are packed on one line', () => {
    const b = firstBooking(block([
      '4번. 남쪽 - Lotte city Hotel jeju:33.490517, 126.486491 LOK TONG CHAU (2 명) - kkday - 26KK246580368 중국어 비고:',
      'loktongchau@example.com +852 61029837 왓츠앱/+85261029837',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('LOK TONG CHAU')
    expect(b.phone).toBe('+85261029837')
    expect(b.whatsapp).toBe('+85261029837')
  })

  it('cleans compressed pickup prefixes before the lead name', () => {
    const b = firstBooking(block([
      '3번. 서남쪽 - LOTTE City Hotel Jeju michelle Bilgera (인원수 x 1 명) - 클룩 - MNM457395',
      'English 비고:',
      'claeraimee@example.com +63-661878050',
      'WhatsApp: 94104456',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('michelle Bilgera')
    expect(b.phone).toBe('+63661878050')
  })

  it('removes Jeju address text before a CJK lead name in dense KKday rows', () => {
    const b = firstBooking(block([
      '9번.  동쪽 - 신라 면세점(제주점):신라면세점(제주점), 노연로 제주시제주특별자치도 대한민국 依萱 張簡 (2 명)  - kkday - 26KK000000001 중국어 비고:',
      'guest@example.com',
      '+886 900000000',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('依萱 張簡')
    expect(b.leadName).not.toMatch(/제주특별자치도|대한민국/)
    expect(b.partySize).toBe(2)
  })

  it('cleans a dangling "(" and trailing location from the rescued name', () => {
    const b = firstBooking(block([
      'Hungyu fen 공항 1명',
      '+886 923641523',
    ]))
    expect(b).toBeDefined()
    expect(b.leadName).toBe('Hungyu fen')
    expect(b.leadName).not.toMatch(/[(]|공항/)
  })
})

describe('field placement — notes / whatsapp / clean values', () => {
  it('preserves "특별 요구사항: <text>" into notes (special=)', () => {
    const b = firstBooking(block([
      '동쪽 - LOTTE City Hotel Jeju',
      'Kenny Person (인원수 x 1 명) - 클룩 - ABC123456',
      'English',
      '비고:',
      '특별 요구사항: Take photo every spot',
      'kenny@example.com',
      '+66 2 030 4763',
    ]))
    expect(b).toBeDefined()
    expect(b.notes ?? '').toContain('Take photo every spot')
  })

  it('extracts WhatsApp into the whatsapp field (not phone) with clean digits', () => {
    const b = firstBooking(block([
      '서남쪽 - Ocean Suites Jeju Hotel',
      'Tricia Person (인원수 x 2 명) - 클룩 - ZJE066455',
      'English',
      '비고:',
      'tricia@example.com',
      '+65-93707597',
      'WhatsApp: +6593707597',
    ]))
    expect(b).toBeDefined()
    expect(b.whatsapp).toBe('+6593707597')
    expect(b.phone).toBe('+6593707597')
  })

  it('cleans full-width parens / unicode hyphens out of WhatsApp + phone', () => {
    const b = firstBooking(block([
      '남쪽 - Shilla Duty Free (Jeju Store):',
      'KA Person (3 명) - kkday - 25KK223600579',
      '비고:',
      'kawai@example.com',
      '왓츠앱/（852）67554167',
    ]))
    expect(b).toBeDefined()
    expect(b.whatsapp).toBe('85267554167')
    expect(b.whatsapp).not.toMatch(/[^\d+]/)
  })
})

describe('isPlausibleName — Korean note labels (§45 / Sprint 27.G-B)', () => {
  it('rejects Korean note-field labels as names', () => {
    expect(isPlausibleName('비고: 도착 정보:')).toBe(false)
    expect(isPlausibleName('도착 정보: Port of Jeju')).toBe(false)
    expect(isPlausibleName('크루즈선: Spectrum of the seas')).toBe(false)
    expect(isPlausibleName('특별 요구사항: 없음')).toBe(false)
  })

  it('still accepts genuine names of every script', () => {
    expect(isPlausibleName('Alex Rivera')).toBe(true)
    expect(isPlausibleName('依萱 張簡')).toBe(true)
    expect(isPlausibleName('김민준')).toBe(true)
  })
})
