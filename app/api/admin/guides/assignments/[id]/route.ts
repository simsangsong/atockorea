import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import {
  ASSIGNMENT_SELECT_COLUMNS,
  buildAssignmentWrite,
  type AssignmentRow,
} from '@/lib/ops/tax/assignments';
import { blockCodeFromDbError, blockMessage, detectAssignmentConflicts } from '@/lib/ops/guides/conflicts';
import { loadConflictContext, normalizeTime } from '@/lib/ops/guides/conflictContext';

export const dynamic = 'force-dynamic';

/**
 * 배정 수정·삭제 (§6.9).
 *
 *   PATCH  /api/admin/guides/assignments/[id]   {status:'worked'|…, amountKrw, …}
 *   DELETE /api/admin/guides/assignments/[id]
 *
 * PATCH의 주 용도는 **[일했음] 표시**다 — 정산 대상이 되는 유일한 전이이므로
 * 사람이 명시적으로 눌러야 한다.
 *
 * DELETE는 진짜 삭제다(오타로 잘못 만든 배정용). 이미 정산된 달의 배정을 지워도
 * 정산행은 남는다 — 다시 정산하면 금액이 0으로 줄지만, status='paid'인 정산은
 * 잠겨 있어 바뀌지 않는다. 실수로 지운 근거를 되살릴 수 없으므로 취소는
 * status='cancelled'가 정석이고 화면도 그쪽을 기본으로 제공한다.
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildAssignmentWrite(body, 'update');
    if (!built.ok) {
      return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });
    }

    const supabase = createServerClient();

    // 수정은 부분 패치라 판정하려면 "고친 뒤의 모습"이 필요하다 — 현재 행을 읽어
    // 패치를 얹은 값으로 본다. 이걸 생략하면 날짜만 바꾼 수정이 휴무일·겹침
    // 검사를 통과해 버린다(패치에 guide_id가 없으니 판정할 대상이 없어서).
    const { data: current, error: readError } = await supabase
      .from('ops_guide_assignments')
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .maybeSingle();
    if (readError) {
      console.error('[PATCH /api/admin/guides/assignments/:id] read', readError);
      return NextResponse.json({ error: '배정을 불러오지 못했습니다', details: readError.message }, { status: 500 });
    }
    if (!current) return NextResponse.json({ error: '배정을 찾을 수 없습니다' }, { status: 404 });

    const row = current as unknown as AssignmentRow;
    const override =
      body.conflictOverride === true || body.conflict_override === true || row.conflict_override === true;
    const rawReason =
      typeof body.conflictOverrideReason === 'string'
        ? body.conflictOverrideReason
        : typeof body.conflict_override_reason === 'string'
          ? (body.conflict_override_reason as string)
          : null;
    const overrideReason = (rawReason ?? row.conflict_override_reason ?? '').trim();
    if (override && !overrideReason) {
      return NextResponse.json(
        { error: '충돌을 무시하고 배정하려면 사유를 적어 주세요.', code: 'override_reason_required' },
        { status: 400 },
      );
    }

    const merged = {
      id,
      guideId: row.guide_id,
      tourDate: (built.fields.tour_date as string) ?? row.tour_date,
      tourType: (built.fields.tour_type as string) ?? row.tour_type,
      bookingId: ('booking_id' in built.fields ? (built.fields.booking_id as string | null) : row.booking_id) ?? null,
      startTime: normalizeTime(body.startTime ?? body.start_time) ?? row.start_time ?? null,
      endTime: normalizeTime(body.endTime ?? body.end_time) ?? row.end_time ?? null,
      status: (built.fields.status as string) ?? row.status,
      conflictOverride: override,
    };

    const pinnedAmount = ('amount_krw' in built.fields
      ? (built.fields.amount_krw as number | null)
      : row.amount_krw) ?? null;
    const { context, resolvedTimes } = await loadConflictContext(supabase, merged, { amountKrw: pinnedAmount });
    const verdict = detectAssignmentConflicts({ ...merged, ...resolvedTimes }, context);

    if (req.nextUrl.searchParams.get('dryRun') === '1') {
      return NextResponse.json({ dryRun: true, ...verdict, resolvedTimes });
    }
    if (verdict.blocked.length > 0) {
      return NextResponse.json({ error: verdict.blocked[0].message, ...verdict }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('ops_guide_assignments')
      .update({
        ...built.fields,
        start_time: resolvedTimes.startTime,
        end_time: resolvedTimes.endTime,
        conflict_override: override,
        conflict_override_reason: override ? overrideReason : null,
      })
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      const code = blockCodeFromDbError(error.message);
      if (code) {
        return NextResponse.json(
          {
            error: blockMessage(code),
            blocked: [
              {
                code,
                message: blockMessage(code),
                overridable: code !== 'guide_inactive' && code !== 'duplicate_slot',
              },
            ],
            warnings: verdict.warnings,
            source: 'db',
          },
          { status: 409 },
        );
      }
      console.error('[PATCH /api/admin/guides/assignments/:id]', error);
      return NextResponse.json({ error: '배정을 수정하지 못했습니다', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: '배정을 찾을 수 없습니다' }, { status: 404 });

    return NextResponse.json({ data, warnings: verdict.warnings });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/guides/assignments/:id]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = createServerClient();
    const { error } = await supabase
      .from('ops_guide_assignments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID);
    if (error) {
      console.error('[DELETE /api/admin/guides/assignments/:id]', error);
      return NextResponse.json({ error: '배정을 삭제하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/guides/assignments/:id]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
