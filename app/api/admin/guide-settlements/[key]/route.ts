import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  SETTLEMENT_SELECT_COLUMNS,
  SETTLEMENT_STATUSES,
  TAX_TENANT_ID,
  computeSettlementAmounts,
  normalizeSettlementRow,
  recordGuidePayoutLedger,
  type SettlementStatus,
} from '@/lib/ops/tax/settlement';

export const dynamic = 'force-dynamic';

/**
 * 정산 행 상태 전이 · 실비 입력 (§6.9).
 *
 *   PATCH /api/admin/guide-settlements/[id]  {status?, reimbursementKrw?, paidNote?}
 *
 * ⚠ 폴더 이름이 `[key]`인 이유: 형제 경로 `[key]/forms/[form]`은 같은 자리에
 *   'YYYY-MM'(기간)을 받는다. Next.js는 같은 레벨에 서로 다른 이름의 동적
 *   세그먼트를 허용하지 않으므로 이름 하나로 통일했다. 이 라우트가 받는 값은
 *   정산행 id이고, forms 라우트가 받는 값은 기간이다 — URL 모양은 명세 그대로다.
 *
 * 🔴 D10: 이 라우트는 **돈을 보내지 않는다**. status='paid'는 사람이 계좌이체를
 * 마친 뒤 "했다"고 남기는 사후 기록이고, 그래서 전이와 함께 금액을 절대 바꾸지
 * 않는다 — 지급 증빙의 숫자와 장부의 숫자가 어긋나는 순간 정산은 신뢰를 잃는다.
 *
 * 실비변상(reimbursement_krw)은 여기서만 들어온다. 배치는 이 값을 만들지 않는다
 * (tour_room_extras는 손님→가이드 현금 rail이라 회사 실비로 전용할 수 없다).
 * paid 이후에는 실비도 잠긴다.
 */

const STATUS_RANK: Record<SettlementStatus, number> = { draft: 0, confirmed: 1, paid: 2 };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAdmin(req);
    const { key: id } = await params;
    if (!id) return NextResponse.json({ ok: false, message: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });

    const nextStatus = typeof body.status === 'string' ? body.status.trim() : undefined;
    if (nextStatus !== undefined && !(SETTLEMENT_STATUSES as readonly string[]).includes(nextStatus)) {
      return NextResponse.json(
        { ok: false, message: '상태는 draft · confirmed · paid 중 하나여야 합니다.' },
        { status: 400 },
      );
    }

    const hasReimbursement = body.reimbursementKrw !== undefined || body.reimbursement_krw !== undefined;
    const rawReimbursement = body.reimbursementKrw ?? body.reimbursement_krw;
    let reimbursement: number | undefined;
    if (hasReimbursement) {
      const n =
        typeof rawReimbursement === 'string'
          ? Number(rawReimbursement.replace(/[, ]/g, ''))
          : Number(rawReimbursement);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return NextResponse.json(
          { ok: false, message: '실비변상은 0 이상의 정수(원)여야 합니다.' },
          { status: 400 },
        );
      }
      reimbursement = n;
    }

    if (nextStatus === undefined && reimbursement === undefined && body.paidNote === undefined) {
      return NextResponse.json({ ok: false, message: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: currentRaw, error: readError } = await supabase
      .from('ops_guide_settlements')
      .select(SETTLEMENT_SELECT_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', TAX_TENANT_ID)
      .maybeSingle();
    if (readError) {
      console.error('[PATCH /api/admin/guide-settlements/:id]', readError);
      return NextResponse.json({ ok: false, message: readError.message }, { status: 500 });
    }
    if (!currentRaw) return NextResponse.json({ ok: false, message: '정산 행을 찾을 수 없습니다.' }, { status: 404 });

    const current = normalizeSettlementRow(currentRaw as Record<string, unknown>);
    const currentStatus = (current.status as SettlementStatus) ?? 'draft';

    // 지급 완료 행은 금액이 잠긴다. 되돌리기는 사람이 DB에서 판단할 일이다.
    if (currentStatus === 'paid' && (reimbursement !== undefined || nextStatus === 'draft' || nextStatus === 'confirmed')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'settlement_paid',
          message: '이미 지급 완료로 기록된 정산입니다. 금액·상태를 되돌리려면 근거를 남기고 DB에서 처리하세요.',
        },
        { status: 409 },
      );
    }

    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (reimbursement !== undefined) {
      // 세액은 재계산하지 않는다 — 실비는 원천징수 대상이 아니므로 gross·세액이
      // 그대로여야 하고, payout만 움직인다.
      const amounts = computeSettlementAmounts(current.gross_krw, reimbursement);
      fields.reimbursement_krw = amounts.reimbursementKrw;
      fields.payout_krw = amounts.payoutKrw;
    }

    if (nextStatus !== undefined && nextStatus !== currentStatus) {
      if (STATUS_RANK[nextStatus as SettlementStatus] < STATUS_RANK[currentStatus]) {
        return NextResponse.json(
          { ok: false, message: '정산 상태는 뒤로 되돌릴 수 없습니다.' },
          { status: 400 },
        );
      }
      fields.status = nextStatus;
      if (nextStatus === 'paid') {
        fields.paid_at = new Date().toISOString();
        if (typeof body.paidNote === 'string') fields.paid_note = body.paidNote.trim() || null;
      }
    } else if (typeof body.paidNote === 'string') {
      fields.paid_note = body.paidNote.trim() || null;
    }

    const { data, error } = await supabase
      .from('ops_guide_settlements')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', TAX_TENANT_ID)
      .select(SETTLEMENT_SELECT_COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('[PATCH /api/admin/guide-settlements/:id]', error);
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ ok: false, message: '정산 행을 찾을 수 없습니다.' }, { status: 404 });

    const row = normalizeSettlementRow(data as Record<string, unknown>);
    // 실비가 바뀌면 회사 비용도 바뀐다 — 원장을 같은 트랜잭션처럼 맞춰둔다.
    if (reimbursement !== undefined) await recordGuidePayoutLedger(supabase, row);

    return NextResponse.json({
      ok: true,
      data: row,
      message:
        row.status === 'paid'
          ? '지급 완료로 기록했습니다. (시스템이 이체한 것이 아니라, 사람이 지급했다는 기록입니다.)'
          : '저장했습니다.',
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/guide-settlements/:id]', msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
