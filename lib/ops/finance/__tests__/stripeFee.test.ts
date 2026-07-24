// §6.3 — Stripe 실수수료 추출. "모르면 비워둔다"가 계약이므로 결측 형태를
// 전부 통과시킨다. 네트워크 0.

import { fetchStripeFee, readStripeFee } from '../stripeFee'
import { recordCaptureLedger } from '../ledger'

const bt = (over: Record<string, unknown> = {}) => ({
  id: 'txn_1',
  fee: 476,
  currency: 'usd',
  status: 'available',
  exchange_rate: null,
  ...over,
})

const charge = (over: Record<string, unknown> = {}) => ({
  id: 'ch_1',
  balance_transaction: bt(),
  ...over,
})

describe('readStripeFee — 값의 출처는 balance transaction 뿐', () => {
  it('reads the actual fee, never a rate', () => {
    // $144.00 결제의 실제 수수료가 $4.76이면 4.76이지, 2.9%+30¢(=$4.48)가 아니다.
    const res = readStripeFee(charge())
    expect(res).toEqual({
      ok: true,
      fee: {
        feeMinor: 476,
        currency: 'USD',
        balanceTransactionId: 'txn_1',
        chargeId: 'ch_1',
        exchangeRate: null,
      },
    })
  })

  it('keeps the settlement currency and exchange rate when they differ from the charge', () => {
    const res = readStripeFee(charge({ balance_transaction: bt({ currency: 'krw', exchange_rate: 1330.5 }) }))
    expect(res.ok && res.fee).toMatchObject({ currency: 'KRW', exchangeRate: 1330.5 })
  })

  it('reports a gap instead of guessing when the balance transaction is not expanded', () => {
    expect(readStripeFee(charge({ balance_transaction: 'txn_1' }))).toEqual({ ok: false, reason: 'not_expanded' })
    expect(readStripeFee(charge({ balance_transaction: bt({ fee: undefined }) }))).toEqual({
      ok: false,
      reason: 'not_expanded',
    })
    expect(readStripeFee(charge({ balance_transaction: bt({ currency: null }) }))).toEqual({
      ok: false,
      reason: 'not_expanded',
    })
  })

  it('reports a gap when there is no charge at all', () => {
    expect(readStripeFee(null)).toEqual({ ok: false, reason: 'no_charge' })
    expect(readStripeFee(undefined)).toEqual({ ok: false, reason: 'no_charge' })
    expect(readStripeFee({ id: 'ch_1', balance_transaction: null })).toEqual({ ok: false, reason: 'no_charge' })
  })
})

describe('fetchStripeFee', () => {
  it('uses an already-expanded PaymentIntent without calling Stripe', async () => {
    const retrieve = jest.fn()
    const res = await fetchStripeFee({ charges: { retrieve } } as never, { latest_charge: charge() })
    expect(res.ok && res.fee.feeMinor).toBe(476)
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('retrieves the charge with the balance transaction expanded when it is only an id', async () => {
    const retrieve = jest.fn(async () => charge())
    const res = await fetchStripeFee({ charges: { retrieve } } as never, { latest_charge: 'ch_1' })
    expect(res.ok && res.fee.feeMinor).toBe(476)
    expect(retrieve).toHaveBeenCalledWith('ch_1', { expand: ['balance_transaction'] })
  })

  it('never throws — a Stripe failure is a recorded gap, not an exception', async () => {
    const retrieve = jest.fn(async () => {
      throw new Error('stripe down')
    })
    await expect(
      fetchStripeFee({ charges: { retrieve } } as never, { latest_charge: 'ch_1' }),
    ).resolves.toEqual({ ok: false, reason: 'lookup_failed' })

    await expect(fetchStripeFee({ charges: { retrieve } } as never, { latest_charge: null })).resolves.toEqual({
      ok: false,
      reason: 'no_charge',
    })
  })
})

// ---------------------------------------------------------------------------
// 원장 기입 — 멱등키 + 부호 + "모르면 안 쓴다"
// ---------------------------------------------------------------------------

function makeSupabase() {
  const calls: Array<{ rows: unknown; opts: unknown }> = []
  const client = {
    from() {
      return {
        upsert(rows: unknown, opts: unknown) {
          calls.push({ rows, opts })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
  return { client: client as never, calls }
}

const CAPTURE = {
  bookingId: 'bk-1',
  grossMinor: 14400,
  currency: 'usd',
  marginRate: 0.05,
  paymentIntentId: 'pi_123',
  nowMs: Date.parse('2026-08-17T02:00:00Z'),
}

describe('recordCaptureLedger — fee 행 (§6.3)', () => {
  it('writes a third (us, fee, −actual) row on the SAME idempotency key family', async () => {
    const { client, calls } = makeSupabase()
    const res = await recordCaptureLedger(client, {
      ...CAPTURE,
      stripeFee: {
        feeMinor: 476,
        currency: 'USD',
        balanceTransactionId: 'txn_1',
        chargeId: 'ch_1',
        exchangeRate: null,
      },
    })
    expect(res.ok).toBe(true)
    expect(res.feeRecorded).toBe(true)

    const rows = calls[0].rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(3)
    expect(rows[2]).toMatchObject({
      entity: 'us',
      type: 'fee',
      // 유출은 음수 — 정수 minor units, 부동소수 없음.
      amount_minor: -476,
      currency: 'USD',
      source: 'stripe_capture',
      external_ref: 'pi_123',
      period: '2026-08',
    })
    expect(Number.isInteger(rows[2].amount_minor as number)).toBe(true)
    expect(rows[2].meta).toMatchObject({ balance_transaction: 'txn_1', charge: 'ch_1' })
    // webhook과 cron이 같은 캡처에 이중 발화해도 1행으로 수렴하는 그 키.
    expect(calls[0].opts).toMatchObject({
      onConflict: 'booking_id,entity,type,source',
      ignoreDuplicates: true,
    })
  })

  it('writes only the two known rows when the fee is unavailable, and says why', async () => {
    const { client, calls } = makeSupabase()
    const res = await recordCaptureLedger(client, { ...CAPTURE, stripeFee: null, stripeFeeGap: 'not_expanded' })
    expect(res.ok).toBe(true)
    expect(res.feeRecorded).toBe(false)
    expect(res.feeGap).toBe('not_expanded')
    expect((calls[0].rows as unknown[])).toHaveLength(2)
  })

  it('does not invent a fee row when nothing was passed at all (previous callers)', async () => {
    const { client, calls } = makeSupabase()
    const res = await recordCaptureLedger(client, CAPTURE)
    expect((calls[0].rows as unknown[])).toHaveLength(2)
    expect(res.feeRecorded).toBe(false)
    expect(res.feeGap).toBe('fee_not_available')
  })

  it('treats a zero/negative reported fee as "not known" rather than a 0 row', async () => {
    const { client, calls } = makeSupabase()
    const res = await recordCaptureLedger(client, {
      ...CAPTURE,
      stripeFee: { feeMinor: 0, currency: 'USD', balanceTransactionId: null, chargeId: null, exchangeRate: null },
    })
    expect((calls[0].rows as unknown[])).toHaveLength(2)
    expect(res.feeRecorded).toBe(false)
    expect(res.feeGap).toBe('non_positive_fee')
  })
})
