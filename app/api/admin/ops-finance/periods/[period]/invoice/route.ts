import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { getFinanceConfig } from '@/lib/ops/finance/config';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import { fetchPeriod, issueInvoice, isValidPeriod } from '@/lib/ops/finance/settlement';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ops-finance/periods/[period]/invoice
 *
 * 인터컴퍼니 인보이스 발행 (§6.4). 한국법인(용역 제공) → 미국 LLC(용역 수취).
 * 기간당 1장 — 두 번 눌러도 같은 invoice_no가 돌아온다(멱등, UNIQUE(period_id)).
 * 금액 = 정산서 송금분(period.remit_minor)이라야 3자 대사가 성립한다.
 *
 * 🔴 발행 = DB에 문서 행을 만드는 것까지다. 어디로도 보내지 않는다(D10/D11).
 *    고객 인보이스는 존재하지 않는다 — 고객은 Stripe 영수증으로 갈음.
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

    const body = (await req.json().catch(() => ({}))) as { notes?: string };
    const supabase = createServerClient();

    const periodRow = await fetchPeriod(supabase, period);
    if (!periodRow) {
      return NextResponse.json(
        { ok: false, message: '먼저 이 기간을 마감하세요.' },
        { status: 400 },
      );
    }
    if (periodRow.status === 'open') {
      return NextResponse.json(
        { ok: false, message: '마감되지 않은 기간에는 인보이스를 발행할 수 없습니다.' },
        { status: 400 },
      );
    }

    const config = await getFinanceConfig(supabase);
    const result = await issueInvoice(supabase, periodRow, {
      prefix: config.intercompanyPrefix,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    });

    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      existed: result.existed,
      message: result.existed
        ? `이미 발행된 인보이스입니다 (${result.invoice.invoice_no}).`
        : `인보이스를 발행했습니다 (${result.invoice.invoice_no}).`,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && e.message === 'period_not_closed') {
      return NextResponse.json(
        { ok: false, message: '마감되지 않은 기간에는 인보이스를 발행할 수 없습니다.' },
        { status: 400 },
      );
    }
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json(
        { ok: false, tableMissing: true, message: '정산 테이블이 아직 적용되지 않았습니다.' },
        { status: 503 },
      );
    }
    console.error('[ops-finance/periods/:period/invoice] POST error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
