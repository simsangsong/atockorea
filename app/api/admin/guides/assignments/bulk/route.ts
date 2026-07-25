import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { ASSIGNMENT_STATUSES, type AssignmentStatus } from '@/lib/ops/tax/assignments';
import { blockCodeFromDbError, blockMessage } from '@/lib/ops/guides/conflicts';

export const dynamic = 'force-dynamic';

/** 한 번에 처리하는 배정 수 상한. 화면이 한 달치를 다 보여줘도 넉넉하다. */
export const BULK_LIMIT = 500;

/**
 * 배정 상태 일괄 변경 (관제 W7).
 *
 *   PATCH /api/admin/guides/assignments/bulk   { ids: string[], status }
 *
 * 왜 필요한가: **정산 대상이 되는 유일한 전이가 planned → worked인데 한 건씩만
 * 누를 수 있었다.** 월말에 수십 번을 누르게 되면 사람은 결국 누르지 않고, 정산은
 * "일한 사람이 목록에 없다"로 끝난다. 정산이 비어 있는 가장 흔한 원인이 이것이다.
 *
 * 🔴 **기간이 아니라 id 목록을 받는다.** "이 달 전부 worked" 같은 서버측 일괄
 * 조건을 허용하면 화면에 보이지 않던 행까지 돈이 된다. 사람이 화면에서 본 것만
 * 바뀌어야 한다.
 *
 * 결과는 **건별로** 보고한다. 충돌 트리거가 일부를 거부할 수 있고(휴무일에
 * 사유 없이 만들어진 오래된 행 등), "12건 중 10건 성공"을 "성공"으로 뭉뚱그리면
 * 나머지 2명이 조용히 정산에서 빠진다.
 */

interface Outcome {
  id: string;
  ok: boolean;
  reason?: string;
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const rawIds = Array.isArray(body.ids) ? body.ids : null;
    if (!rawIds || rawIds.length === 0) {
      return NextResponse.json({ error: '변경할 배정을 선택해 주세요.', code: 'ids_required' }, { status: 400 });
    }
    const ids = [...new Set(rawIds.filter((v): v is string => typeof v === 'string' && v.length > 0))];
    if (ids.length === 0) {
      return NextResponse.json({ error: '변경할 배정을 선택해 주세요.', code: 'ids_required' }, { status: 400 });
    }
    if (ids.length > BULK_LIMIT) {
      // 잘라내고 성공했다고 하면 나머지가 조용히 빠진다.
      return NextResponse.json(
        { error: `한 번에 ${BULK_LIMIT}건까지만 바꿀 수 있어요. 나눠서 진행해 주세요.`, code: 'too_many' },
        { status: 400 },
      );
    }

    const status = typeof body.status === 'string' ? body.status : '';
    if (!(ASSIGNMENT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: '상태는 예정·완료·취소 중 하나여야 해요.', code: 'status_invalid' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const nowIso = new Date().toISOString();
    const outcomes: Outcome[] = [];

    // 건별 UPDATE인 이유: 한 번의 `.in()` UPDATE는 트리거가 한 행만 거부해도
    // 전부 실패하고, 어느 행이 문제였는지 알려주지 않는다.
    for (const id of ids) {
      const { data, error } = await supabase
        .from('ops_guide_assignments')
        .update({ status: status as AssignmentStatus, updated_at: nowIso })
        .eq('id', id)
        .eq('tenant_id', OPS_TENANT_ID)
        .select('id')
        .maybeSingle();

      if (error) {
        const code = blockCodeFromDbError(error.message);
        outcomes.push({ id, ok: false, reason: code ? blockMessage(code) : error.message });
        continue;
      }
      if (!data) {
        outcomes.push({ id, ok: false, reason: '배정을 찾을 수 없어요.' });
        continue;
      }
      outcomes.push({ id, ok: true });
    }

    const changed = outcomes.filter((o) => o.ok).length;
    const failed = outcomes.filter((o) => !o.ok);

    return NextResponse.json({
      requested: ids.length,
      changed,
      failedCount: failed.length,
      failed,
      status,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/guides/assignments/bulk]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
