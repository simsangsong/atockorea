// AtoC 통합 플랜 Phase 3 — 월 정산 사이클 (§6.1 F-2~F-4, §6.4).
//
// F-1(배포됨)이 캡처마다 ops_entity_ledger에 (us,revenue,+gross) + (us,commission,+5%)를
// 기입한다. 이 모듈은 그 원장 위의 월 사이클을 담당한다:
//
//   closePeriod()  → 원장 집계 + margin_rate 스냅샷 → ops_settlement_periods (기간당 1행)
//   issueInvoice() → 인터컴퍼니 인보이스 1장 (한국법인 → 미국 LLC), 금액 = 송금분
//   reconcile()    → 정산서 송금분 / 인보이스 금액 / 실제 송금합 3자 대사 (허용오차 0)
//
// 계약:
//   · 금액은 전부 정수 minor units. 부동소수 금액 연산 없음 — 3자 대사가 '거의 같음'이
//     아니라 '정확히 같음'으로 판정돼야 하기 때문.
//   · 송금분은 재계산하지 않고 파생한다: remit = Σrevenue − Σcommission.
//     (커미션율이 나중에 바뀌어도 과거 정산서가 흔들리지 않는다. 결정 2.)
//   · margin_rate는 마감 시점 스냅샷으로 period 행에 저장한다. 하드코딩 없음 —
//     값의 출처는 언제나 getFinanceMarginRate().
//   · 🔴 대외 액션 없음(D10). 여기서 신고·제출·발송하는 것은 하나도 없다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { FINANCE_TENANT_ID } from './config'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 'YYYY-MM' 형식만 통과. */
export function isValidPeriod(period: string | null | undefined): boolean {
  return typeof period === 'string' && /^\d{4}-\d{2}$/.test(period)
}

export interface PeriodBounds {
  /** 해당 KST 월 1일 00:00:00 KST의 UTC ISO (inclusive). */
  startIso: string
  /** 다음 KST 월 1일 00:00:00 KST의 UTC ISO (exclusive). */
  endIso: string
}

/**
 * 'YYYY-MM' → KST 월 경계(UTC ISO). created_at 범위 조회용 보조.
 * 원장 행은 period 컬럼에 KST 월이 각인돼 있으므로 집계의 1차 기준은 period이고,
 * 이 경계는 period가 비어 있는 수기 행을 보조 조회할 때만 쓴다.
 */
export function periodBounds(period: string): PeriodBounds {
  if (!isValidPeriod(period)) throw new Error(`Invalid period: ${period}`)
  const [y, m] = period.split('-').map(Number)
  const startUtcMidnight = Date.UTC(y, m - 1, 1)
  const endUtcMidnight = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)
  return {
    startIso: new Date(startUtcMidnight - KST_OFFSET_MS).toISOString(),
    endIso: new Date(endUtcMidnight - KST_OFFSET_MS).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 집계 (순수)
// ---------------------------------------------------------------------------

export interface SettlementLedgerRow {
  entity: string
  booking_id: string | null
  period?: string | null
  type: string
  amount_minor: number
  currency?: string | null
}

export interface PeriodAggregate {
  grossMinor: number
  commissionMinor: number
  remitMinor: number
  orderCount: number
  currency: string
  /**
   * §6.3 — Σ Stripe 실수수료를 **양수 크기**로. 원장의 fee 행은 유출이라
   * 음수이므로 부호를 뒤집어 담는다. null = 이 달에 쓸 수 있는 fee 행이
   * 하나도 없다 = "모른다" (0원과 구분된다 — 추정치를 지어내지 않는다).
   */
  stripeFeeMinor: number | null
  /**
   * fee 행이 붙은 예약 수. 커버리지 분모는 orderCount다. known < orderCount면
   * 그 달의 수수료 합계는 일부만 확인된 값이고, 정산서가 그 사실을 표시한다.
   */
  feeKnownOrders: number
}

export function emptyAggregate(): PeriodAggregate {
  return {
    grossMinor: 0,
    commissionMinor: 0,
    remitMinor: 0,
    orderCount: 0,
    currency: 'USD',
    stripeFeeMinor: null,
    feeKnownOrders: 0,
  }
}

/**
 * 원장 행 → 기간 합계. 순수 함수. 전 구간 정수 minor units.
 *
 * · entity='us' 행만 본다(한국법인 사이드 remit 행은 같은 돈의 반대편이라 이중계상됨).
 * · period를 주면 그 달의 행만 센다(쿼리가 이미 걸렀더라도 방어적으로 한 번 더).
 * · 송금분은 파생: gross − commission. 커미션율로 재계산하지 않는다.
 * · 기간 통화는 **revenue 행**이 정한다. fee 행은 Stripe 정산통화를 들고 올 수
 *   있어서, 아무 행이나 통화를 덮어쓰게 두면 정산서 통화가 바뀔 수 있다.
 * · fee 합계는 기간 통화와 같은 통화의 행만 더한다. 다른 통화의 fee 행은
 *   섞어 더하지 않고 "확인 안 됨"으로 남긴다(feeKnownOrders에 세지 않는다).
 */
export function aggregatePeriod(
  rows: SettlementLedgerRow[],
  period?: string | null,
): PeriodAggregate {
  const scoped = (rows ?? []).filter((r) => r.entity === 'us' && (!period || r.period === period))

  let grossMinor = 0
  let commissionMinor = 0
  let currency = 'USD'
  const bookingIds = new Set<string>()

  for (const r of scoped) {
    if (r.type === 'revenue') {
      grossMinor += r.amount_minor
      if (r.currency) currency = String(r.currency).toUpperCase()
      if (r.booking_id) bookingIds.add(r.booking_id)
    } else if (r.type === 'commission') {
      commissionMinor += r.amount_minor
    }
  }

  // fee 행은 통화가 확정된 뒤에 센다 (revenue가 통화를 정하기 때문).
  let feeSigned = 0
  let feeRows = 0
  const feeBookings = new Set<string>()
  for (const r of scoped) {
    if (r.type !== 'fee') continue
    if (r.currency && String(r.currency).toUpperCase() !== currency) continue
    feeSigned += r.amount_minor
    feeRows += 1
    if (r.booking_id) feeBookings.add(r.booking_id)
  }

  return {
    grossMinor,
    commissionMinor,
    remitMinor: grossMinor - commissionMinor,
    orderCount: bookingIds.size,
    currency,
    stripeFeeMinor: feeRows > 0 ? -feeSigned : null,
    feeKnownOrders: feeBookings.size,
  }
}

// ---------------------------------------------------------------------------
// 인보이스 연번 (§6.4)
// ---------------------------------------------------------------------------

export const DEFAULT_INVOICE_PREFIX = 'AK-IC'

/** 'AK-IC-2026-001' — 연도 단위 3자리 zero-pad. 999를 넘으면 자릿수가 늘어난다. */
export function invoiceNumberFor(year: number, seq: number, prefix = DEFAULT_INVOICE_PREFIX): string {
  const n = Math.max(1, Math.floor(seq))
  return `${prefix}-${year}-${String(n).padStart(3, '0')}`
}

/** 'AK-IC-2026-007' → 7. 형식이 안 맞으면 null. */
export function parseInvoiceSeq(
  invoiceNo: string | null | undefined,
  year: number,
  prefix = DEFAULT_INVOICE_PREFIX,
): number | null {
  if (!invoiceNo) return null
  const m = new RegExp(`^${prefix}-${year}-(\\d+)$`).exec(invoiceNo)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * 해당 연도의 다음 연번. 기존 최대값+1 (없으면 1).
 *
 * 연번 무결성(gapless) 전략: 과거 행을 절대 지우지 않는다는 전제 아래 "최대값+1"이
 * 곧 결번 없는 다음 번호다. 동시 마감으로 같은 번호를 두 요청이 집으면 DB의
 * UNIQUE(invoice_no)가 튕겨내고 호출부가 1회 재시도한다. 재시도로도 안 되면
 * 조용히 건너뛰지 않고 에러로 실패시킨다(결번은 회계에서 설명 불가한 구멍이다).
 */
export async function nextInvoiceSeq(
  supabase: SupabaseClient,
  year: number,
  prefix = DEFAULT_INVOICE_PREFIX,
): Promise<number> {
  const { data, error } = await supabase
    .from('ops_intercompany_invoices')
    .select('invoice_no')
    .like('invoice_no', `${prefix}-${year}-%`)
    .limit(2000)
  if (error) throw new Error(error.message ?? 'invoice seq lookup failed')

  // 최대값은 SQL 정렬이 아니라 여기서 숫자로 고른다: 문자열 정렬은 999를 넘는 순간
  // 'AK-IC-2026-1000' < 'AK-IC-2026-999'가 되어 연번을 되감아 버린다.
  // 연 12장 규모라 전체를 읽어 비교하는 비용은 무시할 수 있다.
  const rows = (data ?? []) as { invoice_no: string }[]
  let top = 0
  for (const r of rows) {
    const n = parseInvoiceSeq(r.invoice_no, year, prefix)
    if (n !== null && n > top) top = n
  }
  return top + 1
}

// ---------------------------------------------------------------------------
// 3자 대사 (순수) — §6.4, 마감의 하드 게이트
// ---------------------------------------------------------------------------

export interface ReconcilePeriodInput {
  remitMinor: number
}
export interface ReconcileInvoiceInput {
  amountMinor: number
}
export interface ReconcileRemittanceInput {
  amountUsdMinor: number
}

export interface ReconcileResult {
  ok: boolean
  /** 실제 송금 합계(여러 건이면 합산). */
  remittedMinor: number
  diffs: {
    /** 인보이스 − 정산서 송금분. 0이어야 한다. */
    invoiceVsPeriod: number
    /** 송금합 − 인보이스. 0이어야 한다. */
    remitVsInvoice: number
  }
  message: string
}

/**
 * 정산서 송금분 / 인보이스 금액 / 실제 송금합 3자 비교.
 *
 * 허용오차는 0이다. 전부 정수 minor units라 반올림 오차가 원리적으로 생기지 않고,
 * 은행 수수료로 실입금이 줄었다면 그건 '오차'가 아니라 설명이 필요한 사실이므로
 * 사람이 송금 기록을 고치거나 note에 남겨야 한다(자동 흡수 금지).
 */
export function reconcile(
  period: ReconcilePeriodInput | null | undefined,
  invoice: ReconcileInvoiceInput | null | undefined,
  remittances: ReconcileRemittanceInput[] | null | undefined,
): ReconcileResult {
  const list = remittances ?? []
  const remittedMinor = list.reduce((sum, r) => sum + (Number(r?.amountUsdMinor) || 0), 0)

  if (!period) {
    return {
      ok: false,
      remittedMinor,
      diffs: { invoiceVsPeriod: 0, remitVsInvoice: 0 },
      message: '정산 기간이 마감되지 않았습니다.',
    }
  }
  if (!invoice) {
    return {
      ok: false,
      remittedMinor,
      diffs: { invoiceVsPeriod: 0, remitVsInvoice: 0 },
      message: '인터컴퍼니 인보이스가 아직 발행되지 않았습니다.',
    }
  }

  const invoiceVsPeriod = invoice.amountMinor - period.remitMinor
  const remitVsInvoice = remittedMinor - invoice.amountMinor

  if (list.length === 0) {
    return {
      ok: false,
      remittedMinor,
      diffs: { invoiceVsPeriod, remitVsInvoice },
      message: '송금 기록이 없습니다. 은행 송금 후 기록을 등록하세요.',
    }
  }

  if (invoiceVsPeriod !== 0) {
    return {
      ok: false,
      remittedMinor,
      diffs: { invoiceVsPeriod, remitVsInvoice },
      message: `인보이스 금액이 정산서 송금분과 다릅니다 (차액 ${invoiceVsPeriod} minor).`,
    }
  }
  if (remitVsInvoice !== 0) {
    return {
      ok: false,
      remittedMinor,
      diffs: { invoiceVsPeriod, remitVsInvoice },
      message: `실제 송금합이 인보이스 금액과 다릅니다 (차액 ${remitVsInvoice} minor).`,
    }
  }

  return {
    ok: true,
    remittedMinor,
    diffs: { invoiceVsPeriod: 0, remitVsInvoice: 0 },
    message: '정산서 · 인보이스 · 송금기록 3자 금액이 일치합니다.',
  }
}

// ---------------------------------------------------------------------------
// IO — 행 타입
// ---------------------------------------------------------------------------

export type SettlementStatus = 'open' | 'closed' | 'invoiced' | 'remitted' | 'reconciled'

export interface SettlementPeriodRow {
  id: string
  tenant_id: string
  period: string
  status: SettlementStatus
  gross_minor: number
  commission_minor: number
  remit_minor: number
  margin_rate: number
  order_count: number
  stripe_fee_minor: number | null
  currency: string
  note: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface IntercompanyInvoiceRow {
  id: string
  tenant_id: string
  period_id: string
  invoice_no: string
  issue_date: string
  amount_minor: number
  currency: string
  fx_rate: number | null
  fx_rate_date: string | null
  status: 'draft' | 'issued'
  pdf_url: string | null
  notes: string | null
  created_at: string
}

export interface RemittanceRow {
  id: string
  tenant_id: string
  period_id: string
  wire_date: string
  amount_usd_minor: number
  amount_krw: number | null
  fx_rate: number | null
  swift_doc_url: string | null
  bank_ref: string | null
  note: string | null
  created_at: string
}

/** status 순서 — 뒤로 후퇴시키지 않기 위한 서열. */
const STATUS_RANK: Record<SettlementStatus, number> = {
  open: 0,
  closed: 1,
  invoiced: 2,
  remitted: 3,
  reconciled: 4,
}

export function statusRank(status: string): number {
  return STATUS_RANK[status as SettlementStatus] ?? 0
}

const PERIOD_COLS =
  'id, tenant_id, period, status, gross_minor, commission_minor, remit_minor, margin_rate, order_count, stripe_fee_minor, currency, note, closed_at, created_at, updated_at'
const INVOICE_COLS =
  'id, tenant_id, period_id, invoice_no, issue_date, amount_minor, currency, fx_rate, fx_rate_date, status, pdf_url, notes, created_at'
const REMITTANCE_COLS =
  'id, tenant_id, period_id, wire_date, amount_usd_minor, amount_krw, fx_rate, swift_doc_url, bank_ref, note, created_at'

/** 숫자로 올 수도 있고 numeric 문자열로 올 수도 있는 컬럼 정규화. */
function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}

function normalizePeriodRow(raw: Record<string, unknown>): SettlementPeriodRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id ?? FINANCE_TENANT_ID),
    period: String(raw.period),
    status: (raw.status as SettlementStatus) ?? 'open',
    gross_minor: num(raw.gross_minor),
    commission_minor: num(raw.commission_minor),
    remit_minor: num(raw.remit_minor),
    margin_rate: num(raw.margin_rate),
    order_count: num(raw.order_count),
    stripe_fee_minor: raw.stripe_fee_minor == null ? null : num(raw.stripe_fee_minor),
    currency: String(raw.currency ?? 'USD'),
    note: (raw.note as string) ?? null,
    closed_at: (raw.closed_at as string) ?? null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  }
}

function normalizeInvoiceRow(raw: Record<string, unknown>): IntercompanyInvoiceRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id ?? FINANCE_TENANT_ID),
    period_id: String(raw.period_id),
    invoice_no: String(raw.invoice_no),
    issue_date: String(raw.issue_date ?? ''),
    amount_minor: num(raw.amount_minor),
    currency: String(raw.currency ?? 'USD'),
    fx_rate: raw.fx_rate == null ? null : num(raw.fx_rate),
    fx_rate_date: (raw.fx_rate_date as string) ?? null,
    status: (raw.status as 'draft' | 'issued') ?? 'draft',
    pdf_url: (raw.pdf_url as string) ?? null,
    notes: (raw.notes as string) ?? null,
    created_at: String(raw.created_at ?? ''),
  }
}

function normalizeRemittanceRow(raw: Record<string, unknown>): RemittanceRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id ?? FINANCE_TENANT_ID),
    period_id: String(raw.period_id),
    wire_date: String(raw.wire_date ?? ''),
    amount_usd_minor: num(raw.amount_usd_minor),
    amount_krw: raw.amount_krw == null ? null : num(raw.amount_krw),
    fx_rate: raw.fx_rate == null ? null : num(raw.fx_rate),
    swift_doc_url: (raw.swift_doc_url as string) ?? null,
    bank_ref: (raw.bank_ref as string) ?? null,
    note: (raw.note as string) ?? null,
    created_at: String(raw.created_at ?? ''),
  }
}

// ---------------------------------------------------------------------------
// IO — 조회
// ---------------------------------------------------------------------------

export async function fetchPeriod(
  supabase: SupabaseClient,
  period: string,
  tenantId = FINANCE_TENANT_ID,
): Promise<SettlementPeriodRow | null> {
  const { data, error } = await supabase
    .from('ops_settlement_periods')
    .select(PERIOD_COLS)
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .maybeSingle()
  if (error) throw new Error(error.message ?? 'period lookup failed')
  return data ? normalizePeriodRow(data as Record<string, unknown>) : null
}

export async function listPeriods(
  supabase: SupabaseClient,
  tenantId = FINANCE_TENANT_ID,
  limit = 36,
): Promise<SettlementPeriodRow[]> {
  const { data, error } = await supabase
    .from('ops_settlement_periods')
    .select(PERIOD_COLS)
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message ?? 'period list failed')
  return ((data ?? []) as Record<string, unknown>[]).map(normalizePeriodRow)
}

export async function fetchInvoice(
  supabase: SupabaseClient,
  periodId: string,
): Promise<IntercompanyInvoiceRow | null> {
  const { data, error } = await supabase
    .from('ops_intercompany_invoices')
    .select(INVOICE_COLS)
    .eq('period_id', periodId)
    .maybeSingle()
  if (error) throw new Error(error.message ?? 'invoice lookup failed')
  return data ? normalizeInvoiceRow(data as Record<string, unknown>) : null
}

export async function listRemittances(
  supabase: SupabaseClient,
  periodId: string,
): Promise<RemittanceRow[]> {
  const { data, error } = await supabase
    .from('ops_remittances')
    .select(REMITTANCE_COLS)
    .eq('period_id', periodId)
    .order('wire_date', { ascending: true })
  if (error) throw new Error(error.message ?? 'remittance list failed')
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeRemittanceRow)
}

/**
 * 한 번에 읽는 원장 행 상한. 이 사이클에서 유일하게 "조용히 틀릴 수 있었던"
 * 지점이라, 상한에 닿으면 잘라내지 않고 던진다 — 정산은 금액이므로 일부만
 * 집계한 그럴듯한 숫자보다 명시적 실패가 낫다(페이지네이션은 실제로 이 규모에
 * 닿을 때 도입한다: 5000행 ≈ 주문 2500건/월).
 */
export const LEDGER_FETCH_LIMIT = 5000

/** 기간의 us 원장 행(명세용). booking_id/type/amount까지 그대로 돌려준다. */
export async function fetchPeriodLedgerRows(
  supabase: SupabaseClient,
  period: string,
  tenantId = FINANCE_TENANT_ID,
): Promise<SettlementLedgerRow[]> {
  const { data, error } = await supabase
    .from('ops_entity_ledger')
    .select('entity, booking_id, period, type, amount_minor, currency, external_ref')
    .eq('tenant_id', tenantId)
    .eq('entity', 'us')
    .eq('period', period)
    .limit(LEDGER_FETCH_LIMIT)
  if (error) throw new Error(error.message ?? 'ledger lookup failed')
  const rows = (data ?? []) as SettlementLedgerRow[]
  if (rows.length >= LEDGER_FETCH_LIMIT) {
    throw new Error(
      `ops_entity_ledger page limit reached for ${period} (${rows.length} rows) — a truncated read would silently under-report the settlement; add pagination before closing this period`,
    )
  }
  return rows
}

// ---------------------------------------------------------------------------
// IO — 마감 / 발행 / 대사
// ---------------------------------------------------------------------------

export interface ClosePeriodResult {
  period: SettlementPeriodRow
  aggregate: PeriodAggregate
  /** 이미 인보이스 이후 단계라 금액을 다시 쓰지 않고 기존 행을 그대로 돌려준 경우. */
  locked: boolean
  /** 새로 만든 행이면 true (재마감이면 false). */
  created: boolean
}

/**
 * 월 마감 (F-2). 원장(us) 집계 → ops_settlement_periods upsert.
 *
 * 멱등: UNIQUE(tenant_id, period)가 행을 1개로 묶는다. 재마감은 금액을 다시 계산해
 * 갱신하되(캡처가 늦게 들어왔을 수 있다), 이미 invoiced 이상이면 금액을 건드리지
 * 않는다 — 발행된 인보이스가 참조하는 숫자가 소리 없이 바뀌면 안 되기 때문.
 * 그 경우 locked:true로 알리고 사람이 판단하게 한다.
 */
export async function closePeriod(
  supabase: SupabaseClient,
  period: string,
  opts: { tenantId?: string; marginRate: number; nowIso?: string } = { marginRate: 0.05 },
): Promise<ClosePeriodResult> {
  if (!isValidPeriod(period)) throw new Error(`Invalid period: ${period}`)
  const tenantId = opts.tenantId ?? FINANCE_TENANT_ID
  const nowIso = opts.nowIso ?? new Date().toISOString()

  const rows = await fetchPeriodLedgerRows(supabase, period, tenantId)
  const aggregate = aggregatePeriod(rows, period)

  const existing = await fetchPeriod(supabase, period, tenantId)

  // 이미 인보이스 이후 단계 → 금액 불변. 집계는 참고로만 돌려준다.
  if (existing && statusRank(existing.status) >= STATUS_RANK.invoiced) {
    return { period: existing, aggregate, locked: true, created: false }
  }

  const payload = {
    tenant_id: tenantId,
    period,
    status: 'closed' as const,
    gross_minor: aggregate.grossMinor,
    commission_minor: aggregate.commissionMinor,
    remit_minor: aggregate.remitMinor,
    margin_rate: opts.marginRate,
    order_count: aggregate.orderCount,
    // §6.3 — 원장의 fee 행에서 파생. 확인된 행이 없으면 null(추정 금지, 컬럼 주석
    // 그대로). 재마감 시 뒤늦게 들어온 fee 행이 자연히 반영된다.
    stripe_fee_minor: aggregate.stripeFeeMinor,
    currency: aggregate.currency,
    closed_at: nowIso,
    updated_at: nowIso,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('ops_settlement_periods')
      .update(payload)
      .eq('id', existing.id)
      .select(PERIOD_COLS)
      .single()
    if (error) throw new Error(error.message ?? 'period update failed')
    return {
      period: normalizePeriodRow(data as Record<string, unknown>),
      aggregate,
      locked: false,
      created: false,
    }
  }

  const { data, error } = await supabase
    .from('ops_settlement_periods')
    .insert(payload)
    .select(PERIOD_COLS)
    .single()

  if (error) {
    // 동시 마감 레이스 — UNIQUE(tenant_id, period)가 튕겼다. 재조회로 수렴.
    const raced = await fetchPeriod(supabase, period, tenantId)
    if (raced) return { period: raced, aggregate, locked: false, created: false }
    throw new Error(error.message ?? 'period insert failed')
  }

  return {
    period: normalizePeriodRow(data as Record<string, unknown>),
    aggregate,
    locked: false,
    created: true,
  }
}

export interface IssueInvoiceResult {
  invoice: IntercompanyInvoiceRow
  /** 이미 있던 인보이스를 그대로 돌려준 경우 true (멱등 경로). */
  existed: boolean
}

/**
 * 인터컴퍼니 인보이스 발행 (F-2 / §6.4).
 *
 * · period가 closed 이상일 때만. open이면 거부(집계 없이 금액을 못 정한다).
 * · 기간당 1장 — 이미 있으면 그것을 그대로 반환(멱등).
 * · 금액 = period.remit_minor (정산서 송금분과 같은 숫자여야 3자 대사가 성립).
 * · 연번 충돌은 1회 재시도. 그래도 안 되면 실패시킨다(조용한 결번 금지).
 */
export async function issueInvoice(
  supabase: SupabaseClient,
  periodRow: SettlementPeriodRow,
  opts: { prefix?: string; issueDate?: string; notes?: string | null } = {},
): Promise<IssueInvoiceResult> {
  if (statusRank(periodRow.status) < STATUS_RANK.closed) {
    throw new Error('period_not_closed')
  }

  const existing = await fetchInvoice(supabase, periodRow.id)
  if (existing) return { invoice: existing, existed: true }

  const prefix = opts.prefix ?? DEFAULT_INVOICE_PREFIX
  const year = Number(periodRow.period.slice(0, 4))

  let lastError: string | null = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const seq = await nextInvoiceSeq(supabase, year, prefix)
    const invoiceNo = invoiceNumberFor(year, seq, prefix)
    const payload: Record<string, unknown> = {
      tenant_id: periodRow.tenant_id,
      period_id: periodRow.id,
      invoice_no: invoiceNo,
      amount_minor: periodRow.remit_minor,
      currency: periodRow.currency || 'USD',
      status: 'draft',
      notes: opts.notes ?? null,
    }
    if (opts.issueDate) payload.issue_date = opts.issueDate

    const { data, error } = await supabase
      .from('ops_intercompany_invoices')
      .insert(payload)
      .select(INVOICE_COLS)
      .single()

    if (!error && data) {
      // 상태 전진 (closed → invoiced). 이미 더 앞선 상태면 건드리지 않는다.
      if (statusRank(periodRow.status) < STATUS_RANK.invoiced) {
        await supabase
          .from('ops_settlement_periods')
          .update({ status: 'invoiced', updated_at: new Date().toISOString() })
          .eq('id', periodRow.id)
      }
      return { invoice: normalizeInvoiceRow(data as Record<string, unknown>), existed: false }
    }

    lastError = error?.message ?? 'invoice insert failed'
    // period_id UNIQUE에 걸렸다면 동시 발행 — 기존 것을 쓰면 된다(멱등).
    const raced = await fetchInvoice(supabase, periodRow.id)
    if (raced) return { invoice: raced, existed: true }
    // invoice_no UNIQUE에 걸린 경우만 재시도 대상 → 루프 계속.
  }

  throw new Error(lastError ?? 'invoice_number_conflict')
}

/**
 * '1,234.56' | 1234.56 → 123456 (정수 minor units). 0 이하·비수치는 null.
 * 금액이 시스템에 들어오는 유일한 관문 — 여기서 정수로 못박고, 이후로는 어디서도
 * 부동소수 금액 연산을 하지 않는다(3자 대사 허용오차 0의 전제).
 */
export function parseUsdToMinor(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'string' ? Number(raw.replace(/[, ]/g, '')) : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

export interface RecordRemittanceInput {
  wireDate: string
  amountUsdMinor: number
  amountKrw?: number | null
  fxRate?: number | null
  bankRef?: string | null
  swiftDocUrl?: string | null
  note?: string | null
}

/** 송금 기록 등록 (F-3). 등록 자체가 송금을 실행하지는 않는다 — 사후 기록이다(D10). */
export async function recordRemittance(
  supabase: SupabaseClient,
  periodRow: SettlementPeriodRow,
  input: RecordRemittanceInput,
): Promise<RemittanceRow> {
  const { data, error } = await supabase
    .from('ops_remittances')
    .insert({
      tenant_id: periodRow.tenant_id,
      period_id: periodRow.id,
      wire_date: input.wireDate,
      amount_usd_minor: input.amountUsdMinor,
      amount_krw: input.amountKrw ?? null,
      fx_rate: input.fxRate ?? null,
      bank_ref: input.bankRef ?? null,
      swift_doc_url: input.swiftDocUrl ?? null,
      note: input.note ?? null,
    })
    .select(REMITTANCE_COLS)
    .single()
  if (error) throw new Error(error.message ?? 'remittance insert failed')

  if (statusRank(periodRow.status) < STATUS_RANK.remitted) {
    await supabase
      .from('ops_settlement_periods')
      .update({ status: 'remitted', updated_at: new Date().toISOString() })
      .eq('id', periodRow.id)
  }

  return normalizeRemittanceRow(data as Record<string, unknown>)
}

/** period 행의 status를 'reconciled'로 전진. 대사가 통과했을 때만 호출할 것. */
export async function markReconciled(
  supabase: SupabaseClient,
  periodId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ops_settlement_periods')
    .update({ status: 'reconciled', updated_at: new Date().toISOString() })
    .eq('id', periodId)
  if (error) throw new Error(error.message ?? 'reconcile status update failed')
}
