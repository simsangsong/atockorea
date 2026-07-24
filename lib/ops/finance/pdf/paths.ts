// AtoC 통합 플랜 §6.3 — 정산 PDF의 스토리지 경로 (순수).
//
// 저장 정책은 ops_no_show_evidence와 같다: **PUBLIC 버킷 금지.** 정산서와
// 인터컴퍼니 인보이스에는 양사 법적정보·사업자등록번호·EIN·수취계좌·주문별
// 금액이 들어간다. private 버킷에 올리고 조회는 단기 서명 URL로만 한다.
// 그래서 DB에는 URL이 아니라 storage path가 저장된다.

export type FinanceDocKind = 'statement' | 'invoice'

/** private 버킷. 없으면 ensureFinanceDocsBucket이 public:false로 만든다. */
export const FINANCE_DOCS_BUCKET =
  process.env.SUPABASE_OPS_FINANCE_DOCS_BUCKET || 'ops-finance-docs'

/**
 * 서명 URL 기본 만료 — 10분 (증거팩과 동일한 근거: 열어놓고 오래 보는 화면이
 * 아니고, 유출되어도 창이 짧아야 한다. 더 필요하면 새로고침 = 재발급).
 */
export const FINANCE_DOC_SIGNED_URL_TTL_SEC = 600

/**
 * `finance/2026-08/statement-2026-08-<stamp>.pdf`
 *
 * 재생성해도 덮어쓰지 않고 새 객체가 쌓인다(stamp가 다르다) — 전문가 확인 전후,
 * 법인정보 입력 전후의 문서가 서로 다른 파일로 남아야 감사 추적이 성립한다.
 */
export function financeDocPath(input: {
  kind: FinanceDocKind
  period: string
  invoiceNo?: string | null
  stamp: string
}): string {
  const name =
    input.kind === 'invoice' && input.invoiceNo
      ? `invoice-${input.invoiceNo}`
      : `${input.kind}-${input.period}`
  return `finance/${input.period}/${name}-${input.stamp}.pdf`
}

/** ISO timestamp → `20260801T091500Z` (path-safe, sorts chronologically). */
export function pathStamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}
