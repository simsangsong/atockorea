/**
 * 사업소득(인적용역) 원천징수 3.3% 계산 — AtoC 통합 플랜 §6.9.
 *
 * 🔴 이 파일은 kursoflow(`src/lib/tax/withholding.ts`)의 **포팅**이다. 산식·정수
 * 연산 순서·정규화 규칙을 한 글자도 바꾸지 않았고, 테스트 벡터도 그대로 가져왔다
 * (`__tests__/withholding.test.ts`). 이유는 취향이 아니라 원단위다: 절사 지점이
 * 하나만 어긋나도 두 시스템이 같은 지급건에 대해 1원씩 다른 세액을 내고, 그 1원이
 * 원천징수이행상황신고서와 지급명세서 사이의 불일치로 남는다. 리팩터 금지.
 *
 * 가이드/프리랜서에게 사업소득을 지급할 때 원천징수하는 세액:
 *   · 소득세      = 지급액 × 3%        (소득세법 §129 ①3호, 원단위 미만 절사)
 *   · 지방소득세  = 소득세 × 10%       (= 지급액의 0.3%, 지방세법 특별징수, 원단위 절사)
 *   · 합계 원천징수 = 소득세 + 지방소득세 (= 3.3%)
 *   · 실지급액    = 지급액 − 원천징수합계
 *
 * 사업소득은 소액부징수(§86) 대상이 아니므로 1천원 미만이라도 징수한다.
 *
 * ⚠ 실비변상(가이드가 대납한 입장권·주차비 등)은 용역대가가 아니므로 gross에
 *   합산하지 않는다 — 원천징수 대상이 아니다. 실비는 정산 단계에서 별도 줄로
 *   더해진다(`settlement.ts`의 payout = net + reimbursement).
 */

export interface Withholding {
  /** 지급액 (gross, 원). 음수/소수는 0 이상 정수로 정규화. */
  gross: number;
  /** 소득세 3% (원단위 절사) */
  incomeTax: number;
  /** 지방소득세 = 소득세 × 10% (원단위 절사) */
  localIncomeTax: number;
  /** 원천징수 합계 = 소득세 + 지방소득세 */
  totalWithheld: number;
  /** 실지급액 = 지급액 − 원천징수 합계 */
  net: number;
}

export const WITHHOLDING_INCOME_TAX_RATE = 0.03;
export const WITHHOLDING_LOCAL_TAX_RATE_OF_INCOME_TAX = 0.1;

/** Compute the 3.3% withholding breakdown for a single gross payment.
 *  Uses integer arithmetic (× 3 / 100, ÷ 10) so floating-point error never
 *  shifts the 원단위 절사 by a won. */
export function computeWithholding(grossInput: number): Withholding {
  const gross = Number.isFinite(grossInput) ? Math.max(0, Math.floor(grossInput)) : 0;
  // 소득세 = 지급액 × 3%, 원단위 미만 절사.
  const incomeTax = Math.floor((gross * 3) / 100);
  // 지방소득세 = 소득세 × 10% (= 지급액의 0.3%), 원단위 미만 절사.
  const localIncomeTax = Math.floor(incomeTax / 10);
  const totalWithheld = incomeTax + localIncomeTax;
  return { gross, incomeTax, localIncomeTax, totalWithheld, net: gross - totalWithheld };
}

export interface WithholdingTotals {
  count: number;
  gross: number;
  incomeTax: number;
  localIncomeTax: number;
  totalWithheld: number;
  net: number;
}

/** Sum a set of withholdings into the totals the 원천징수이행상황신고서 needs. */
export function sumWithholdings(rows: Withholding[]): WithholdingTotals {
  return rows.reduce<WithholdingTotals>(
    (acc, r) => ({
      count: acc.count + 1,
      gross: acc.gross + r.gross,
      incomeTax: acc.incomeTax + r.incomeTax,
      localIncomeTax: acc.localIncomeTax + r.localIncomeTax,
      totalWithheld: acc.totalWithheld + r.totalWithheld,
      net: acc.net + r.net,
    }),
    { count: 0, gross: 0, incomeTax: 0, localIncomeTax: 0, totalWithheld: 0, net: 0 },
  );
}
