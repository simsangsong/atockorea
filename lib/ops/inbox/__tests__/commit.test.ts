/**
 * @jest-environment node
 *
 * Slice 2 — inbox commit state machine (plan A-5~A-7). Everything mocked:
 * funnel, Supabase, tour-room ensureRoom, failures, alert — network zero.
 */
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { commitInboundEmail, maskName, AUTO_COMMIT_MIN_CONFIDENCE } from '../commit'
import { runFunnel } from '@/lib/ops/parse/funnel'
import { recordParseFailures } from '@/lib/ops/parse/failures'
import { ensureRoom } from '@/lib/tour-room/access'
import { sendLowConfidenceAlert } from '../alert'

jest.mock('@/lib/ops/parse/funnel', () => ({ runFunnel: jest.fn() }))
jest.mock('@/lib/ops/parse/failures', () => ({ recordParseFailures: jest.fn(async () => undefined) }))
jest.mock('@/lib/tour-room/access', () => ({
  ensureRoom: jest.fn(async (_db: unknown, b: { id: string }) => ({ id: `room-${b.id}`, booking_id: b.id, status: 'active' })),
}))
jest.mock('../alert', () => ({ sendLowConfidenceAlert: jest.fn(async () => ({ sent: false, skipped: true })) }))

const runFunnelMock = runFunnel as jest.Mock
const recordParseFailuresMock = recordParseFailures as jest.Mock
const ensureRoomMock = ensureRoom as jest.Mock
const alertMock = sendLowConfidenceAlert as jest.Mock

function parsedBooking(overrides: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    sourcePlatform: 'klook',
    externalBookingId: 'KLK-1001',
    leadName: 'Massimo Cassina',
    partySize: 2,
    tourDate: '2026-08-17',
    productName: 'Jeju East Bus Tour',
    pickupPointRaw: 'Lotte Hotel Jeju',
    pickupPointNormalized: 'Lotte Hotel Jeju',
    email: 'maxcmax@gmail.com',
    phone: '+39 333 1234567',
    confidenceScore: 0.95,
    issues: [],
    ...overrides,
  }
}

interface FakeDbOptions {
  productMap?: { tour_id: string; tour_kind: string } | null
  existingBooking?: Record<string, unknown> | null
  insertError?: { code: string; message?: string } | null
}

function fakeDb(opts: FakeDbOptions = {}) {
  const bookingInserts: Array<Record<string, unknown>> = []
  const bookingUpdates: Array<Record<string, unknown>> = []
  const db = {
    bookingInserts,
    bookingUpdates,
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {}
      chain.select = jest.fn(() => chain)
      chain.eq = jest.fn(() => chain)
      chain.maybeSingle = jest.fn(async () => {
        if (table === 'ops_channel_product_map') return { data: opts.productMap ?? null, error: null }
        if (table === 'bookings') return { data: opts.existingBooking ?? null, error: null }
        if (table === 'tours') return { data: { id: 'tour-1', merchant_id: 'm-1' }, error: null }
        return { data: null, error: null }
      })
      chain.insert = jest.fn((row: Record<string, unknown>) => {
        if (table === 'bookings') bookingInserts.push(row)
        return {
          select: () => ({
            single: async () =>
              opts.insertError ? { data: null, error: opts.insertError } : { data: { id: 'b-new' }, error: null },
          }),
        }
      })
      chain.update = jest.fn((row: Record<string, unknown>) => {
        if (table === 'bookings') bookingUpdates.push(row)
        return { eq: jest.fn(async () => ({ error: null })) }
      })
      return chain
    },
  }
  return db
}

function funnelReturns(bookings: ParsedBooking[]) {
  runFunnelMock.mockResolvedValue({
    bookings,
    metrics: {
      l0_hits: 0, l1_hits: bookings.length, l2_hits: 0, l3_hits: 0, l4_hits: 0,
      l3_enrichment: 0, l0_row_hits: 0, repairs_applied: 0, escalations: 0,
      mean_structural_confidence: null, total: bookings.length, elapsed_ms: 5,
      cost_usd: 0, layers_used: ['l1'],
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

const baseInput = { tenantId: 'atockorea', channel: 'klook' as const, intent: 'confirm' as const, raw: 'Subject: x\n\nbody', messageId: 'msg-1' }

describe('commitInboundEmail — confirm', () => {
  it('auto-commits a mapped high-confidence booking with payment_status external + room via ensureRoom', async () => {
    funnelReturns([parsedBooking()])
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'join' } })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })

    expect(out.items).toHaveLength(1)
    expect(out.items[0].commitResult).toBe('auto_committed')
    expect(out.items[0].bookingId).toBe('b-new')
    expect(out.items[0].roomId).toBe('room-b-new')
    expect(out.items[0].tourKind).toBe('join')
    expect(out.aggregateResult).toBe('auto_committed')

    expect(db.bookingInserts).toHaveLength(1)
    const row = db.bookingInserts[0]
    expect(row.source).toBe('klook')
    expect(row.external_booking_id).toBe('KLK-1001')
    expect(row.payment_status).toBe('external')
    expect(row.status).toBe('confirmed')
    expect(row.tour_id).toBe('tour-1')
    // 기존 결제 플로우 필드는 절대 건드리지 않는다.
    expect(row).not.toHaveProperty('payment_intent_id')
    expect(row).not.toHaveProperty('card_collection_method')

    expect(ensureRoomMock).toHaveBeenCalledTimes(1)
    expect(ensureRoomMock).toHaveBeenCalledWith(db, { id: 'b-new', tour_id: 'tour-1', tour_date: '2026-08-17' })
  })

  it('demotes an UNMAPPED product to review_queued — no booking write, no room (plan A-7b)', async () => {
    funnelReturns([parsedBooking({ productName: 'Some Unknown Tour' })])
    const db = fakeDb({ productMap: null })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })

    expect(out.items[0].commitResult).toBe('review_queued')
    expect(out.items[0].reason).toBe('unmapped_product')
    expect(db.bookingInserts).toHaveLength(0)
    expect(db.bookingUpdates).toHaveLength(0)
    expect(ensureRoomMock).not.toHaveBeenCalled()
  })

  it('routes mid confidence (0.60~0.84) to review_queued even when mapped', async () => {
    funnelReturns([parsedBooking({ confidenceScore: 0.7 })])
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'private' } })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })

    expect(AUTO_COMMIT_MIN_CONFIDENCE).toBe(0.85)
    expect(out.items[0].commitResult).toBe('review_queued')
    expect(out.items[0].reason).toBe('confidence_below_auto')
    expect(out.items[0].tourKind).toBe('private')
    expect(db.bookingInserts).toHaveLength(0)
    expect(ensureRoomMock).not.toHaveBeenCalled()
  })

  it('fails <0.60 into recordParseFailures (masked) + alert hook', async () => {
    funnelReturns([parsedBooking({ confidenceScore: 0.4, email: 'leak@example.com' })])
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'join' } })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })

    expect(out.items[0].commitResult).toBe('failed')
    expect(out.items[0].reason).toBe('low_confidence')
    expect(db.bookingInserts).toHaveLength(0)
    expect(recordParseFailuresMock).toHaveBeenCalledTimes(1)
    const records = recordParseFailuresMock.mock.calls[0][2]
    expect(records).toHaveLength(1)
    expect(records[0].layer).toBe('inbox_commit')
    // masked — 원문 이메일 주소가 실패 코퍼스로 새지 않는다.
    expect(records[0].rawLineMasked).not.toContain('leak@example.com')
    expect(alertMock).toHaveBeenCalledTimes(1)
    expect(out.alert).toEqual({ sent: false, skipped: true })
  })

  it('re-commit of an existing (source, external_booking_id) is an idempotent update, not a duplicate insert', async () => {
    funnelReturns([parsedBooking()])
    const db = fakeDb({
      productMap: { tour_id: 'tour-1', tour_kind: 'join' },
      existingBooking: { id: 'b-existing', tour_id: 'tour-1', tour_date: '2026-08-17', status: 'confirmed', ota_raw_meta: null },
    })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })

    expect(out.items[0].commitResult).toBe('auto_committed')
    expect(out.items[0].bookingId).toBe('b-existing')
    expect(db.bookingInserts).toHaveLength(0)
    expect(db.bookingUpdates).toHaveLength(1)
    expect(db.bookingUpdates[0]).not.toHaveProperty('payment_status') // 기존 행 결제 상태 불변
    expect(db.bookingUpdates[0]).not.toHaveProperty('status')
  })

  it('demotes when tour_date is missing (room needs a date)', async () => {
    funnelReturns([parsedBooking({ tourDate: undefined })])
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'join' } })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })
    expect(out.items[0].commitResult).toBe('review_queued')
    expect(out.items[0].reason).toBe('missing_tour_date')
  })

  it('uses the parser row platform when the email channel is unknown', async () => {
    funnelReturns([parsedBooking({ sourcePlatform: 'gyg', externalBookingId: 'GYG-9' })])
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'join' } })
    const out = await commitInboundEmail({ ...baseInput, channel: 'unknown', supabase: db as never })
    expect(out.items[0].commitResult).toBe('auto_committed')
    expect(db.bookingInserts[0].source).toBe('gyg')
  })
})

describe('commitInboundEmail — cancel', () => {
  it('soft-cancels a matched booking (status only)', async () => {
    funnelReturns([parsedBooking({ confidenceScore: 0.9 })])
    const db = fakeDb({
      existingBooking: { id: 'b-1', tour_id: 'tour-1', tour_date: '2026-08-17', status: 'confirmed', ota_raw_meta: null },
    })
    const out = await commitInboundEmail({ ...baseInput, intent: 'cancel', supabase: db as never })

    expect(out.items[0].commitResult).toBe('cancelled')
    expect(out.items[0].bookingId).toBe('b-1')
    expect(db.bookingUpdates).toHaveLength(1)
    expect(db.bookingUpdates[0]).toEqual({ status: 'cancelled' }) // soft only — 다른 필드 불변
    expect(ensureRoomMock).not.toHaveBeenCalled()
  })

  it('queues for review when the cancel target is not found', async () => {
    funnelReturns([parsedBooking()])
    const db = fakeDb({ existingBooking: null })
    const out = await commitInboundEmail({ ...baseInput, intent: 'cancel', supabase: db as never })
    expect(out.items[0].commitResult).toBe('review_queued')
    expect(out.items[0].reason).toBe('cancel_target_not_found')
    expect(db.bookingUpdates).toHaveLength(0)
  })

  it('skips the update when already cancelled (idempotent)', async () => {
    funnelReturns([parsedBooking()])
    const db = fakeDb({
      existingBooking: { id: 'b-1', tour_id: 't', tour_date: '2026-08-17', status: 'cancelled', ota_raw_meta: null },
    })
    const out = await commitInboundEmail({ ...baseInput, intent: 'cancel', supabase: db as never })
    expect(out.items[0].commitResult).toBe('cancelled')
    expect(db.bookingUpdates).toHaveLength(0)
  })
})

describe('commitInboundEmail — change', () => {
  it('patches ONLY whitelisted fields (tour_date / guests / pickup→ota_raw_meta)', async () => {
    funnelReturns([
      parsedBooking({
        tourDate: '2026-08-20',
        partySize: 4,
        pickupPointRaw: 'Shin Jeju Rotary',
        pickupPointNormalized: 'Shin Jeju Rotary',
        leadName: 'Someone Else', // must NOT be patched
        email: 'new@example.com', // must NOT be patched
      }),
    ])
    const db = fakeDb({
      existingBooking: {
        id: 'b-1', tour_id: 'tour-1', tour_date: '2026-08-17', status: 'confirmed',
        ota_raw_meta: { channel: 'klook', tour_kind: 'join' },
      },
    })
    const out = await commitInboundEmail({ ...baseInput, intent: 'change', supabase: db as never })

    expect(out.items[0].commitResult).toBe('changed')
    expect(db.bookingUpdates).toHaveLength(1)
    const patch = db.bookingUpdates[0]
    expect(Object.keys(patch).sort()).toEqual(['booking_date', 'number_of_guests', 'ota_raw_meta', 'tour_date'])
    expect(patch.tour_date).toBe('2026-08-20')
    expect(patch.number_of_guests).toBe(4)
    expect((patch.ota_raw_meta as Record<string, unknown>).pickup_raw).toBe('Shin Jeju Rotary')
    // 기존 meta 보존 (merge)
    expect((patch.ota_raw_meta as Record<string, unknown>).tour_kind).toBe('join')
    expect(out.items[0].maskedSummary.changed_fields).toEqual(['tour_date', 'number_of_guests', 'pickup'])
  })

  it('queues change below auto-commit confidence', async () => {
    funnelReturns([parsedBooking({ confidenceScore: 0.7 })])
    const db = fakeDb({ existingBooking: { id: 'b-1', tour_id: 't', tour_date: '2026-08-17', status: 'confirmed', ota_raw_meta: null } })
    const out = await commitInboundEmail({ ...baseInput, intent: 'change', supabase: db as never })
    expect(out.items[0].commitResult).toBe('review_queued')
    expect(out.items[0].reason).toBe('change_confidence_below_auto')
    expect(db.bookingUpdates).toHaveLength(0)
  })
})

describe('aggregate + masking', () => {
  it('aggregates worst-first (failed > review_queued > auto_committed)', async () => {
    funnelReturns([
      parsedBooking({ externalBookingId: 'A-1' }),
      parsedBooking({ externalBookingId: 'A-2', productName: 'Unknown Product X' }),
      parsedBooking({ externalBookingId: 'A-3', confidenceScore: 0.3 }),
    ])
    // Mapping only resolves for the known product name via normalized key — our
    // fake returns the same map for every lookup, so simulate the unmapped row
    // by keying off insert behaviour instead: use per-call mock.
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'join' } })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })
    expect(out.aggregateResult).toBe('failed')
    expect(out.maxConfidence).toBe(0.95)
    expect(out.firstBookingId).toBe('b-new')
  })

  it('masked summary carries initials, never the full contact', async () => {
    funnelReturns([parsedBooking()])
    const db = fakeDb({ productMap: { tour_id: 'tour-1', tour_kind: 'join' } })
    const out = await commitInboundEmail({ ...baseInput, supabase: db as never })
    const summary = out.items[0].maskedSummary
    expect(summary.lead_name).toBe('Massimo C.')
    expect(JSON.stringify(summary)).not.toContain('maxcmax@gmail.com')
    expect(JSON.stringify(summary)).not.toContain('1234567')
  })
})

describe('maskName', () => {
  it('reduces to first name + initial (plan §5.2 style)', () => {
    expect(maskName('Massimo Cassina')).toBe('Massimo C.')
    expect(maskName('Cher')).toBe('Cher')
    expect(maskName('')).toBeNull()
    expect(maskName(null)).toBeNull()
  })
})
