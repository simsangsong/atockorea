import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import { isValidPeriod } from '@/lib/ops/tax/assignments';
import { listSettlements, runGuideSettlement, type GuideSettlementRow } from '@/lib/ops/tax/settlement';

export const dynamic = 'force-dynamic';

/**
 * 가이드 월 정산 (§6.9).
 *
 *   GET  /api/admin/guide-settlements?period=YYYY-MM  → 그 달의 정산 목록
 *   POST /api/admin/guide-settlements {period}        → 월 배치 실행(멱등)
 *
 * 배치는 status='worked' 배정만 집계하고, 같은 달을 몇 번 돌려도 가이드당 1행이다
 * (UNIQUE(tenant_id, guide_id, period)). status='paid'인 행은 금액을 다시 쓰지
 * 않고 locked로 보고한다.
 *
 * 🔴 D10: 여기서 이체·신고·발송하는 것은 하나도 없다. 'paid'는 사람이 지급을
 * 마친 뒤 남기는 사후 기록이다.
 *
 * 응답에는 가이드 이름만 붙는다 — 주민번호·계좌는 조회조차 하지 않는다. 평문이
 * 필요한 것은 서식 생성뿐이고, 그건 forms 라우트가 감사로그를 남기며 한다.
 */

/** 목록 응답에 실을 수 있는 가이드 필드의 전부. PII는 여기 없다. */
async function attachGuideNames(
  supabase: ReturnType<typeof createServerClient>,
  rows: GuideSettlementRow[],
) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, guide_name: null as string | null }));
  const { data } = await supabase
    .from('ops_guides')
    .select('id, name')
    .in('id', [...new Set(rows.map((r) => r.guide_id))]);
  const names = new Map(
    ((data ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]),
  );
  return rows.map((r) => ({ ...r, guide_name: names.get(r.guide_id) ?? null }));
}

function summarize(rows: GuideSettlementRow[]) {
  return rows.reduce(
    (acc, r) => ({
      guideCount: acc.guideCount + 1,
      grossKrw: acc.grossKrw + r.gross_krw,
      incomeTaxKrw: acc.incomeTaxKrw + r.income_tax_krw,
      localTaxKrw: acc.localTaxKrw + r.local_tax_krw,
      withheldKrw: acc.withheldKrw + r.withheld_krw,
      netKrw: acc.netKrw + r.net_krw,
      reimbursementKrw: acc.reimbursementKrw + r.reimbursement_krw,
      payoutKrw: acc.payoutKrw + r.payout_krw,
      assignmentCount: acc.assignmentCount + r.assignment_count,
      unpaidKrw: acc.unpaidKrw + (r.status === 'paid' ? 0 : r.payout_krw),
    }),
    {
      guideCount: 0,
      grossKrw: 0,
      incomeTaxKrw: 0,
      localTaxKrw: 0,
      withheldKrw: 0,
      netKrw: 0,
      reimbursementKrw: 0,
      payoutKrw: 0,
      assignmentCount: 0,
      unpaidKrw: 0,
    },
  );
}

function tableMissingResponse(period: string) {
  return NextResponse.json({ ok: true, tableMissing: true, period, data: [], summary: summarize([]) });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const period = req.nextUrl.searchParams.get('period') ?? '';
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'period는 YYYY-MM 형식이어야 합니다.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const rows = await listSettlements(supabase, period);
    return NextResponse.json({
      ok: true,
      tableMissing: false,
      period,
      data: await attachGuideNames(supabase, rows),
      summary: summarize(rows),
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return tableMissingResponse(req.nextUrl.searchParams.get('period') ?? '');
    }
    console.error('[GET /api/admin/guide-settlements]', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as { period?: string };
    const period = typeof body.period === 'string' ? body.period.trim() : '';
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'period는 YYYY-MM 형식이어야 합니다.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const result = await runGuideSettlement(supabase, period);
    const rows = await listSettlements(supabase, period);

    const messages: string[] = [];
    if (result.created > 0) messages.push(`${result.created}명 신규 정산`);
    if (result.updated > 0) messages.push(`${result.updated}명 재집계`);
    if (result.locked.length > 0) messages.push(`${result.locked.length}명은 지급 완료라 금액을 유지`);
    if (result.unresolved.length > 0) messages.push(`단가 미해석 배정 ${result.unresolved.length}건`);

    return NextResponse.json({
      ok: true,
      period,
      data: await attachGuideNames(supabase, rows),
      summary: summarize(rows),
      created: result.created,
      updated: result.updated,
      locked: result.locked.map((r) => r.guide_id),
      // 단가를 못 찾아 0원으로 들어간 배정 — 사람이 단가표를 고쳐야 한다.
      unresolved: result.unresolved,
      ledgerErrors: result.ledgerErrors,
      assignmentCount: result.assignmentCount,
      message: messages.length > 0 ? messages.join(' · ') : '정산 대상 배정이 없습니다.',
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json(
        { ok: false, tableMissing: true, message: '정산 테이블이 아직 적용되지 않았습니다.' },
        { status: 503 },
      );
    }
    console.error('[POST /api/admin/guide-settlements]', e);
    const message = e instanceof Error ? e.message : 'internal_error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
