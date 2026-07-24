import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { FINANCE_TENANT_ID } from '@/lib/ops/finance/config';
import { isMissingTableError } from '@/lib/ops/finance/ledger-view';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ops-finance/filings — 신고기한 목록 (§6.7).
 *
 * 🔴 조회 전용이다(D10). 이 슬라이스는 알림을 발송하지 않고, 어떤 신고도 제출하지
 *    않는다. status='filed'는 사람이 신고를 마친 뒤 남기는 사후 기록이다.
 *    시드된 due_date는 표준 법정기한 "초안"이며 CPA·세무사 확인 전이다.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('ops_filing_calendar')
      .select('id, entity, filing_key, title, due_date, period, status, docs_url, note')
      .eq('tenant_id', FINANCE_TENANT_ID)
      .order('due_date', { ascending: true })
      .limit(200);

    if (error) {
      if (isMissingTableError(error.code)) {
        return NextResponse.json({ ok: true, tableMissing: true, filings: [] });
      }
      console.error('[ops-finance/filings] query failed:', error);
      return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, tableMissing: false, filings: data ?? [] });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error('[ops-finance/filings] error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
