import { ledgerPair } from '@/test-utils/fakeFinanceDb'
import type { FinanceConfig } from '../config'
import {
  PLACEHOLDER,
  VAT_NOTICE,
  buildInvoiceDoc,
  buildOrderLines,
  buildStatementDoc,
  formatPeriodLabel,
  formatRate,
  isDraftDocument,
} from '../documents'
import type {
  IntercompanyInvoiceRow,
  SettlementLedgerRow,
  SettlementPeriodRow,
} from '../settlement'

const emptyConfig: FinanceConfig = {
  marginRate: 0.05,
  llcLegalName: null,
  llcAddress: null,
  llcEin: null,
  krLegalName: null,
  krAddress: null,
  krBizRegNo: null,
  intercompanyPrefix: 'AK-IC',
  intercompanySeq: 0,
  expertReviewed: false,
}

const filledConfig: FinanceConfig = {
  ...emptyConfig,
  llcLegalName: 'AtoC Korea LLC',
  llcAddress: '30 N Gould St, Sheridan, WY',
  llcEin: '99-1234567',
  krLegalName: '에이투씨코리아',
  krAddress: '서울시 …',
  krBizRegNo: '277-01-03977',
  expertReviewed: true,
}

const period: SettlementPeriodRow = {
  id: 'per-1',
  tenant_id: 'atockorea',
  period: '2026-08',
  status: 'invoiced',
  gross_minor: 34400,
  commission_minor: 1720,
  remit_minor: 32680,
  margin_rate: 0.05,
  order_count: 2,
  stripe_fee_minor: null,
  currency: 'USD',
  note: null,
  closed_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
}

const invoice: IntercompanyInvoiceRow = {
  id: 'inv-1',
  tenant_id: 'atockorea',
  period_id: 'per-1',
  invoice_no: 'AK-IC-2026-001',
  issue_date: '2026-09-01',
  amount_minor: 32680,
  currency: 'USD',
  fx_rate: null,
  fx_rate_date: null,
  status: 'draft',
  pdf_url: null,
  notes: null,
  created_at: '2026-09-01T00:00:00.000Z',
}

const ledgerRows = [
  ...ledgerPair('bk-1', '2026-08', 14400),
  ...ledgerPair('bk-2', '2026-08', 20000),
] as SettlementLedgerRow[]

const bookingMeta = [
  { bookingId: 'bk-1', bookingReference: 'A2C-11112222', tourDate: '2026-08-17' },
  { bookingId: 'bk-2', bookingReference: 'A2C-33334444', tourDate: '2026-08-03' },
]

describe('isDraftDocument', () => {
  it('only clears DRAFT on an explicit true', () => {
    expect(isDraftDocument(false)).toBe(true)
    expect(isDraftDocument(null)).toBe(true)
    expect(isDraftDocument(undefined)).toBe(true)
    expect(isDraftDocument(true)).toBe(false)
  })
})

describe('buildOrderLines', () => {
  it('groups the ledger by booking and derives each remit as gross − commission', () => {
    const lines = buildOrderLines(ledgerRows, bookingMeta)
    expect(lines).toHaveLength(2)
    const byRef = Object.fromEntries(lines.map((l) => [l.bookingReference, l]))
    expect(byRef['A2C-11112222']).toMatchObject({
      grossMinor: 14400,
      commissionMinor: 720,
      remitMinor: 13680,
      tourDate: '2026-08-17',
    })
    expect(byRef['A2C-33334444'].remitMinor).toBe(19000)
  })

  it('is deterministic: tour date ascending so a reprint matches the original', () => {
    const first = buildOrderLines(ledgerRows, bookingMeta).map((l) => l.bookingReference)
    const shuffled = buildOrderLines([...ledgerRows].reverse(), [...bookingMeta].reverse()).map(
      (l) => l.bookingReference,
    )
    expect(first).toEqual(['A2C-33334444', 'A2C-11112222'])
    expect(shuffled).toEqual(first)
  })

  it('falls back to a booking-id stub when the reference is unknown', () => {
    const lines = buildOrderLines(ledgerRows, [])
    expect(lines[0].bookingReference).toBe('bk-1')
    expect(lines[0].tourDate).toBe('')
  })

  it('ignores kr rows and rows without a booking', () => {
    const rows: SettlementLedgerRow[] = [
      ...ledgerRows,
      { entity: 'kr', booking_id: 'bk-1', type: 'remit', amount_minor: 13680, currency: 'USD' },
      { entity: 'us', booking_id: null, type: 'expense', amount_minor: 500, currency: 'USD' },
    ]
    expect(buildOrderLines(rows, bookingMeta)).toHaveLength(2)
  })
})

describe('buildStatementDoc', () => {
  it('carries the §6.2 VAT notice and no tax figure of its own', () => {
    const doc = buildStatementDoc({ period, config: emptyConfig, ledgerRows, bookingMeta })
    expect(doc.vatNotice).toBe(VAT_NOTICE)
    expect(doc.vatNotice).toContain('미확정')
    // 문서 어디에도 세액 필드가 존재하지 않는다 — 공백이 창작보다 정직하다.
    expect(Object.keys(doc)).not.toContain('vatMinor')
    expect(Object.keys(doc.totals)).not.toContain('vatMinor')
  })

  it('shows the snapshotted rate rather than recomputing from config', () => {
    // 설정은 5%지만 이 기간은 7%로 마감됐다고 하자 → 문서는 7%를 보여줘야 한다.
    const doc = buildStatementDoc({
      period: { ...period, margin_rate: 0.07 },
      config: emptyConfig,
      ledgerRows,
      bookingMeta,
    })
    expect(doc.marginRateLabel).toBe('7%')
  })

  it('uses the period snapshot for totals, not a re-aggregation of the ledger', () => {
    const doc = buildStatementDoc({
      period: { ...period, gross_minor: 111, commission_minor: 11, remit_minor: 100 },
      config: emptyConfig,
      ledgerRows,
      bookingMeta,
    })
    expect(doc.totals.grossMinor).toBe(111)
    expect(doc.totals.remitMinor).toBe(100)
  })

  it('marks DRAFT and placeholders when config is empty; clears both when filled', () => {
    const draft = buildStatementDoc({ period, config: emptyConfig, ledgerRows, bookingMeta })
    expect(draft.draft).toBe(true)
    expect(draft.usEntity.ein).toBe(PLACEHOLDER)
    expect(draft.krEntity.bizRegNo).toBe(PLACEHOLDER)

    const final = buildStatementDoc({ period, config: filledConfig, ledgerRows, bookingMeta })
    expect(final.draft).toBe(false)
    expect(final.krEntity.bizRegNo).toBe('277-01-03977')
  })

  it('sums the wires that have been recorded so far', () => {
    const doc = buildStatementDoc({
      period,
      config: emptyConfig,
      ledgerRows,
      bookingMeta,
      remittances: [
        { amount_usd_minor: 20000 },
        { amount_usd_minor: 12680 },
      ] as never,
    })
    expect(doc.remittedMinor).toBe(32680)
  })
})

describe('buildInvoiceDoc', () => {
  it('carries every §6.4 required field', () => {
    const doc = buildInvoiceDoc({ period, config: filledConfig, ledgerRows, bookingMeta, invoice })
    expect(doc.invoiceNo).toBe('AK-IC-2026-001')
    expect(doc.issueDate).toBe('2026-09-01')
    expect(doc.from.name).toBe('에이투씨코리아')
    expect(doc.from.bizRegNo).toBe('277-01-03977')
    expect(doc.to.name).toBe('AtoC Korea LLC')
    expect(doc.to.ein).toBe('99-1234567')
    expect(doc.serviceDescription).toBe('Tour operation services')
    expect(doc.agreementReference).toBe('Intercompany Services Agreement')
    expect(doc.amountLabel).toBe('$326.80')
    expect(doc.lines.map((l) => l.bookingReference)).toEqual(['A2C-33334444', 'A2C-11112222'])
    expect(doc.lines.every((l) => l.tourDate)).toBe(true)
    expect(doc.vatNotice).toBe(VAT_NOTICE)
  })

  it('freezes the amount to the issued invoice even if the ledger grows later', () => {
    const doc = buildInvoiceDoc({
      period: { ...period, remit_minor: 999999 },
      config: filledConfig,
      ledgerRows,
      bookingMeta,
      invoice,
    })
    expect(doc.amountMinor).toBe(32680)
  })

  it('says the fx rate is missing rather than inventing one', () => {
    const doc = buildInvoiceDoc({ period, config: filledConfig, ledgerRows, bookingMeta, invoice })
    expect(doc.fxRate).toBeNull()
    expect(doc.fxRateDate).toBeNull()
  })

  it('placeholders payment terms and bank account until they are supplied', () => {
    const doc = buildInvoiceDoc({ period, config: filledConfig, ledgerRows, bookingMeta, invoice })
    expect(doc.paymentTerms).toBe(PLACEHOLDER)
    expect(doc.bankAccount).toBe(PLACEHOLDER)

    const withTerms = buildInvoiceDoc({
      period,
      config: filledConfig,
      ledgerRows,
      bookingMeta,
      invoice,
      paymentTerms: 'Net 30',
      bankAccount: 'KEB Hana 123-456',
    })
    expect(withTerms.paymentTerms).toBe('Net 30')
    expect(withTerms.bankAccount).toBe('KEB Hana 123-456')
  })

  it('stays DRAFT while expert review is pending', () => {
    const doc = buildInvoiceDoc({ period, config: emptyConfig, ledgerRows, bookingMeta, invoice })
    expect(doc.draft).toBe(true)
  })
})

describe('formatters', () => {
  it('renders rates and period labels for humans', () => {
    expect(formatRate(0.05)).toBe('5%')
    expect(formatRate(0.075)).toBe('7.5%')
    expect(formatPeriodLabel('2026-08')).toBe('2026년 8월')
    expect(formatPeriodLabel('nonsense')).toBe('nonsense')
  })
})
