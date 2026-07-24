import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import { loadPeriodDetail } from '@/lib/ops/finance/periodDetail';
import { buildInvoiceDoc, buildStatementDoc } from '@/lib/ops/finance/documents';
import { isValidPeriod } from '@/lib/ops/finance/settlement';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ops-finance/periods/[period]
 *
 * 기간 상세 번들 — 화면(원장 명세·인보이스·송금·대사)과 인쇄 문서 2종이 같은
 * 입력을 쓰도록 한 곳에서 조립한다(설계 결정 3: 문서는 blob이 아니라 재렌더).
 * read-only. 상태를 바꾸지 않는다.
 */
export async function GET(
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
    const detail = await loadPeriodDetail(supabase, period);

    const statement = detail.period
      ? buildStatementDoc({
          period: detail.period,
          config: detail.config,
          ledgerRows: detail.ledgerRows,
          bookingMeta: detail.bookingMeta,
          invoice: detail.invoice,
          remittances: detail.remittances,
        })
      : null;

    const invoiceDoc =
      detail.period && detail.invoice
        ? buildInvoiceDoc({
            period: detail.period,
            config: detail.config,
            ledgerRows: detail.ledgerRows,
            bookingMeta: detail.bookingMeta,
            invoice: detail.invoice,
            remittances: detail.remittances,
          })
        : null;

    return NextResponse.json({
      ok: true,
      tableMissing: false,
      period: detail.period,
      invoice: detail.invoice,
      remittances: detail.remittances,
      ledgerRows: detail.ledgerRows,
      bookingMeta: detail.bookingMeta,
      reconcile: detail.reconcile,
      statement,
      invoiceDoc,
      // 법인 법적정보는 문서 렌더에 필요하지만 민감도가 낮은 회사 정보다(개인정보 아님).
      expertReviewed: detail.config.expertReviewed,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json({
        ok: true,
        tableMissing: true,
        period: null,
        invoice: null,
        remittances: [],
        ledgerRows: [],
        bookingMeta: [],
        reconcile: null,
        statement: null,
        invoiceDoc: null,
        expertReviewed: false,
      });
    }
    console.error('[ops-finance/periods/:period] GET error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
