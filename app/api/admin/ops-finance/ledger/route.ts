import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { DEFAULT_MARGIN_RATE, getFinanceMarginRate } from '@/lib/ops/finance/config';
import {
  computeLedgerTotals,
  emptyLedgerTotals,
  isMissingTableError,
  normalizeLedgerPeriod,
} from '@/lib/ops/finance/ledger-view';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ops-finance/ledger?period=YYYY-MM&entity=us|kr|all
 *
 * F-슬라이스 초기 조회 화면(plan §6.8). ops_entity_ledger의 캡처 원장 행을
 * 월(period)·법인(entity)으로 필터해 돌려주고, 해당 월의 합계(gross / 커미션 5% /
 * 송금분 95%)를 함께 계산한다. read-only, requireAdmin.
 *
 * 테이블 미적용(코디네이터가 아직 마이그레이션을 적용하지 않은 상태)이어도 500이
 * 아니라 rows:[] + tableMissing:true로 graceful 응답한다 — 화면이 "원장 테이블
 * 미적용" 안내를 띄우도록.
 */

interface LedgerRow {
  id: string;
  entity: string;
  booking_id: string | null;
  period: string | null;
  type: string;
  amount_minor: number;
  currency: string;
  source: string | null;
  external_ref: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { searchParams } = new URL(req.url);
    const period = normalizeLedgerPeriod(searchParams.get('period'));
    const entity = searchParams.get('entity'); // 'us' | 'kr' | null(=전체)

    let query = supabase
      .from('ops_entity_ledger')
      .select('id, entity, booking_id, period, type, amount_minor, currency, source, external_ref, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (period) query = query.eq('period', period);
    if (entity === 'us' || entity === 'kr') query = query.eq('entity', entity);

    const { data, error } = await query;

    if (error) {
      // 테이블 미적용 → graceful. 그 외 오류는 502로 알린다(마진율은 참고로 반환).
      if (isMissingTableError(error.code)) {
        return NextResponse.json({
          ok: true,
          tableMissing: true,
          rows: [],
          totals: emptyLedgerTotals(),
          marginRate: DEFAULT_MARGIN_RATE,
        });
      }
      console.error('[ops-finance/ledger] query failed:', error);
      return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
    }

    const rows = (data ?? []) as LedgerRow[];
    const marginRate = await getFinanceMarginRate(supabase);

    return NextResponse.json({
      ok: true,
      tableMissing: false,
      rows,
      totals: computeLedgerTotals(rows),
      marginRate,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error('[ops-finance/ledger] error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
