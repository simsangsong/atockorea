// AtoC 통합 플랜 §6.4 — 정산 문서의 **표시 모델** (인쇄 뷰 · PDF 공용).
//
// 왜 이 파일이 생겼나: documents.ts가 숫자를 만들고(StatementDoc/InvoiceDoc),
// 인쇄 뷰가 그걸 JSX 안에서 직접 라벨·포맷·행으로 조립하고 있었다. 여기에 PDF
// 렌더러를 추가하면 같은 문서의 조판이 두 벌이 되고, 한쪽만 고쳐지는 날
// **정산서 PDF와 인쇄 뷰의 숫자가 달라진다**. 숫자가 다른 PDF는 PDF가 없는
// 것보다 나쁘다.
//
// 그래서 "무엇이 어떤 라벨로 어떤 문자열로 찍히는가"를 전부 여기 순수 함수로
// 끌어올리고, 인쇄 뷰와 PDF는 **이 모델을 그리기만** 한다. 두 출력이 갈라지려면
// 이 파일을 고쳐야 하고, 고치면 둘 다 같이 바뀐다.
//
// 규칙:
//   · 금액은 정수 minor units로 들어와 formatMinor()로만 문자열이 된다.
//     여기서 어떤 산술도 하지 않는다(비율 재적용·반올림 금지).
//   · 클라이언트 안전 — supabase·node:*·@react-pdf 어느 것도 import하지 않는다.
//     (PDF 렌더러는 서버 전용이라 lib/ops/finance/pdf/*.server.tsx에 있다.)

import { formatMinor, type InvoiceDoc, type OrderLine, type StatementDoc } from './documents'

export interface DocEntityBlock {
  role: string
  name: string
  address: string
  idLabel: string
  idValue: string
}

export interface DocSummaryRow {
  key: string
  label: string
  value: string
  emphasis?: 'strong' | 'muted'
}

export interface DocTableRow {
  key: string
  cells: string[]
}

export interface DocTable {
  columns: string[]
  /** Column alignment, same length as `columns`. */
  align: Array<'left' | 'right'>
  rows: DocTableRow[]
  emptyText: string
}

export interface DocMetaLine {
  label: string
  value: string
}

export const ORDER_TABLE_COLUMNS = ['예약번호', '투어일자', '총액', '커미션'] as const
export const ORDER_TABLE_ALIGN: Array<'left' | 'right'> = ['left', 'left', 'right', 'right', 'right']

/** 문서 상단 워터마크/머리글에 함께 붙는 초안 표기. */
export function draftSuffix(draft: boolean): string {
  return draft ? ' (DRAFT)' : ''
}

/** 주문 명세 표. 마지막 열 라벨만 문서별로 다르다(정산서=송금분, 인보이스=청구액). */
export function orderLinesTable(
  lines: OrderLine[],
  currency: string,
  lastColumnLabel: string,
  emptyText: string,
): DocTable {
  return {
    columns: [...ORDER_TABLE_COLUMNS, lastColumnLabel],
    align: ORDER_TABLE_ALIGN,
    rows: lines.map((line) => ({
      key: line.bookingId,
      cells: [
        line.bookingReference,
        line.tourDate || '-',
        formatMinor(line.grossMinor, currency),
        formatMinor(line.commissionMinor, currency),
        formatMinor(line.remitMinor, currency),
      ],
    })),
    emptyText,
  }
}

// ---------------------------------------------------------------------------
// 월 정산서
// ---------------------------------------------------------------------------

export interface StatementDocumentModel {
  draft: boolean
  screenTitle: string
  screenSubtitle: string
  kicker: string
  title: string
  metaLine: string
  entities: DocEntityBlock[]
  summaryHeading: string
  summary: DocSummaryRow[]
  tableHeading: string
  table: DocTable
  notes: string[]
}

export const STATEMENT_INTERNAL_NOTE =
  '내부 정산 문서입니다. 고객 인보이스는 발행하지 않으며 고객 영수증은 Stripe가 발행합니다.'

/**
 * §6.3 — 실수수료가 일부 주문에서만 확인됐으면 합계를 완전한 값처럼 보이게 두지
 * 않고 몇 건이 확인됐는지 라벨에 적는다. null은 0원이 아니라 "모른다"다.
 */
export function stripeFeeRow(doc: StatementDoc): DocSummaryRow {
  const { stripeFeeMinor, stripeFeeKnownOrders, orderCount } = doc.totals
  if (stripeFeeMinor === null) {
    return { key: 'stripe_fee', label: 'Stripe 수수료 (참고)', value: '미집계', emphasis: 'muted' }
  }
  const partial = stripeFeeKnownOrders < orderCount
  return {
    key: 'stripe_fee',
    label: partial
      ? `Stripe 수수료 (참고 · ${stripeFeeKnownOrders}/${orderCount}건 확인)`
      : 'Stripe 수수료 (참고)',
    value: formatMinor(stripeFeeMinor, doc.currency),
    emphasis: 'muted',
  }
}

export function statementSummaryRows(doc: StatementDoc): DocSummaryRow[] {
  const c = doc.currency
  return [
    {
      key: 'gross',
      label: `총매출 (gross · ${doc.totals.orderCount}건)`,
      value: formatMinor(doc.totals.grossMinor, c),
    },
    {
      key: 'commission',
      label: `LLC 커미션 (${doc.marginRateLabel})`,
      value: `− ${formatMinor(doc.totals.commissionMinor, c)}`,
    },
    {
      key: 'remit',
      label: '한국법인 송금분',
      value: formatMinor(doc.totals.remitMinor, c),
      emphasis: 'strong',
    },
    stripeFeeRow(doc),
    { key: 'remitted', label: '실제 송금 합계', value: formatMinor(doc.remittedMinor, c) },
  ]
}

/** 마감 시각 표기. 서버·클라이언트가 같은 문자열을 내도록 KST 고정. */
export function formatClosedAt(closedAt: string | null): string {
  if (!closedAt) return '-'
  const parsed = new Date(closedAt)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function statementDocumentModel(doc: StatementDoc): StatementDocumentModel {
  return {
    draft: doc.draft,
    screenTitle: '월 정산서',
    screenSubtitle: `${doc.periodLabel} · 주문 ${doc.totals.orderCount}건`,
    kicker: `Monthly Settlement Statement${draftSuffix(doc.draft)}`,
    title: `${doc.periodLabel} 정산서`,
    metaLine:
      `정산기간 ${doc.period} · 마감 ${formatClosedAt(doc.closedAt)}` +
      (doc.invoiceNo ? ` · 인보이스 ${doc.invoiceNo}` : ''),
    entities: [
      {
        role: '결제 수취 (미국 LLC)',
        name: doc.usEntity.name,
        address: doc.usEntity.address,
        idLabel: 'EIN',
        idValue: doc.usEntity.ein,
      },
      {
        role: '투어 운영 (한국 종합여행업)',
        name: doc.krEntity.name,
        address: doc.krEntity.address,
        idLabel: '사업자등록번호',
        idValue: doc.krEntity.bizRegNo,
      },
    ],
    summaryHeading: '요약',
    summary: statementSummaryRows(doc),
    tableHeading: '주문별 명세',
    table: orderLinesTable(doc.lines, doc.currency, '송금분', '이 기간에 확정된 주문이 없습니다.'),
    notes: [doc.vatNotice, STATEMENT_INTERNAL_NOTE],
  }
}

// ---------------------------------------------------------------------------
// 인터컴퍼니 인보이스
// ---------------------------------------------------------------------------

export interface InvoiceDocumentModel {
  draft: boolean
  screenTitle: string
  screenSubtitle: string
  kicker: string
  invoiceNo: string
  headerMeta: DocMetaLine[]
  entities: DocEntityBlock[]
  service: {
    title: string
    subtitle: string
    amountLabel: string
    currencyLine: string
    agreementLine: string
  }
  tableHeading: string
  table: DocTable
  footer: DocMetaLine[]
  notes: string[]
}

export function invoiceCurrencyLine(doc: InvoiceDoc): string {
  const base = `통화 ${doc.currency}`
  if (doc.fxRate === null) return `${base} · 적용환율 미기재 (원화 환산은 별도)`
  return `${base} · 적용환율 ${doc.fxRate} (기준일 ${doc.fxRateDate || '미기재'})`
}

export function invoiceDocumentModel(doc: InvoiceDoc): InvoiceDocumentModel {
  const footer: DocMetaLine[] = [
    { label: '지급조건', value: doc.paymentTerms },
    { label: '수취계좌', value: doc.bankAccount },
  ]
  if (doc.notes) footer.push({ label: '비고', value: doc.notes })

  return {
    draft: doc.draft,
    screenTitle: '인터컴퍼니 인보이스',
    screenSubtitle: `${doc.invoiceNo} · ${doc.periodLabel}`,
    kicker: `Intercompany Invoice${draftSuffix(doc.draft)}`,
    invoiceNo: doc.invoiceNo,
    headerMeta: [
      { label: '발행일', value: doc.issueDate || '-' },
      { label: '대상 기간', value: doc.periodLabel },
    ],
    entities: [
      {
        role: 'From — 용역 제공 (한국 종합여행업)',
        name: doc.from.name,
        address: doc.from.address,
        idLabel: '사업자등록번호',
        idValue: doc.from.bizRegNo,
      },
      {
        role: 'To — 용역 수취 (미국 LLC)',
        name: doc.to.name,
        address: doc.to.address,
        idLabel: 'EIN',
        idValue: doc.to.ein,
      },
    ],
    service: {
      title: doc.serviceDescription,
      subtitle: `${doc.periodLabel} 투어 운영 용역 · 총매출에서 LLC 커미션 ${doc.marginRateLabel}을 차감한 금액`,
      amountLabel: doc.amountLabel,
      currencyLine: invoiceCurrencyLine(doc),
      agreementLine: `계약 참조: ${doc.agreementReference}`,
    },
    tableHeading: '대상 주문 목록',
    table: orderLinesTable(doc.lines, doc.currency, '청구액', '대상 주문이 없습니다.'),
    footer,
    notes: [doc.vatNotice],
  }
}
