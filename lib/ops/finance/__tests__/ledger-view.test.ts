import {
  computeLedgerTotals,
  emptyLedgerTotals,
  isMissingTableError,
  normalizeLedgerPeriod,
  type LedgerViewRow,
} from '../ledger-view'

describe('computeLedgerTotals', () => {
  it('derives gross / commission / remit(95%) from us revenue+commission rows', () => {
    // 8/17 첫 실주문 2건 (각 $144.00): gross 28800, commission 1440, remit 27360
    const rows: LedgerViewRow[] = [
      { entity: 'us', booking_id: 'bk-1', type: 'revenue', amount_minor: 14400, currency: 'USD' },
      { entity: 'us', booking_id: 'bk-1', type: 'commission', amount_minor: 720, currency: 'USD' },
      { entity: 'us', booking_id: 'bk-2', type: 'revenue', amount_minor: 14400, currency: 'usd' },
      { entity: 'us', booking_id: 'bk-2', type: 'commission', amount_minor: 720, currency: 'usd' },
    ]
    const t = computeLedgerTotals(rows)
    expect(t).toEqual({
      currency: 'USD',
      grossMinor: 28800,
      commissionMinor: 1440,
      remitMinor: 27360,
      bookingCount: 2,
    })
    expect(t.commissionMinor + t.remitMinor).toBe(t.grossMinor)
  })

  it('ignores kr rows in the gross/commission roll-up', () => {
    const rows: LedgerViewRow[] = [
      { entity: 'us', booking_id: 'bk-1', type: 'revenue', amount_minor: 10000, currency: 'USD' },
      { entity: 'us', booking_id: 'bk-1', type: 'commission', amount_minor: 500, currency: 'USD' },
      { entity: 'kr', booking_id: 'bk-1', type: 'remit', amount_minor: 9500, currency: 'USD' },
    ]
    const t = computeLedgerTotals(rows)
    expect(t.grossMinor).toBe(10000)
    expect(t.commissionMinor).toBe(500)
    expect(t.remitMinor).toBe(9500)
  })

  it('returns all-zero totals for an empty ledger', () => {
    expect(computeLedgerTotals([])).toEqual(emptyLedgerTotals())
  })
})

describe('isMissingTableError', () => {
  it('recognises PostgREST/undefined_table codes', () => {
    expect(isMissingTableError('PGRST205')).toBe(true)
    expect(isMissingTableError('PGRST200')).toBe(true)
    expect(isMissingTableError('42P01')).toBe(true)
  })
  it('does not misclassify other errors as missing-table', () => {
    expect(isMissingTableError('23505')).toBe(false)
    expect(isMissingTableError(undefined)).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
  })
})

describe('normalizeLedgerPeriod', () => {
  it('passes a valid YYYY-MM through and rejects anything else', () => {
    expect(normalizeLedgerPeriod('2026-08')).toBe('2026-08')
    expect(normalizeLedgerPeriod('2026-8')).toBeNull()
    expect(normalizeLedgerPeriod('2026-08-17')).toBeNull()
    expect(normalizeLedgerPeriod('')).toBeNull()
    expect(normalizeLedgerPeriod(null)).toBeNull()
  })
})
