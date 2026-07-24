import { makeFakeFinanceDb, ledgerPair } from '@/test-utils/fakeFinanceDb'
import {
  aggregatePeriod,
  closePeriod,
  emptyAggregate,
  fetchPeriodLedgerRows,
  invoiceNumberFor,
  LEDGER_FETCH_LIMIT,
  isValidPeriod,
  nextInvoiceSeq,
  parseInvoiceSeq,
  parseUsdToMinor,
  periodBounds,
  reconcile,
  statusRank,
  type SettlementLedgerRow,
} from '../settlement'

describe('aggregatePeriod', () => {
  it('returns all-zero totals for an empty ledger', () => {
    expect(aggregatePeriod([])).toEqual(emptyAggregate())
  })

  it('keeps commission + remit exactly equal to gross', () => {
    // $144.00 캡처 1건, 5% → commission 720, remit 13680
    const rows = ledgerPair('bk-1', '2026-08', 14400) as SettlementLedgerRow[]
    const agg = aggregatePeriod(rows, '2026-08')
    expect(agg.grossMinor).toBe(14400)
    expect(agg.commissionMinor).toBe(720)
    expect(agg.remitMinor).toBe(13680)
    expect(agg.commissionMinor + agg.remitMinor).toBe(agg.grossMinor)
  })

  it('sums several orders and counts distinct bookings once', () => {
    const rows = [
      ...ledgerPair('bk-1', '2026-08', 14400),
      ...ledgerPair('bk-2', '2026-08', 20000),
      ...ledgerPair('bk-3', '2026-08', 5099),
    ] as SettlementLedgerRow[]
    const agg = aggregatePeriod(rows, '2026-08')
    expect(agg.grossMinor).toBe(14400 + 20000 + 5099)
    expect(agg.commissionMinor).toBe(720 + 1000 + 255)
    expect(agg.remitMinor).toBe(agg.grossMinor - agg.commissionMinor)
    expect(agg.orderCount).toBe(3)
  })

  it('excludes kr rows and rows from another period', () => {
    const rows: SettlementLedgerRow[] = [
      ...(ledgerPair('bk-1', '2026-08', 10000) as SettlementLedgerRow[]),
      // 다른 달 — 세면 안 된다.
      ...(ledgerPair('bk-9', '2026-07', 99999) as SettlementLedgerRow[]),
      // 한국법인 사이드 — 같은 돈의 반대편이라 이중계상 금지.
      { entity: 'kr', booking_id: 'bk-1', period: '2026-08', type: 'remit', amount_minor: 9500, currency: 'USD' },
    ]
    const agg = aggregatePeriod(rows, '2026-08')
    expect(agg.grossMinor).toBe(10000)
    expect(agg.commissionMinor).toBe(500)
    expect(agg.remitMinor).toBe(9500)
    expect(agg.orderCount).toBe(1)
  })

  it('does not re-derive remit from the rate — a mismatched ledger stays visible', () => {
    // 원장에 5%가 아닌 커미션이 기입돼 있어도 송금분은 gross − commission 그대로다.
    // (비율로 재계산하면 원장의 이상이 조용히 지워진다.)
    const rows: SettlementLedgerRow[] = [
      { entity: 'us', booking_id: 'bk-1', period: '2026-08', type: 'revenue', amount_minor: 10000, currency: 'USD' },
      { entity: 'us', booking_id: 'bk-1', period: '2026-08', type: 'commission', amount_minor: 1234, currency: 'USD' },
    ]
    expect(aggregatePeriod(rows, '2026-08').remitMinor).toBe(8766)
  })
})

describe('aggregatePeriod — Stripe 실수수료 집계 (§6.3)', () => {
  /** 원장의 fee 행: 유출이므로 음수. */
  const feeRow = (bookingId: string, feeMinor: number, currency = 'USD'): SettlementLedgerRow => ({
    entity: 'us',
    booking_id: bookingId,
    period: '2026-08',
    type: 'fee',
    amount_minor: -feeMinor,
    currency,
  })

  it('sums fee rows as a positive magnitude in integer minor units', () => {
    const rows: SettlementLedgerRow[] = [
      ...(ledgerPair('bk-1', '2026-08', 14400) as SettlementLedgerRow[]),
      ...(ledgerPair('bk-2', '2026-08', 20000) as SettlementLedgerRow[]),
      feeRow('bk-1', 476),
      feeRow('bk-2', 610),
    ]
    const agg = aggregatePeriod(rows, '2026-08')
    expect(agg.stripeFeeMinor).toBe(1086)
    expect(Number.isInteger(agg.stripeFeeMinor as number)).toBe(true)
    expect(agg.feeKnownOrders).toBe(2)
    // 수수료는 gross/commission/remit 산식에 절대 끼어들지 않는다.
    expect(agg.commissionMinor + agg.remitMinor).toBe(agg.grossMinor)
    expect(agg.grossMinor).toBe(34400)
  })

  it('says "모른다"(null) rather than 0 when no fee row exists', () => {
    const agg = aggregatePeriod(ledgerPair('bk-1', '2026-08', 14400) as SettlementLedgerRow[], '2026-08')
    expect(agg.stripeFeeMinor).toBeNull()
    expect(agg.feeKnownOrders).toBe(0)
  })

  it('reports partial coverage instead of pretending the sum is complete', () => {
    const rows: SettlementLedgerRow[] = [
      ...(ledgerPair('bk-1', '2026-08', 14400) as SettlementLedgerRow[]),
      ...(ledgerPair('bk-2', '2026-08', 20000) as SettlementLedgerRow[]),
      ...(ledgerPair('bk-3', '2026-08', 5000) as SettlementLedgerRow[]),
      feeRow('bk-1', 476),
    ]
    const agg = aggregatePeriod(rows, '2026-08')
    expect(agg.orderCount).toBe(3)
    expect(agg.feeKnownOrders).toBe(1) // 3건 중 1건만 확인됨 — 정산서가 이 사실을 쓴다
    expect(agg.stripeFeeMinor).toBe(476)
  })

  it('never mixes currencies into the fee total, and never lets a fee row set the period currency', () => {
    const rows: SettlementLedgerRow[] = [
      ...(ledgerPair('bk-1', '2026-08', 14400) as SettlementLedgerRow[]),
      feeRow('bk-1', 476),
      feeRow('bk-2', 90000, 'KRW'), // 정산통화가 다른 행 — 더하면 안 된다
    ]
    const agg = aggregatePeriod(rows, '2026-08')
    expect(agg.currency).toBe('USD')
    expect(agg.stripeFeeMinor).toBe(476)
    expect(agg.feeKnownOrders).toBe(1)
  })

  it('ignores fee rows from the kr side or another month', () => {
    const rows: SettlementLedgerRow[] = [
      ...(ledgerPair('bk-1', '2026-08', 14400) as SettlementLedgerRow[]),
      feeRow('bk-1', 476),
      { entity: 'kr', booking_id: 'bk-1', period: '2026-08', type: 'fee', amount_minor: -999, currency: 'USD' },
      { entity: 'us', booking_id: 'bk-9', period: '2026-07', type: 'fee', amount_minor: -888, currency: 'USD' },
    ]
    expect(aggregatePeriod(rows, '2026-08').stripeFeeMinor).toBe(476)
  })
})

describe('closePeriod — stripe_fee_minor는 원장에서 나온다 (§6.3)', () => {
  const seedWithFee = () =>
    makeFakeFinanceDb({
      ops_entity_ledger: [
        ...ledgerPair('bk-1', '2026-08', 14400),
        ...ledgerPair('bk-2', '2026-08', 20000),
        {
          tenant_id: 'atockorea',
          entity: 'us',
          booking_id: 'bk-1',
          period: '2026-08',
          type: 'fee',
          amount_minor: -476,
          currency: 'USD',
          source: 'stripe_capture',
        },
      ],
    })

  it('populates the column from the fee rows, not from a guessed rate', async () => {
    const db = seedWithFee()
    const res = await closePeriod(db as never, '2026-08', { marginRate: 0.05 })
    expect(res.period.stripe_fee_minor).toBe(476)
    expect(res.period.gross_minor).toBe(34400)
    expect(res.period.commission_minor + res.period.remit_minor).toBe(res.period.gross_minor)
    // 2.9%+30¢ 추정치(=$1.09)는 어디에도 나타나지 않는다.
    expect(res.period.stripe_fee_minor).not.toBe(Math.round(34400 * 0.029) + 60)
  })

  it('leaves the column null when no fee row is in the ledger yet', async () => {
    const db = makeFakeFinanceDb({ ops_entity_ledger: [...ledgerPair('bk-1', '2026-08', 14400)] })
    const res = await closePeriod(db as never, '2026-08', { marginRate: 0.05 })
    expect(res.period.stripe_fee_minor).toBeNull()
  })

  it('picks up a late fee row on re-close (webhook arriving after the cron)', async () => {
    const db = makeFakeFinanceDb({ ops_entity_ledger: [...ledgerPair('bk-1', '2026-08', 14400)] })
    const first = await closePeriod(db as never, '2026-08', { marginRate: 0.05 })
    expect(first.period.stripe_fee_minor).toBeNull()

    db.tables.ops_entity_ledger.push({
      tenant_id: 'atockorea',
      entity: 'us',
      booking_id: 'bk-1',
      period: '2026-08',
      type: 'fee',
      amount_minor: -476,
      currency: 'USD',
      source: 'stripe_capture',
    })
    const second = await closePeriod(db as never, '2026-08', { marginRate: 0.05 })
    expect(second.created).toBe(false) // 같은 달은 여전히 1행 (멱등)
    expect(second.period.stripe_fee_minor).toBe(476)
    expect(db.tables.ops_settlement_periods).toHaveLength(1)
  })
})

describe('fetchPeriodLedgerRows — 잘린 읽기는 조용히 넘어가지 않는다', () => {
  /** 상한만큼 정확히 돌려주는 최소 스텁 (page가 꽉 찬 상황 = 더 있을 수 있음). */
  function stubDb(rowCount: number) {
    const rows = Array.from({ length: rowCount }, () => ({
      entity: 'us',
      booking_id: 'b',
      period: '2026-08',
      type: 'revenue',
      amount_minor: 100,
      currency: 'USD',
      external_ref: null,
    }))
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => Promise.resolve({ data: rows, error: null }),
    }
    return { from: () => builder } as never
  }

  it('상한에 닿으면 과소집계 대신 던진다', async () => {
    await expect(fetchPeriodLedgerRows(stubDb(LEDGER_FETCH_LIMIT), '2026-08')).rejects.toThrow(
      /page limit reached/,
    )
  })

  it('상한 미만이면 그대로 돌려준다', async () => {
    const rows = await fetchPeriodLedgerRows(stubDb(3), '2026-08')
    expect(rows).toHaveLength(3)
  })
})

describe('period helpers', () => {
  it('accepts only YYYY-MM', () => {
    expect(isValidPeriod('2026-08')).toBe(true)
    expect(isValidPeriod('2026-8')).toBe(false)
    expect(isValidPeriod('2026-08-01')).toBe(false)
    expect(isValidPeriod(null)).toBe(false)
  })

  it('anchors month bounds to KST, not UTC', () => {
    // 2026-08-01 00:00 KST = 2026-07-31 15:00 UTC
    expect(periodBounds('2026-08').startIso).toBe('2026-07-31T15:00:00.000Z')
    expect(periodBounds('2026-08').endIso).toBe('2026-08-31T15:00:00.000Z')
  })

  it('rolls the year over at December', () => {
    expect(periodBounds('2026-12').endIso).toBe('2026-12-31T15:00:00.000Z')
  })

  it('orders statuses so the cycle never moves backwards', () => {
    expect(statusRank('open')).toBeLessThan(statusRank('closed'))
    expect(statusRank('closed')).toBeLessThan(statusRank('invoiced'))
    expect(statusRank('invoiced')).toBeLessThan(statusRank('remitted'))
    expect(statusRank('remitted')).toBeLessThan(statusRank('reconciled'))
  })
})

describe('invoice numbering', () => {
  it('formats AK-IC-YYYY-### with three-digit zero padding', () => {
    expect(invoiceNumberFor(2026, 1)).toBe('AK-IC-2026-001')
    expect(invoiceNumberFor(2026, 42)).toBe('AK-IC-2026-042')
    expect(invoiceNumberFor(2026, 999)).toBe('AK-IC-2026-999')
    // 999를 넘으면 잘라내지 않고 자릿수를 늘린다 — 번호를 잃는 것보다 낫다.
    expect(invoiceNumberFor(2026, 1000)).toBe('AK-IC-2026-1000')
  })

  it('round-trips through parseInvoiceSeq and rejects other years/formats', () => {
    expect(parseInvoiceSeq('AK-IC-2026-007', 2026)).toBe(7)
    expect(parseInvoiceSeq('AK-IC-2025-007', 2026)).toBeNull()
    expect(parseInvoiceSeq('AK-IC-2026-XYZ', 2026)).toBeNull()
    expect(parseInvoiceSeq(null, 2026)).toBeNull()
  })

  it('starts at 1 for a fresh year and continues from the max otherwise', async () => {
    const empty = makeFakeFinanceDb()
    await expect(nextInvoiceSeq(empty as never, 2026)).resolves.toBe(1)

    const db = makeFakeFinanceDb({
      ops_intercompany_invoices: [
        { invoice_no: 'AK-IC-2026-001' },
        { invoice_no: 'AK-IC-2026-002' },
        // 다른 해의 번호는 2026 연번에 영향을 주지 않는다.
        { invoice_no: 'AK-IC-2025-050' },
      ],
    })
    await expect(nextInvoiceSeq(db as never, 2026)).resolves.toBe(3)
    await expect(nextInvoiceSeq(db as never, 2025)).resolves.toBe(51)
    // 새 연도는 다시 1부터 — 연번은 연도 단위다.
    await expect(nextInvoiceSeq(db as never, 2027)).resolves.toBe(1)
  })

  it('picks the max numerically, so passing 999 does not rewind the sequence', async () => {
    // 문자열 정렬이면 'AK-IC-2026-1000' < 'AK-IC-2026-999'라 1000 다음에 1000이 또 나온다.
    const db = makeFakeFinanceDb({
      ops_intercompany_invoices: [
        { invoice_no: 'AK-IC-2026-998' },
        { invoice_no: 'AK-IC-2026-999' },
        { invoice_no: 'AK-IC-2026-1000' },
      ],
    })
    await expect(nextInvoiceSeq(db as never, 2026)).resolves.toBe(1001)
  })
})

describe('parseUsdToMinor', () => {
  it('turns human money into integer minor units', () => {
    expect(parseUsdToMinor('273.60')).toBe(27360)
    expect(parseUsdToMinor('1,234.56')).toBe(123456)
    expect(parseUsdToMinor(99.99)).toBe(9999)
    // 부동소수 잔재(0.1+0.2 류)를 여기서 끊는다.
    expect(parseUsdToMinor('0.07')).toBe(7)
  })

  it('rejects zero, negatives and garbage', () => {
    expect(parseUsdToMinor('0')).toBeNull()
    expect(parseUsdToMinor('-5')).toBeNull()
    expect(parseUsdToMinor('abc')).toBeNull()
    expect(parseUsdToMinor('')).toBeNull()
    expect(parseUsdToMinor(undefined)).toBeNull()
  })
})

describe('reconcile — 3자 대사', () => {
  it('passes only when statement, invoice and wires all agree exactly', () => {
    const r = reconcile({ remitMinor: 27360 }, { amountMinor: 27360 }, [{ amountUsdMinor: 27360 }])
    expect(r.ok).toBe(true)
    expect(r.diffs).toEqual({ invoiceVsPeriod: 0, remitVsInvoice: 0 })
    expect(r.remittedMinor).toBe(27360)
  })

  it('sums multiple wires before comparing', () => {
    const r = reconcile({ remitMinor: 27360 }, { amountMinor: 27360 }, [
      { amountUsdMinor: 20000 },
      { amountUsdMinor: 7360 },
    ])
    expect(r.ok).toBe(true)
    expect(r.remittedMinor).toBe(27360)
  })

  it('fails with a signed diff when the invoice disagrees with the statement', () => {
    const r = reconcile({ remitMinor: 27360 }, { amountMinor: 27000 }, [{ amountUsdMinor: 27000 }])
    expect(r.ok).toBe(false)
    expect(r.diffs.invoiceVsPeriod).toBe(-360)
  })

  it('fails when the wires fall short of the invoice (no tolerance for bank fees)', () => {
    const r = reconcile({ remitMinor: 27360 }, { amountMinor: 27360 }, [{ amountUsdMinor: 27300 }])
    expect(r.ok).toBe(false)
    expect(r.diffs.invoiceVsPeriod).toBe(0)
    expect(r.diffs.remitVsInvoice).toBe(-60)
  })

  it('refuses when there is no invoice or no wire at all', () => {
    expect(reconcile({ remitMinor: 100 }, null, [{ amountUsdMinor: 100 }]).ok).toBe(false)
    expect(reconcile({ remitMinor: 100 }, { amountMinor: 100 }, []).ok).toBe(false)
    expect(reconcile(null, { amountMinor: 100 }, [{ amountUsdMinor: 100 }]).ok).toBe(false)
  })

  it('treats an all-zero period as reconciled only once a matching zero-sum exists', () => {
    // 매출이 없는 달: 인보이스 0 + 송금기록 없음 → 대사 통과 아님(기록이 없으니까).
    expect(reconcile({ remitMinor: 0 }, { amountMinor: 0 }, []).ok).toBe(false)
  })
})
