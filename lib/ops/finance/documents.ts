// AtoC 통합 플랜 Phase 3 — 정산 문서 빌더 (§6.4 인터컴퍼니 인보이스 / 월 정산서).
//
// 설계 결정(코디네이터 확정):
//   · PDF 라이브러리를 추가하지 않는다. 문서는 DB 데이터에서 결정론적으로 재렌더되는
//     admin 인쇄 뷰(@media print)이고, 이 모듈은 그 뷰에 넣을 값을 만드는 순수 함수다.
//     blob을 보관하지 않으므로 "과거 문서를 다시 뽑으면 그때와 같은 숫자가 나오는가"가
//     생명이다 → 입력은 전부 스냅샷된 DB 행(period.margin_rate 등)이며 여기서 어떤
//     비율도 다시 곱하지 않는다.
//   · 🔴 부가세 라인을 만들지 않는다. 플랜 §6.2/§9-1이 여행업 영세율 배제 가능성을
//     미해결 게이트로 남겨두었다. 세액 칸을 비워두는 것이 숫자를 지어내는 것보다
//     정직하므로, 대신 고정 고지 문구 1줄(VAT_NOTICE)을 문서 하단에 박는다.
//   · 전문가(미국 CPA·한국 세무사) 확인 전에는 전부 DRAFT. 해제 스위치는
//     ops_finance_config.expert_reviewed 하나뿐이고, 값이 없으면 항상 DRAFT다.
//   · 고객 인보이스는 발행하지 않는다(D11) — 발행 문서는 인터컴퍼니 1종뿐.

import type { FinanceConfig } from './config'
import type {
  IntercompanyInvoiceRow,
  RemittanceRow,
  SettlementLedgerRow,
  SettlementPeriodRow,
} from './settlement'

/** §6.2가 확정될 때까지 모든 생성 문서 하단에 들어가는 고정 문구. */
export const VAT_NOTICE =
  '부가세 처리 방침 미확정(§6.2) — 세무사 확정 후 반영'

/** 법인 법적정보가 아직 비어 있을 때의 자리표시. 빈칸을 그럴듯하게 채우지 않는다. */
export const PLACEHOLDER = '미입력'

/** 인터컴퍼니 용역 기재 (§6.4). */
export const SERVICE_DESCRIPTION = 'Tour operation services'

/** 인보이스가 참조하는 계약. */
export const AGREEMENT_REFERENCE = 'Intercompany Services Agreement'

/**
 * DRAFT 여부. expert_reviewed가 명시적으로 true일 때만 해제된다 —
 * undefined/null/설정행 부재는 전부 DRAFT(안전한 기본값).
 */
export function isDraftDocument(expertReviewed: boolean | null | undefined): boolean {
  return expertReviewed !== true
}

/** 값이 비어 있으면 '미입력'. */
export function orPlaceholder(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  return s.length > 0 ? s : PLACEHOLDER
}

/** minor units → 통화 표시. USD 등 2-decimal 가정(원장은 현재 USD 단일). */
export function formatMinor(minor: number, currency = 'USD'): string {
  const major = (Number(minor) || 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major)
  } catch {
    return `${major.toFixed(2)} ${currency}`
  }
}

/** 0.05 → '5%' (소수점 한 자리까지만, 불필요한 0 제거). */
export function formatRate(rate: number): string {
  const pct = (Number(rate) || 0) * 100
  return `${Math.round(pct * 10) / 10}%`
}

/** 'YYYY-MM' → '2026년 8월'. */
export function formatPeriodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period ?? '')
  if (!m) return period ?? ''
  return `${m[1]}년 ${Number(m[2])}월`
}

// ---------------------------------------------------------------------------
// 주문 명세 (인보이스 §6.4 필수 항목: 대상 주문번호 · 투어일자 목록)
// ---------------------------------------------------------------------------

export interface BookingMeta {
  bookingId: string
  bookingReference: string | null
  tourDate: string | null
}

export interface OrderLine {
  bookingId: string
  bookingReference: string
  tourDate: string
  grossMinor: number
  commissionMinor: number
  remitMinor: number
}

/**
 * 원장 행(us) + 예약 메타 → 주문별 명세. 순수.
 * 송금분은 행별로도 gross − commission으로 파생한다(비율 재적용 금지).
 * 투어일자 오름차순, 같은 날은 예약번호 순 — 문서가 매번 같은 순서로 나와야 한다.
 */
export function buildOrderLines(
  ledgerRows: SettlementLedgerRow[],
  bookingMeta: BookingMeta[] = [],
): OrderLine[] {
  const metaById = new Map(bookingMeta.map((b) => [b.bookingId, b]))
  const byBooking = new Map<string, { gross: number; commission: number }>()

  for (const r of ledgerRows ?? []) {
    if (r.entity !== 'us') continue
    const id = r.booking_id
    if (!id) continue
    const cur = byBooking.get(id) ?? { gross: 0, commission: 0 }
    if (r.type === 'revenue') cur.gross += r.amount_minor
    else if (r.type === 'commission') cur.commission += r.amount_minor
    byBooking.set(id, cur)
  }

  const lines: OrderLine[] = []
  for (const [bookingId, sums] of byBooking) {
    const meta = metaById.get(bookingId)
    lines.push({
      bookingId,
      bookingReference: meta?.bookingReference || bookingId.slice(0, 8),
      tourDate: meta?.tourDate || '',
      grossMinor: sums.gross,
      commissionMinor: sums.commission,
      remitMinor: sums.gross - sums.commission,
    })
  }

  lines.sort((a, b) => {
    if (a.tourDate !== b.tourDate) return a.tourDate < b.tourDate ? -1 : 1
    return a.bookingReference < b.bookingReference ? -1 : a.bookingReference > b.bookingReference ? 1 : 0
  })
  return lines
}

// ---------------------------------------------------------------------------
// 월 정산서 (내부 문서)
// ---------------------------------------------------------------------------

export interface StatementDocInput {
  period: SettlementPeriodRow
  config: FinanceConfig & { expertReviewed?: boolean | null }
  ledgerRows: SettlementLedgerRow[]
  bookingMeta?: BookingMeta[]
  invoice?: IntercompanyInvoiceRow | null
  remittances?: RemittanceRow[]
}

export interface StatementDoc {
  draft: boolean
  vatNotice: string
  periodLabel: string
  period: string
  currency: string
  marginRateLabel: string
  totals: {
    grossMinor: number
    commissionMinor: number
    remitMinor: number
    orderCount: number
    stripeFeeMinor: number | null
  }
  lines: OrderLine[]
  usEntity: { name: string; address: string; ein: string }
  krEntity: { name: string; address: string; bizRegNo: string }
  invoiceNo: string | null
  remittedMinor: number
  closedAt: string | null
}

export function buildStatementDoc(input: StatementDocInput): StatementDoc {
  const { period, config } = input
  const remittances = input.remittances ?? []
  return {
    draft: isDraftDocument(config.expertReviewed),
    vatNotice: VAT_NOTICE,
    period: period.period,
    periodLabel: formatPeriodLabel(period.period),
    currency: period.currency || 'USD',
    // 스냅샷된 rate를 표시만 한다 — 문서가 나중에 재계산되면 안 되므로(결정 2).
    marginRateLabel: formatRate(period.margin_rate),
    totals: {
      grossMinor: period.gross_minor,
      commissionMinor: period.commission_minor,
      remitMinor: period.remit_minor,
      orderCount: period.order_count,
      stripeFeeMinor: period.stripe_fee_minor,
    },
    lines: buildOrderLines(input.ledgerRows, input.bookingMeta),
    usEntity: {
      name: orPlaceholder(config.llcLegalName),
      address: orPlaceholder(config.llcAddress),
      ein: orPlaceholder(config.llcEin),
    },
    krEntity: {
      name: orPlaceholder(config.krLegalName),
      address: orPlaceholder(config.krAddress),
      bizRegNo: orPlaceholder(config.krBizRegNo),
    },
    invoiceNo: input.invoice?.invoice_no ?? null,
    remittedMinor: remittances.reduce((s, r) => s + (Number(r.amount_usd_minor) || 0), 0),
    closedAt: period.closed_at,
  }
}

// ---------------------------------------------------------------------------
// 인터컴퍼니 인보이스 (§6.4 필수 항목 전부)
// ---------------------------------------------------------------------------

export interface InvoiceDocInput extends StatementDocInput {
  invoice: IntercompanyInvoiceRow
  /** 지급조건·수취계좌 문구(설정에 없으면 자리표시). */
  paymentTerms?: string | null
  bankAccount?: string | null
}

export interface InvoiceDoc {
  draft: boolean
  vatNotice: string
  invoiceNo: string
  issueDate: string
  period: string
  periodLabel: string
  currency: string
  amountMinor: number
  amountLabel: string
  fxRate: number | null
  fxRateDate: string | null
  /** 용역 제공자 = 한국 종합여행업 법인. */
  from: { name: string; address: string; bizRegNo: string }
  /** 용역 수취자 = 미국 LLC. */
  to: { name: string; address: string; ein: string }
  serviceDescription: string
  agreementReference: string
  marginRateLabel: string
  lines: OrderLine[]
  paymentTerms: string
  bankAccount: string
}

/**
 * 인보이스 문서 값. 금액은 인보이스 행(amount_minor)을 그대로 쓴다 —
 * 발행 이후 원장이 늘어나도 발행된 인보이스의 숫자는 변하지 않아야 한다.
 */
export function buildInvoiceDoc(input: InvoiceDocInput): InvoiceDoc {
  const { invoice, period, config } = input
  const currency = invoice.currency || 'USD'
  return {
    draft: isDraftDocument(config.expertReviewed),
    vatNotice: VAT_NOTICE,
    invoiceNo: invoice.invoice_no,
    issueDate: invoice.issue_date,
    period: period.period,
    periodLabel: formatPeriodLabel(period.period),
    currency,
    amountMinor: invoice.amount_minor,
    amountLabel: formatMinor(invoice.amount_minor, currency),
    fxRate: invoice.fx_rate,
    fxRateDate: invoice.fx_rate_date,
    from: {
      name: orPlaceholder(config.krLegalName),
      address: orPlaceholder(config.krAddress),
      bizRegNo: orPlaceholder(config.krBizRegNo),
    },
    to: {
      name: orPlaceholder(config.llcLegalName),
      address: orPlaceholder(config.llcAddress),
      ein: orPlaceholder(config.llcEin),
    },
    serviceDescription: SERVICE_DESCRIPTION,
    agreementReference: AGREEMENT_REFERENCE,
    marginRateLabel: formatRate(period.margin_rate),
    lines: buildOrderLines(input.ledgerRows, input.bookingMeta),
    paymentTerms: orPlaceholder(input.paymentTerms),
    bankAccount: orPlaceholder(input.bankAccount),
  }
}
