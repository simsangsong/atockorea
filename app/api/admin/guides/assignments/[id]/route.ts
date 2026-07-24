import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import { ASSIGNMENT_SELECT_COLUMNS, buildAssignmentWrite } from '@/lib/ops/tax/assignments';

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
    const { data, error } = await supabase
      .from('ops_guide_assignments')
      .update(built.fields)
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[PATCH /api/admin/guides/assignments/:id]', error);
      return NextResponse.json({ error: '배정을 수정하지 못했습니다', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: '배정을 찾을 수 없습니다' }, { status: 404 });

    return NextResponse.json({ data });
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
