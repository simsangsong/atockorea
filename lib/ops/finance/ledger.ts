// AtoC 통합 F-슬라이스 — 캡처 원장 기입 (plan §6.1 F-1).
//
// Stripe 캡처(홀드 캡처 시점 = payment_intent.succeeded)가 확정되면 ops_entity_ledger에
// 내부 회계 기록만 남긴다. 고객 인보이스는 발행하지 않는다(D11 — Stripe 영수증 갈음).
//
// 기입 2~3행 (미국 LLC 사이드):
//   (us, revenue,    +gross)  — LLC가 수취한 결제 총액(gross)
//   (us, commission, +5%)     — LLC가 보유하는 커미션(D6, gross × margin_rate)
//   (us, fee,        -실수수료) — Stripe가 실제로 뗀 결제비용 (§6.3 / §14.3)
// 송금분(95%)은 월 정산(F-2)에서 Σrevenue − Σcommission으로 파생 → 실제 송금(F-3) 시
// (us, remit, -R)+(kr, remit, +R)를 fx_rate와 함께 기입한다(별도 슬라이스).
//
// fee 행 (§6.3 잔여 — 이번 슬라이스):
//   · 금액 출처는 오직 Stripe balance transaction의 `fee`다. 요율(2.9%+30¢)을
//     코드에 박지 않는다 — lib/ops/finance/stripeFee.ts 참조.
//   · 부호는 원장 규약대로 음수(유출). commission+remit=gross 불변식과 무관한
//     별개 축이므로 정산서의 3자 대사 산식은 전혀 흔들리지 않는다.
//   · balance transaction을 못 읽으면 fee 행을 아예 쓰지 않는다. 그 달의
//     stripe_fee_minor는 null(=모름)로 남고, 정산서가 "몇 건이 확인됐는지"를
//     같이 보여준다. 추정치를 원장에 넣는 것보다 공백이 낫다.
//
// 멱등: (booking_id, entity, type, source='stripe_capture') 유일 인덱스로 upsert
// ignoreDuplicates. 크론 캡처와 webhook succeeded가 이중 발화해도 1행으로 수렴한다.
// fee 행도 같은 인덱스를 타므로, 크론이 bt 없이 2행만 남기고 뒤늦게 webhook이
// 3행을 시도해도 fee 행만 새로 들어가고 나머지는 조용히 무시된다(수렴).
// 원장 기입 실패는 캡처를 되돌리지 않는다 — 호출부에서 best-effort(throw 없음).

import type { SupabaseClient } from '@supabase/supabase-js'
import { FINANCE_TENANT_ID } from './config'
import type { StripeFeeFacts } from './stripeFee'

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
  /**
   * §6.3 — Stripe가 실제로 뗀 수수료. 확인됐을 때만 넘긴다(추정 금지).
   * 없거나 null이면 fee 행을 쓰지 않고 result.feeGap에 이유가 담긴다.
   */
  stripeFee?: StripeFeeFacts | null
  /** stripeFee가 없을 때 기록할 사유 (stripeFee.ts의 lookup reason). */
  stripeFeeGap?: string | null
  /** 테스트/재처리용 고정 타임스탬프. 미지정 시 Date.now(). */
  nowMs?: number
  tenantId?: string
}

export interface RecordCaptureLedgerResult {
  ok: boolean
  split: CaptureSplit | null
  /** true = (us, fee, −실수수료) 행까지 기입 시도됨. */
  feeRecorded: boolean
  /** feeRecorded=false인 이유 — 정산서의 "미확인"과 같은 사실. */
  feeGap?: string
  error?: string
}

/** ops_entity_ledger insert 행 (이 모듈이 쓰는 컬럼만). */
interface LedgerRowInsert {
  tenant_id: string
  entity: 'us' | 'kr'
  booking_id: string
  period: string
  type: 'revenue' | 'commission' | 'fee'
  amount_minor: number
  currency: string
  source: string
  external_ref: string | null
  meta: Record<string, unknown>
}

/** 캡처 확정 후 원장 2~3행 멱등 기입. 절대 throw하지 않는다(호출부 best-effort). */
export async function recordCaptureLedger(
  supabase: SupabaseClient,
  input: RecordCaptureLedgerInput,
): Promise<RecordCaptureLedgerResult> {
  try {
    if (!input.bookingId) return { ok: false, split: null, feeRecorded: false, error: 'missing_booking_id' }
    const gross = Math.round(input.grossMinor || 0)
    if (!(gross > 0)) return { ok: false, split: null, feeRecorded: false, error: 'non_positive_gross' }

    const split = computeCaptureSplit(gross, input.marginRate)
    const currency = (input.currency || 'usd').toUpperCase()
    const period = kstPeriod(input.nowMs)
    const tenantId = input.tenantId ?? FINANCE_TENANT_ID
    const source = 'stripe_capture'
    const externalRef = input.paymentIntentId ?? null

    const rows: LedgerRowInsert[] = [
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

    // §6.3 — 실수수료 행. 확인된 사실이 있을 때만, 있는 그대로.
    const fee = input.stripeFee ?? null
    const feeMinor = fee ? Math.round(Number(fee.feeMinor) || 0) : 0
    const feeRecorded = Boolean(fee) && Number.isFinite(feeMinor) && feeMinor > 0
    if (fee && feeRecorded) {
      rows.push({
        tenant_id: tenantId,
        entity: 'us',
        booking_id: input.bookingId,
        period,
        type: 'fee',
        // 유출은 음수 (ops_entity_ledger 규약). 정수 연산만 — 부동소수 없음.
        amount_minor: -feeMinor,
        // balance transaction의 정산 통화. 결제통화와 다를 수 있으므로 그대로 남긴다.
        currency: fee.currency || currency,
        source,
        external_ref: externalRef,
        meta: {
          balance_transaction: fee.balanceTransactionId,
          charge: fee.chargeId,
          gross_currency: currency,
          exchange_rate: fee.exchangeRate,
        },
      })
    }

    const { error } = await supabase
      .from('ops_entity_ledger')
      .upsert(rows, { onConflict: 'booking_id,entity,type,source', ignoreDuplicates: true })
    if (error) {
      return { ok: false, split, feeRecorded: false, error: error.message ?? 'ledger upsert failed' }
    }
    return {
      ok: true,
      split,
      feeRecorded,
      ...(feeRecorded
        ? {}
        : { feeGap: input.stripeFeeGap || (fee ? 'non_positive_fee' : 'fee_not_available') }),
    }
  } catch (e) {
    return { ok: false, split: null, feeRecorded: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}
