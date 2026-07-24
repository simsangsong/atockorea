// AtoC 통합 플랜 Phase 3 — 정산 기간 상세 번들 로더.
//
// 기간 상세 화면과 인쇄 문서 2종(월 정산서 · 인터컴퍼니 인보이스)이 필요로 하는
// 데이터를 한 번에 모은다. 문서가 DB에서 결정론적으로 재렌더돼야 하므로(설계 결정 3)
// 이 로더가 문서의 유일한 입력 경로다 — 화면과 문서가 다른 숫자를 보면 안 된다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { FINANCE_TENANT_ID, getFinanceConfig, type FinanceConfig } from './config'
import type { BookingMeta } from './documents'
import {
  fetchInvoice,
  fetchPeriod,
  fetchPeriodLedgerRows,
  listRemittances,
  reconcile,
  type IntercompanyInvoiceRow,
  type ReconcileResult,
  type RemittanceRow,
  type SettlementLedgerRow,
  type SettlementPeriodRow,
} from './settlement'

export interface PeriodDetail {
  period: SettlementPeriodRow | null
  invoice: IntercompanyInvoiceRow | null
  remittances: RemittanceRow[]
  ledgerRows: SettlementLedgerRow[]
  bookingMeta: BookingMeta[]
  config: FinanceConfig
  reconcile: ReconcileResult
}

/** 예약 메타(예약번호·투어일자) — 인보이스 §6.4 "대상 주문번호·투어일자 목록"용. */
export async function fetchBookingMeta(
  supabase: SupabaseClient,
  bookingIds: string[],
): Promise<BookingMeta[]> {
  const ids = Array.from(new Set(bookingIds.filter(Boolean)))
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_reference, tour_date')
    .in('id', ids)
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    bookingId: String(r.id),
    bookingReference: (r.booking_reference as string) ?? null,
    tourDate: (r.tour_date as string) ?? null,
  }))
}

export async function loadPeriodDetail(
  supabase: SupabaseClient,
  period: string,
  tenantId = FINANCE_TENANT_ID,
): Promise<PeriodDetail> {
  const periodRow = await fetchPeriod(supabase, period, tenantId)
  const ledgerRows = await fetchPeriodLedgerRows(supabase, period, tenantId)
  const config = await getFinanceConfig(supabase)

  const invoice = periodRow ? await fetchInvoice(supabase, periodRow.id) : null
  const remittances = periodRow ? await listRemittances(supabase, periodRow.id) : []
  const bookingMeta = await fetchBookingMeta(
    supabase,
    ledgerRows.map((r) => r.booking_id ?? '').filter(Boolean),
  )

  return {
    period: periodRow,
    invoice,
    remittances,
    ledgerRows,
    bookingMeta,
    config,
    reconcile: reconcile(
      periodRow ? { remitMinor: periodRow.remit_minor } : null,
      invoice ? { amountMinor: invoice.amount_minor } : null,
      remittances.map((r) => ({ amountUsdMinor: r.amount_usd_minor })),
    ),
  }
}
