// AtoC 통합 F-슬라이스 — 파이낸스 설정 리더 (plan §6.3 ops_finance_config).
//
// ops_finance_config는 단일행(id=1). margin_rate = LLC 커미션율(D6, 기본 5%).
// 설정행이 없거나 조회 실패해도 캡처 원장 기입이 막히면 안 되므로 안전 기본값
// DEFAULT_MARGIN_RATE로 폴백한다(파이낸스 하드코딩 드리프트 방지: 이 한 곳만 기본).

import type { SupabaseClient } from '@supabase/supabase-js'

export const FINANCE_TENANT_ID = 'atockorea'

/** D6 — 마이그레이션 시드값과 반드시 일치(20260724090000_ops_finance_config.sql). */
export const DEFAULT_MARGIN_RATE = 0.05

export interface FinanceConfig {
  marginRate: number
  llcLegalName: string | null
  llcAddress: string | null
  llcEin: string | null
  krLegalName: string | null
  krAddress: string | null
  krBizRegNo: string | null
  intercompanyPrefix: string
  intercompanySeq: number
  /**
   * 미국 CPA·한국 세무사 확인 완료 플래그 (Phase 3 설계 결정 4).
   * false면 생성 문서 전부에 DRAFT 워터마크. 컬럼이 아직 없거나 조회 실패해도
   * false로 떨어져야 한다 — 모르면 DRAFT가 안전한 기본값이다.
   */
  expertReviewed: boolean
}

/** 마진율만 필요할 때의 경량 조회 — 실패 시 DEFAULT_MARGIN_RATE. */
export async function getFinanceMarginRate(supabase: SupabaseClient): Promise<number> {
  try {
    const { data } = await supabase
      .from('ops_finance_config')
      .select('margin_rate')
      .eq('id', 1)
      .maybeSingle()
    const rate = (data as { margin_rate?: number | string } | null)?.margin_rate
    const n = typeof rate === 'string' ? Number(rate) : rate
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1) return n
  } catch {
    /* fall through to default */
  }
  return DEFAULT_MARGIN_RATE
}

/** 전체 설정 조회(인터컴퍼니 인보이스 등 Phase 3에서 사용). 부재 시 기본 형태. */
export async function getFinanceConfig(supabase: SupabaseClient): Promise<FinanceConfig> {
  const fallback: FinanceConfig = {
    marginRate: DEFAULT_MARGIN_RATE,
    llcLegalName: null,
    llcAddress: null,
    llcEin: null,
    krLegalName: null,
    krAddress: null,
    krBizRegNo: null,
    intercompanyPrefix: 'AK-IC',
    intercompanySeq: 0,
    expertReviewed: false,
  }
  try {
    // '*' 선택 — expert_reviewed는 Phase 3 마이그레이션에서 추가되는 컬럼이라
    // 명시 나열하면 적용 전 환경에서 조회 전체가 실패해 설정이 통째로 날아간다.
    const { data } = await supabase
      .from('ops_finance_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (!data) return fallback
    const row = data as Record<string, unknown>
    const rate = typeof row.margin_rate === 'string' ? Number(row.margin_rate) : (row.margin_rate as number)
    return {
      marginRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : DEFAULT_MARGIN_RATE,
      llcLegalName: (row.llc_legal_name as string) ?? null,
      llcAddress: (row.llc_address as string) ?? null,
      llcEin: (row.llc_ein as string) ?? null,
      krLegalName: (row.kr_legal_name as string) ?? null,
      krAddress: (row.kr_address as string) ?? null,
      krBizRegNo: (row.kr_biz_reg_no as string) ?? null,
      intercompanyPrefix: (row.intercompany_prefix as string) ?? 'AK-IC',
      intercompanySeq: typeof row.intercompany_seq === 'number' ? row.intercompany_seq : 0,
      // 명시적 true일 때만 DRAFT 해제 (컬럼 부재/null → false).
      expertReviewed: row.expert_reviewed === true,
    }
  } catch {
    return fallback
  }
}
