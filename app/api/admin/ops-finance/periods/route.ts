import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { getFinanceMarginRate } from '@/lib/ops/finance/config';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import { closePeriod, isValidPeriod, listPeriods } from '@/lib/ops/finance/settlement';

export const dynamic = 'force-dynamic';

/**
 * 월 정산 기간 (plan Phase 3 §6.1 F-2).
 *
 *   GET  /api/admin/ops-finance/periods            → 마감된 기간 목록 + 상태
 *   POST /api/admin/ops-finance/periods {period}   → 해당 월 마감(멱등)
 *
 * 마감 = ops_entity_ledger(us) 집계 스냅샷 + 마감 시점 margin_rate 각인.
 * 같은 달을 두 번 마감해도 UNIQUE(tenant_id, period)가 행을 1개로 묶는다.
 * 이미 인보이스가 나간 기간은 금액을 다시 쓰지 않고 locked:true로 알린다 —
 * 발행된 인보이스가 참조하는 숫자가 소리 없이 바뀌면 안 되기 때문.
 *
 * 🔴 대외 액션 없음(D10): 여기서 신고·제출·발송하는 것은 하나도 없다.
 */

function tableMissingResponse() {
  return NextResponse.json({
    ok: true,
    tableMissing: true,
    periods: [],
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const periods = await listPeriods(supabase);
    return NextResponse.json({ ok: true, tableMissing: false, periods });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) return tableMissingResponse();
    console.error('[ops-finance/periods] GET error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as { period?: string };
    const period = typeof body.period === 'string' ? body.period.trim() : '';

    if (!isValidPeriod(period)) {
      return NextResponse.json(
        { ok: false, message: 'period는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    // 5% 하드코딩 금지 — 값의 출처는 언제나 설정. 마감 시점 값이 period 행에 각인된다.
    const marginRate = await getFinanceMarginRate(supabase);
    const result = await closePeriod(supabase, period, { marginRate });

    return NextResponse.json({
      ok: true,
      period: result.period,
      aggregate: result.aggregate,
      created: result.created,
      locked: result.locked,
      message: result.locked
        ? '이미 인보이스가 발행된 기간이라 금액을 갱신하지 않았습니다.'
        : result.created
          ? '마감했습니다.'
          : '이미 마감된 기간을 재집계했습니다.',
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json(
        { ok: false, tableMissing: true, message: '정산 테이블이 아직 적용되지 않았습니다.' },
        { status: 503 },
      );
    }
    console.error('[ops-finance/periods] POST error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
