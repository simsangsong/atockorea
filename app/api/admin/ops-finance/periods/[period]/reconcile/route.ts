import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import {
  fetchInvoice,
  fetchPeriod,
  isValidPeriod,
  listRemittances,
  markReconciled,
  reconcile,
} from '@/lib/ops/finance/settlement';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ops-finance/periods/[period]/reconcile
 *
 * 3자 대사 (§6.4) — 마감의 하드 게이트(설계 결정 6).
 *   ① 정산서 송금분 (period.remit_minor)
 *   ② 인터컴퍼니 인보이스 금액 (invoice.amount_minor)
 *   ③ 실제 송금합 (Σ remittances.amount_usd_minor)
 * 셋이 정확히 같을 때만 status='reconciled'로 전진한다. 허용오차 0 —
 * 전부 정수 minor units라 반올림 오차가 원리적으로 없고, 은행 수수료로 실입금이
 * 줄었다면 그건 '오차'가 아니라 사람이 설명해야 할 사실이다.
 *
 * 불일치는 400 + 차액 상세로 거부하고 status를 건드리지 않는다.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ period: string }> },
) {
  try {
    await requireAdmin(req);
    const { period } = await ctx.params;
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'invalid_period' }, { status: 400 });
    }

    const supabase = createServerClient();
    const periodRow = await fetchPeriod(supabase, period);
    if (!periodRow) {
      return NextResponse.json(
        { ok: false, message: '먼저 이 기간을 마감하세요.' },
        { status: 400 },
      );
    }

    const invoice = await fetchInvoice(supabase, periodRow.id);
    const remittances = await listRemittances(supabase, periodRow.id);

    const result = reconcile(
      { remitMinor: periodRow.remit_minor },
      invoice ? { amountMinor: invoice.amount_minor } : null,
      remittances.map((r) => ({ amountUsdMinor: r.amount_usd_minor })),
    );

    if (!result.ok) {
      // 상태 전이 거부. 화면이 차액을 그대로 보여줄 수 있게 전부 실어 보낸다.
      return NextResponse.json(
        {
          ok: false,
          reconcile: result,
          expected: {
            periodRemitMinor: periodRow.remit_minor,
            invoiceAmountMinor: invoice?.amount_minor ?? null,
            remittedMinor: result.remittedMinor,
          },
          message: result.message,
        },
        { status: 400 },
      );
    }

    await markReconciled(supabase, periodRow.id);
    const updated = await fetchPeriod(supabase, period);

    return NextResponse.json({
      ok: true,
      reconcile: result,
      period: updated ?? periodRow,
      message: result.message,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json(
        { ok: false, tableMissing: true, message: '정산 테이블이 아직 적용되지 않았습니다.' },
        { status: 503 },
      );
    }
    console.error('[ops-finance/reconcile] POST error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
