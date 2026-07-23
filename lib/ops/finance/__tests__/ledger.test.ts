import { computeCaptureSplit, kstPeriod, recordCaptureLedger } from '../ledger'

describe('computeCaptureSplit', () => {
  it('splits gross into commission (5%) + remit summing exactly to gross', () => {
    // $144.00 = 14400 cents, 5% = 720, remit = 13680
    const s = computeCaptureSplit(14400, 0.05)
    expect(s).toEqual({ grossMinor: 14400, commissionMinor: 720, remitMinor: 13680 })
    expect(s.commissionMinor + s.remitMinor).toBe(s.grossMinor)
  })

  it('rounds commission to nearest cent and keeps the sum exact', () => {
    // 9999 * 0.05 = 499.95 → round 500; remit = 9499
    const s = computeCaptureSplit(9999, 0.05)
    expect(s.commissionMinor).toBe(500)
    expect(s.remitMinor).toBe(9499)
    expect(s.commissionMinor + s.remitMinor).toBe(9999)
  })

  it('clamps negative/NaN gross to 0 and defaults an out-of-range rate to 5%', () => {
    expect(computeCaptureSplit(-100, 0.05)).toEqual({ grossMinor: 0, commissionMinor: 0, remitMinor: 0 })
    expect(computeCaptureSplit(1000, 2)).toEqual({ grossMinor: 1000, commissionMinor: 50, remitMinor: 950 })
    expect(computeCaptureSplit(Number.NaN, 0.05)).toEqual({ grossMinor: 0, commissionMinor: 0, remitMinor: 0 })
  })
})

describe('kstPeriod', () => {
  it('formats YYYY-MM in KST', () => {
    // 2026-07-31 20:00 UTC = 2026-08-01 05:00 KST → 2026-08
    expect(kstPeriod(Date.parse('2026-07-31T20:00:00Z'))).toBe('2026-08')
    // 2026-07-31 10:00 UTC = 2026-07-31 19:00 KST → 2026-07
    expect(kstPeriod(Date.parse('2026-07-31T10:00:00Z'))).toBe('2026-07')
  })
})

// Minimal supabase stub capturing the upsert payload.
function makeSupabase() {
  const calls: Array<{ table: string; rows: unknown; opts: unknown }> = []
  const client = {
    from(table: string) {
      return {
        upsert(rows: unknown, opts: unknown) {
          calls.push({ table, rows, opts })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
  return { client: client as never, calls }
}

describe('recordCaptureLedger', () => {
  it('writes revenue + commission rows idempotently (us entity, uppercased currency)', async () => {
    const { client, calls } = makeSupabase()
    const res = await recordCaptureLedger(client, {
      bookingId: 'bk-1',
      grossMinor: 14400,
      currency: 'usd',
      marginRate: 0.05,
      paymentIntentId: 'pi_123',
      nowMs: Date.parse('2026-08-17T02:00:00Z'), // 11:00 KST 8/17
    })
    expect(res.ok).toBe(true)
    expect(res.split).toEqual({ grossMinor: 14400, commissionMinor: 720, remitMinor: 13680 })
    expect(calls).toHaveLength(1)
    const rows = calls[0].rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ entity: 'us', type: 'revenue', amount_minor: 14400, currency: 'USD', period: '2026-08', source: 'stripe_capture', external_ref: 'pi_123' })
    expect(rows[1]).toMatchObject({ entity: 'us', type: 'commission', amount_minor: 720, currency: 'USD' })
    expect(calls[0].opts).toMatchObject({ onConflict: 'booking_id,entity,type,source', ignoreDuplicates: true })
  })

  it('skips non-positive gross without touching the DB', async () => {
    const { client, calls } = makeSupabase()
    const res = await recordCaptureLedger(client, { bookingId: 'bk-2', grossMinor: 0, currency: 'usd', marginRate: 0.05 })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('non_positive_gross')
    expect(calls).toHaveLength(0)
  })

  it('never throws; returns error result when upsert fails', async () => {
    const client = {
      from() {
        return { upsert: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }
      },
    } as never
    const res = await recordCaptureLedger(client, { bookingId: 'bk-3', grossMinor: 1000, currency: 'usd', marginRate: 0.05 })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('boom')
  })
})
