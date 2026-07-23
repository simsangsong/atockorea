import {
  isSectionHeader,
  isLabeledMetadataHeader,
  looksLikeMetadataHeaderBooking,
  extractSectionHeaders,
  headerAtOffset,
  inheritSectionHeaders,
} from '../section-header'
import type { ParsedBooking } from '@/lib/ops/parse/types'

function makeBooking(p: Partial<ParsedBooking>): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    leadName: p.leadName ?? null,
    partySize: p.partySize ?? 1,
    productName: p.productName ?? null,
    tourDate: p.tourDate ?? null,
    pickupTime: p.pickupTime ?? null,
    pickupPointRaw: p.pickupPointRaw ?? null,
    pickupPointNormalized: p.pickupPointNormalized ?? null,
    language: p.language ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    whatsapp: p.whatsapp ?? null,
    externalBookingId: p.externalBookingId ?? null,
    notes: p.notes ?? null,
    cruiseShipId: p.cruiseShipId ?? null,
    cruisePortCallId: p.cruisePortCallId ?? null,
    confidenceScore: p.confidenceScore ?? 0.9,
    ...p,
  } as ParsedBooking
}

describe('isSectionHeader', () => {
  it('accepts standalone direction words', () => {
    expect(isSectionHeader('동쪽')).toBe(true)
    expect(isSectionHeader('서쪽')).toBe(true)
    expect(isSectionHeader('  남쪽  ')).toBe(true)
  })

  it('rejects numbered booking lines that start with the same word', () => {
    expect(isSectionHeader('1번. 동쪽 - Jeju Airport')).toBe(false)
  })

  it('rejects lines that include contact signals', () => {
    expect(isSectionHeader('동쪽 +82-10-1234-5678')).toBe(false)
    expect(isSectionHeader('a@b.com')).toBe(false)
  })

  it('rejects booking rows that embed a hyphen-pickup pattern', () => {
    expect(isSectionHeader('동쪽 - Jeju Airport')).toBe(false)
  })

  it('rejects very long lines', () => {
    expect(isSectionHeader('동쪽 한라산 자연 트래킹 풀데이 코스 안내')).toBe(false)
  })
})

describe('extractSectionHeaders', () => {
  it('finds all standalone headers with offsets', () => {
    const input = '동쪽\n\n1번. ...\n\n서쪽\n\n2번. ...'
    const hits = extractSectionHeaders(input)
    expect(hits.map(h => h.header)).toEqual(['동쪽', '서쪽'])
    expect(hits[0].offset).toBe(0)
    expect(hits[1].offset).toBe(input.indexOf('서쪽'))
  })

  it('extracts the tour_name value from labeled metadata headers', () => {
    const input =
      'tour_date: 2026-06-01 | tour_name: 설악산남이섬 마감 | guide: 최순길\n' +
      'John Smith / 2 / Lotte Duty Free / +82-10-1234-5678 / GYG'
    const hits = extractSectionHeaders(input)
    // The "마감" (full/closed) status marker is stripped; date/guide-only
    // segments are not inheritance sources.
    expect(hits.map(h => h.header)).toEqual(['설악산남이섬'])
    expect(hits[0].offset).toBe(0)
  })

  it('does NOT treat a labeled header without tour_name as an inheritance source', () => {
    const hits = extractSectionHeaders('guide: 최순길 | tour_date: 2026-06-01')
    expect(hits).toEqual([])
  })
})

describe('isLabeledMetadataHeader', () => {
  it('accepts key:value group headers carrying a known meta key', () => {
    expect(isLabeledMetadataHeader('tour_date: 2026-06-01 | tour_name: 설악산 | guide: 최순길')).toBe(true)
    expect(isLabeledMetadataHeader('투어명: 설악산남이섬 | 가이드: 이상윤')).toBe(true)
    expect(isLabeledMetadataHeader('guide: 대형')).toBe(true)
  })

  it('rejects real booking rows even when they embed a colon', () => {
    // Slash-delimited roster row — no key:value structure.
    expect(isLabeledMetadataHeader('Sandra Fienko / 1 / Lotte Duty Free / +82-10-1 / GYG')).toBe(false)
    // A contact signal means it is a booking, not a header.
    expect(isLabeledMetadataHeader('tour_name: X | phone: +82-10-1234-5678')).toBe(false)
    // Annotation row whose key is not a meta key.
    expect(isLabeledMetadataHeader('row 33: 35 / sent')).toBe(false)
  })

  it('is accepted by isSectionHeader regardless of length / embedded date', () => {
    expect(isSectionHeader('tour_date: 2026-06-01 | tour_name: 설악산남이섬 마감 | guide: 최순길')).toBe(true)
  })
})

describe('looksLikeMetadataHeaderBooking', () => {
  it('flags an LLM row whose leadName swallowed a labeled header', () => {
    const phantom = makeBooking({
      leadName: 'tour_date: 2026-06-01 | tour_name: 설악산남이섬 마감 | guide: 최순길',
      phone: '20260601',
    })
    expect(looksLikeMetadataHeaderBooking(phantom)).toBe(true)
  })

  it('flags a leadName carrying a bare meta-label token', () => {
    expect(looksLikeMetadataHeaderBooking(makeBooking({ leadName: 'tour_name: 설악산' }))).toBe(true)
  })

  it('does NOT flag an ordinary guest', () => {
    expect(looksLikeMetadataHeaderBooking(makeBooking({ leadName: 'John Smith' }))).toBe(false)
    expect(looksLikeMetadataHeaderBooking(makeBooking({ leadName: '홍길동' }))).toBe(false)
    expect(looksLikeMetadataHeaderBooking(makeBooking({ leadName: '' }))).toBe(false)
  })
})

describe('inheritSectionHeaders — labeled headers', () => {
  it('fills productName from a labeled tour_name header', () => {
    const input =
      'tour_name: 설악산+낙산사+낙산해수욕장 | guide: 이상윤\n' +
      'John Smith / 2 / Lotte Duty Free / +82-10-1234-5678 / GYG'
    const bookings = [makeBooking({ leadName: 'John Smith', productName: undefined })]
    const r = inheritSectionHeaders(input, bookings)
    expect(r.filled).toBe(1)
    expect(bookings[0].productName).toBe('설악산+낙산사+낙산해수욕장')
  })
})

describe('headerAtOffset', () => {
  it('returns the most recent header before the offset', () => {
    const headers = [
      { header: '동쪽', offset: 0 },
      { header: '서쪽', offset: 100 },
    ]
    expect(headerAtOffset(headers, 50)).toBe('동쪽')
    expect(headerAtOffset(headers, 150)).toBe('서쪽')
    expect(headerAtOffset([], 10)).toBe(null)
  })
})

describe('inheritSectionHeaders', () => {
  it('fills productName when none was extracted', () => {
    const input = '동쪽\n\n1번. Jeju Airport\n홍길동 (1명) +82-10-1234-5678'
    const bookings = [makeBooking({ leadName: '홍길동', productName: undefined })]
    const r = inheritSectionHeaders(input, bookings)
    expect(r.filled).toBe(1)
    expect(bookings[0].productName).toBe('동쪽')
  })

  it('does NOT override an existing productName', () => {
    const input = '동쪽\n\n1번. ...\n홍길동'
    const bookings = [makeBooking({ leadName: '홍길동', productName: '카멜리아' })]
    inheritSectionHeaders(input, bookings)
    expect(bookings[0].productName).toBe('카멜리아')
  })

  it('inherits the correct header when multiple sections exist', () => {
    const input = [
      '동쪽',
      '',
      '1번. Hotel A',
      '김철수 +82-10-1111-2222',
      '',
      '서쪽',
      '',
      '2번. Hotel B',
      '이영희 +82-10-9999-8888',
    ].join('\n')
    const bookings = [
      makeBooking({ leadName: '김철수', productName: undefined }),
      makeBooking({ leadName: '이영희', productName: undefined }),
    ]
    const r = inheritSectionHeaders(input, bookings)
    expect(r.filled).toBe(2)
    expect(bookings[0].productName).toBe('동쪽')
    expect(bookings[1].productName).toBe('서쪽')
  })

  it('locates by externalBookingId when name is missing', () => {
    const input = '동쪽\n\n1번. MBE731099 Jeju Airport'
    const bookings = [makeBooking({ leadName: undefined, externalBookingId: 'MBE731099' })]
    inheritSectionHeaders(input, bookings)
    expect(bookings[0].productName).toBe('동쪽')
  })
})
