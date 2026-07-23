// AtoC 통합 F-슬라이스 — 캡처 원장 기입 (plan §6.1 F-1).
//
// Stripe 캡처(홀드 캡처 시점 = payment_intent.succeeded)가 확정되면 ops_entity_ledger에
// 내부 회계 기록만 남긴다. 고객 인보이스는 발행하지 않는다(D11 — Stripe 영수증 갈음).
//
// 기입 2행 (미국 LLC 사이드):
//   (us, revenue,    +gross)  — LLC가 수취한 결제 총액(gross)
//   (us, commission, +5%)     — LLC가 보유하는 커미션(D6, gross × margin_rate)
// 송금분(95%)은 월 정산(F-2)에서 Σrevenue − Σcommission으로 파생 → 실제 송금(F-3) 시
// (us, remit, -R)+(kr, remit, +R)를 fx_rate와 함께 기입한다(별도 슬라이스).
//
// 멱등: (booking_id, entity, type, source='stripe_capture') 유일 인덱스로 upsert
// ignoreDuplicates. 크론 캡처와 webhook succeeded가 이중 발화해도 1행으로 수렴한다.
// 원장 기입 실패는 캡처를 되돌리지 않는다 — 호출부에서 best-effort(throw 없음).

import type { SupabaseClient } from '@supabase/supabase-js'
import { FINANCE_TENANT_ID } from './config'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 'YYYY-MM' — KST 정산기간. Date.now() 기반(호출은 런타임 캡처 시점). */
export function kstPeriod(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 7)
}

export interface CaptureSplit {
  grossMinor: number
  commissionMinor: number
  remitMinor: number
}

/**
 * gross(minor units)를 커미션/송금분으로 분할. 정수 연산으로 세 값의 합이 정확히
 * gross가 되도록 보장(3자 대사 정합, §6.4): commission = round(gross × rate),
 * remit = gross − commission.
 */
export function computeCaptureSplit(grossMinor: number, marginRate: number): CaptureSplit {
  const gross = Math.max(0, Math.round(grossMinor || 0))
  const rate = Number.isFinite(marginRate) && marginRate >= 0 && marginRate <= 1 ? marginRate : 0.05
  const commission = Math.round(gross * rate)
  return { grossMinor: gross, commissionMinor: commission, remitMinor: gross - commission }
}

export interface RecordCaptureLedgerInput {
  bookingId: string
  /** pi.amount_received (없으면 amount) — minor units. */
  grossMinor: number
  /** pi.currency (Stripe는 소문자) — 저장 시 대문자 정규화. */
  currency: string
  marginRate: number
  paymentIntentId?: string | null
  /** 테스트/재처리용 고정 타임스탬프. 미지정 시 Date.now(). */
  nowMs?: number
  tenantId?: string
}

export interface RecordCaptureLedgerResult {
  ok: boolean
  split: CaptureSplit | null
  error?: string
}

/** 캡처 확정 후 원장 2행 멱등 기입. 절대 throw하지 않는다(호출부 best-effort). */
export async function recordCaptureLedger(
  supabase: SupabaseClient,
  input: RecordCaptureLedgerInput,
): Promise<RecordCaptureLedgerResult> {
  try {
    if (!input.bookingId) return { ok: false, split: null, error: 'missing_booking_id' }
    const gross = Math.round(input.grossMinor || 0)
    if (!(gross > 0)) return { ok: false, split: null, error: 'non_positive_gross' }

    const split = computeCaptureSplit(gross, input.marginRate)
    const currency = (input.currency || 'usd').toUpperCase()
    const period = kstPeriod(input.nowMs)
    const tenantId = input.tenantId ?? FINANCE_TENANT_ID
    const source = 'stripe_capture'
    const externalRef = input.paymentIntentId ?? null

    const rows = [
      {
        tenant_id: tenantId,
        entity: 'us',
        booking_id: input.bookingId,
        period,
        type: 'revenue',
        amount_minor: split.grossMinor,
        currency,
        source,
        external_ref: externalRef,
        meta: { margin_rate: input.marginRate },
      },
      {
        tenant_id: tenantId,
        entity: 'us',
        booking_id: input.bookingId,
        period,
        type: 'commission',
        amount_minor: split.commissionMinor,
        currency,
        source,
        external_ref: externalRef,
        meta: { margin_rate: input.marginRate, remit_minor: split.remitMinor },
      },
    ]

    const { error } = await supabase
      .from('ops_entity_ledger')
      .upsert(rows, { onConflict: 'booking_id,entity,type,source', ignoreDuplicates: true })
    if (error) return { ok: false, split, error: error.message ?? 'ledger upsert failed' }
    return { ok: true, split }
  } catch (e) {
    return { ok: false, split: null, error: e instanceof Error ? e.message : 'unknown' }
  }
}
