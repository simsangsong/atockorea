// AtoC 통합 플랜 §6.3 / §14.3 — Stripe 실수수료 조회.
//
// ops_settlement_periods.stripe_fee_minor는 컬럼만 있고 아무도 채우지 않았다:
// 정산서에 gross / commission / remit는 보이는데 LLC가 실제로 문 결제비용은
// 보이지 않았고, 그래서 정산서를 Stripe payout과 맞춰볼 수가 없었다.
//
// 🔴 이 모듈은 절대 수수료를 "계산"하지 않는다. 2.9%+30¢ 같은 요율을 코드에
//    박으면 국가별 카드·인터체인지·환전·Radar 요금이 섞이는 순간 조용히 틀린
//    숫자가 원장에 들어간다. 유일한 출처는 Stripe balance transaction의 `fee`
//    (그 결제에 대해 Stripe가 실제로 뗀 금액)이다. 못 읽으면 못 읽었다고
//    말하고 아무 행도 쓰지 않는다 — 추정치보다 공백이 낫다.
//
// 🔴 D10: 조회 전용. 여기서 청구·환불·전송하는 것은 하나도 없다.

import type Stripe from 'stripe'

/** 실제로 확인된 수수료 사실. 전부 정수 minor units. */
export interface StripeFeeFacts {
  /** Stripe가 뗀 금액 (양수 크기). 원장에는 유출이므로 음수로 기입된다. */
  feeMinor: number
  /** balance transaction의 정산 통화 (ISO 4217 대문자). */
  currency: string
  balanceTransactionId: string | null
  chargeId: string | null
  /** bt.exchange_rate — 결제통화 ≠ 정산통화일 때만 채워진다(참고용). */
  exchangeRate: number | null
}

export type StripeFeeLookup =
  | { ok: true; fee: StripeFeeFacts }
  /**
   * 못 읽은 이유. 어느 쪽이든 fee 행을 쓰지 않는다:
   *  · no_charge            — PI에 charge가 아직 붙지 않음
   *  · not_expanded         — balance_transaction이 id 문자열뿐 (확장 실패)
   *  · balance_pending      — bt는 있으나 아직 확정 전 (드문 결제수단)
   *  · lookup_failed        — Stripe 조회 자체가 실패 (네트워크/권한)
   */
  | { ok: false; reason: 'no_charge' | 'not_expanded' | 'balance_pending' | 'lookup_failed' }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/**
 * 확장된 charge(= balance_transaction 객체 포함)에서 수수료 사실을 뽑는다. 순수.
 *
 * Stripe 타입을 그대로 요구하지 않고 느슨한 형태를 읽는 이유: 이 함수가 이
 * 경로에서 유일하게 "금액을 해석하는" 지점이라 단위 테스트가 Stripe SDK 객체
 * 없이 모든 결측 형태를 통과시킬 수 있어야 한다.
 */
export function readStripeFee(charge: unknown): StripeFeeLookup {
  const ch = asRecord(charge)
  if (!ch) return { ok: false, reason: 'no_charge' }

  const bt = asRecord(ch.balance_transaction)
  if (!bt) {
    // 문자열 id만 있다 = 확장되지 않았다. 여기서 추정하지 않는다.
    return { ok: false, reason: typeof ch.balance_transaction === 'string' ? 'not_expanded' : 'no_charge' }
  }

  const fee = bt.fee
  if (typeof fee !== 'number' || !Number.isFinite(fee)) {
    return { ok: false, reason: 'not_expanded' }
  }
  // 'available' | 'pending'. pending도 fee 자체는 확정값이지만, 값이 비어
  // 있는(0 이하가 아닌 non-number) 경우만 걸러내면 되고 status는 참고만 한다.
  if (bt.status !== 'available' && bt.status !== 'pending' && bt.status !== undefined) {
    return { ok: false, reason: 'balance_pending' }
  }

  const currency = typeof bt.currency === 'string' && bt.currency ? bt.currency.toUpperCase() : null
  if (!currency) return { ok: false, reason: 'not_expanded' }

  return {
    ok: true,
    fee: {
      // 정수 minor units — Stripe도 정수로 준다. 반올림은 방어적 항등식.
      feeMinor: Math.round(fee),
      currency,
      balanceTransactionId: typeof bt.id === 'string' ? bt.id : null,
      chargeId: typeof ch.id === 'string' ? ch.id : null,
      exchangeRate:
        typeof bt.exchange_rate === 'number' && Number.isFinite(bt.exchange_rate) ? bt.exchange_rate : null,
    },
  }
}

/**
 * 캡처된 PaymentIntent의 실수수료 조회 (읽기 전용 Stripe 호출 1회).
 *
 * 이미 확장된 pi(latest_charge.balance_transaction)를 들고 있으면 그걸 먼저
 * 읽고, 아니면 latest_charge를 balance_transaction 확장으로 한 번 retrieve
 * 한다. 실패는 전부 ok:false — 절대 throw하지 않는다(캡처 경로 best-effort).
 */
export async function fetchStripeFee(
  stripe: Pick<Stripe, 'charges'>,
  paymentIntent: unknown,
): Promise<StripeFeeLookup> {
  const pi = asRecord(paymentIntent)
  if (!pi) return { ok: false, reason: 'no_charge' }

  const latest = pi.latest_charge
  const inline = readStripeFee(latest)
  if (inline.ok) return inline

  const chargeId = typeof latest === 'string' ? latest : (asRecord(latest)?.id as string | undefined)
  if (!chargeId) return { ok: false, reason: 'no_charge' }

  try {
    const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] })
    return readStripeFee(charge)
  } catch {
    return { ok: false, reason: 'lookup_failed' }
  }
}
