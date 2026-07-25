import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { buildXlsx, xlsxDownloadHeaders } from '@/lib/ops/export/xlsx';
import { aoaToCsv, UTF8_BOM } from '@/lib/ops/tax/forms';
import { isValidPeriod } from '@/lib/ops/tax/assignments';
import { listSettlements, type GuideSettlementRow } from '@/lib/ops/tax/settlement';
import { settlementSheets } from '@/lib/ops/tax/settlementExport';

export const dynamic = 'force-dynamic';

/**
 * 가이드 월 정산 내보내기 (W6).
 *
 * GET /api/admin/guide-settlements/export?period=YYYY-MM&format=xlsx|csv
 *
 * 서식(세무서 제출용)과 달리 이쪽은 **회사 안에서 쓰는 지급 명세**다. 그래서
 * 주민번호를 싣지 않는다 — 이체할 때 필요한 건 계좌 마스크와 실지급액이지
 * 주민번호가 아니고, 필요 없는 평문은 만들지 않는 것이 가장 싼 보안이다.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const period = sp.get('period') ?? '';
    const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'period는 YYYY-MM 형식이어야 합니다.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const rows = await listSettlements(supabase, period);

    // 이름·은행 마스크만. `*_enc`는 조회조차 하지 않는다.
    const guideIds = [...new Set(rows.map((r) => r.guide_id))];
    const { data: guides } = guideIds.length
      ? await supabase
          .from('ops_guides')
          .select('id, name, bank_name, bank_holder, bank_account_masked')
          .in('id', guideIds)
      : { data: [] as Array<Record<string, unknown>> };
    const guideById = new Map(
      ((guides ?? []) as Array<Record<string, unknown>>).map((g) => [
        String(g.id),
        {
          name: String(g.name ?? ''),
          bankName: (g.bank_name as string) ?? null,
          bankHolder: (g.bank_holder as string) ?? null,
          bankAccountMasked: (g.bank_account_masked as string) ?? null,
        },
      ]),
    );

    const sheets = settlementSheets(period, rows as GuideSettlementRow[], guideById);

    if (format === 'csv') {
      const body = UTF8_BOM + aoaToCsv(sheets[0].rows);
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="atockorea-guide-settlement-${period}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const file = buildXlsx(sheets);
    return new NextResponse(new Uint8Array(file), {
      headers: xlsxDownloadHeaders(`atockorea-guide-settlement-${period}.xlsx`),
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guide-settlements/export]', msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
