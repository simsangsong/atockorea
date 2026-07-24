/**
 * §6.3 (감사 G2) — PDF와 인쇄 뷰가 갈라질 수 없음을 못 박는 테스트.
 *
 * 핵심 주장 하나: **같은 입력 → 같은 숫자.** 화면과 PDF가 각자 조판하면 언젠가
 * 한쪽만 고쳐지고, 숫자가 다른 정산 PDF는 PDF가 없는 것보다 나쁘다. 그래서 둘 다
 * documentLayout.ts의 모델만 그리고, 여기서 실제 DOM과 실제 PDF 엘리먼트 트리를
 * 각각 훑어 모델과 대조한다.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

/**
 * @react-pdf/renderer ships ESM only and jest does not transform node_modules,
 * so the primitives are stubbed as plain host elements. That is enough for what
 * this suite asserts — **which strings the PDF prints** — and it keeps the heavy
 * server-only dependency out of the unit run. The real renderer is exercised by
 * `next build --webpack` (it must stay off the client bundle) and by rendering a
 * fixture through renderToBuffer manually before shipping.
 */
jest.mock('@react-pdf/renderer', () => {
  const react = jest.requireActual('react') as typeof React
  const primitive =
    (tag: string) =>
    (props: { children?: React.ReactNode }) =>
      react.createElement(tag, null, props.children ?? null)
  return {
    Document: primitive('pdf-document'),
    Page: primitive('pdf-page'),
    View: primitive('pdf-view'),
    Text: primitive('pdf-text'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Font: { register: () => {}, registerHyphenationCallback: () => {} },
    renderToBuffer: async () => Buffer.from('%PDF-'),
  }
})

import { ledgerPair } from '@/test-utils/fakeFinanceDb'
import { IntercompanyInvoiceDoc } from '@/components/admin/ops-finance/IntercompanyInvoiceDoc'
import { SettlementStatementDoc } from '@/components/admin/ops-finance/SettlementStatementDoc'
import type { FinanceConfig } from '../config'
import { buildInvoiceDoc, buildStatementDoc, formatMinor } from '../documents'
import {
  invoiceDocumentModel,
  statementDocumentModel,
  stripeFeeRow,
} from '../documentLayout'
import { InvoicePdf, StatementPdf } from '../pdf/documents.server'
import { financeDocPath, FINANCE_DOCS_BUCKET, pathStamp } from '../pdf/paths'
import type {
  IntercompanyInvoiceRow,
  SettlementLedgerRow,
  SettlementPeriodRow,
} from '../settlement'

const config: FinanceConfig = {
  marginRate: 0.05,
  llcLegalName: 'AtoC Korea LLC',
  llcAddress: '30 N Gould St, Sheridan, WY',
  llcEin: '99-1234567',
  krLegalName: '에이투씨코리아',
  krAddress: '서울시 중구',
  krBizRegNo: '277-01-03977',
  intercompanyPrefix: 'AK-IC',
  intercompanySeq: 1,
  expertReviewed: false,
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
  stripe_fee_minor: 1190,
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
  fx_rate: 1385.5,
  fx_rate_date: '2026-09-01',
  status: 'issued',
  pdf_url: null,
  notes: 'T/T 30 days',
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

const input = { period, config, ledgerRows, bookingMeta, invoice, remittances: [] }

/**
 * Every string a react-pdf element tree would print. Function components are
 * invoked (they hold no state or hooks), so this is the PDF's real content —
 * not a re-derivation of it.
 */
function collectPdfText(node: React.ReactNode): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(collectPdfText)
  if (!React.isValidElement(node)) return []
  const element = node as React.ReactElement<{ children?: React.ReactNode }>
  if (typeof element.type === 'function') {
    const Component = element.type as (props: unknown) => React.ReactNode
    return collectPdfText(Component(element.props))
  }
  return collectPdfText(element.props.children)
}

function cellTexts(testId: string): string[][] {
  const table = screen.getByTestId(testId)
  return [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? ''),
  )
}

describe('settlement statement — print view and PDF cannot disagree', () => {
  const doc = buildStatementDoc(input)
  const model = statementDocumentModel(doc)

  it('renders exactly the model rows in the print view', () => {
    render(<SettlementStatementDoc doc={doc} />)
    expect(cellTexts('statement-lines')).toEqual(model.table.rows.map((row) => row.cells))

    const summary = screen.getByTestId('statement-summary')
    const rendered = [...summary.querySelectorAll('tr')].map((row) => [
      row.querySelector('th')?.textContent ?? '',
      row.querySelector('td')?.textContent ?? '',
    ])
    expect(rendered).toEqual(model.summary.map((row) => [row.label, row.value]))
  })

  it('prints exactly the same strings in the PDF', () => {
    const pdfText = collectPdfText(<StatementPdf model={model} />)
    for (const row of model.table.rows) {
      for (const cell of row.cells) expect(pdfText).toContain(cell)
    }
    for (const row of model.summary) {
      expect(pdfText).toContain(row.label)
      expect(pdfText).toContain(row.value)
    }
    expect(pdfText).toContain(model.metaLine)
  })

  it('carries the same totals as the settlement rows (integer minor units)', () => {
    // remit is derived (gross − commission), never re-multiplied by the rate.
    expect(doc.totals.grossMinor).toBe(34400)
    expect(doc.totals.commissionMinor).toBe(1720)
    expect(doc.totals.remitMinor).toBe(32680)
    expect(doc.totals.commissionMinor + doc.totals.remitMinor).toBe(doc.totals.grossMinor)
    const lineSum = doc.lines.reduce((sum, line) => sum + line.remitMinor, 0)
    expect(Number.isInteger(lineSum)).toBe(true)
    expect(lineSum).toBe(doc.totals.remitMinor)
    // The model formats, it does not compute.
    expect(model.summary.find((row) => row.key === 'remit')?.value).toBe(formatMinor(32680, 'USD'))
  })

  it('says how many orders the Stripe fee covers, and admits when it is unknown', () => {
    expect(stripeFeeRow(doc).label).toContain('/2건 확인')
    const unknown = buildStatementDoc({ ...input, period: { ...period, stripe_fee_minor: null } })
    expect(stripeFeeRow(unknown).value).toBe('미집계')
  })
})

describe('intercompany invoice — print view and PDF cannot disagree', () => {
  const doc = buildInvoiceDoc({ ...input, invoice })
  const model = invoiceDocumentModel(doc)

  it('renders exactly the model rows in the print view', () => {
    render(<IntercompanyInvoiceDoc doc={doc} />)
    expect(cellTexts('invoice-lines')).toEqual(model.table.rows.map((row) => row.cells))
    expect(screen.getByTestId('invoice-amount').textContent).toBe(model.service.amountLabel)
    expect(screen.getByTestId('invoice-no').textContent).toBe(model.invoiceNo)
  })

  it('prints the §6.4 mandatory fields in the PDF', () => {
    const pdfText = collectPdfText(<InvoicePdf model={model} />)
    expect(pdfText).toContain('AK-IC-2026-001')
    expect(pdfText).toContain(model.service.amountLabel)
    expect(pdfText).toContain(model.service.currencyLine)
    expect(pdfText).toContain(model.service.agreementLine)
    expect(pdfText).toContain('사업자등록번호: 277-01-03977')
    expect(pdfText).toContain('EIN: 99-1234567')
    for (const row of model.table.rows) {
      for (const cell of row.cells) expect(pdfText).toContain(cell)
    }
    // §6.2 미해결 — 세액 칸을 만들지 않고 고지 문구로 공백을 명시한다.
    expect(pdfText.join(' ')).toContain(doc.vatNotice)
    expect(pdfText.join(' ')).not.toMatch(/부가세액|VAT amount/)
  })

  it('bills exactly the period remittance figure', () => {
    expect(doc.amountMinor).toBe(period.remit_minor)
    expect(model.service.amountLabel).toBe(formatMinor(period.remit_minor, 'USD'))
  })
})

describe('DRAFT watermark gate (D10 / 결정 4)', () => {
  it('watermarks both outputs while expert_reviewed is not true', () => {
    const doc = buildStatementDoc(input)
    expect(doc.draft).toBe(true)
    render(<SettlementStatementDoc doc={doc} />)
    expect(screen.getByTestId('draft-watermark')).toBeInTheDocument()
    expect(collectPdfText(<StatementPdf model={statementDocumentModel(doc)} />)).toContain('DRAFT')
  })

  it('clears both only on an explicit expert_reviewed = true', () => {
    const reviewed = buildStatementDoc({ ...input, config: { ...config, expertReviewed: true } })
    expect(reviewed.draft).toBe(false)
    render(<SettlementStatementDoc doc={reviewed} />)
    expect(screen.queryByTestId('draft-watermark')).toBeNull()
    expect(collectPdfText(<StatementPdf model={statementDocumentModel(reviewed) } />)).not.toContain('DRAFT')
  })

  it('the invoice PDF follows the same single switch', () => {
    const drafted = buildInvoiceDoc({ ...input, invoice })
    const reviewed = buildInvoiceDoc({ ...input, invoice, config: { ...config, expertReviewed: true } })
    expect(collectPdfText(<InvoicePdf model={invoiceDocumentModel(drafted)} />)).toContain('DRAFT')
    expect(collectPdfText(<InvoicePdf model={invoiceDocumentModel(reviewed)} />)).not.toContain('DRAFT')
  })
})

describe('storage paths (private bucket policy)', () => {
  it('never targets a public bucket and keeps every regeneration', () => {
    expect(FINANCE_DOCS_BUCKET).toBe('ops-finance-docs')
    const first = financeDocPath({
      kind: 'statement',
      period: '2026-08',
      stamp: pathStamp('2026-09-01T09:15:00.000Z'),
    })
    const second = financeDocPath({
      kind: 'statement',
      period: '2026-08',
      stamp: pathStamp('2026-09-02T09:15:00.000Z'),
    })
    expect(first).toBe('finance/2026-08/statement-2026-08-20260901T091500Z.pdf')
    expect(second).not.toBe(first)
  })

  it('files an invoice under its own number', () => {
    expect(
      financeDocPath({
        kind: 'invoice',
        period: '2026-08',
        invoiceNo: 'AK-IC-2026-001',
        stamp: '20260901T091500Z',
      }),
    ).toBe('finance/2026-08/invoice-AK-IC-2026-001-20260901T091500Z.pdf')
  })
})
