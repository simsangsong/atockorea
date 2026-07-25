import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { SUGGESTION_SELECT_COLUMNS } from '@/lib/ops/autopilot/runner';

export const dynamic = 'force-dynamic';

/**
 * 제안 처리 (관제 W5).
 *
 *   PATCH /api/admin/tour-ops/autopilot/[id]  { status: 'done' | 'dismissed' | 'suggested' }
 *
 * '처리함'과 '무시'는 **사후 기록**이다 — 이 라우트도 배정·배차·발송을 하지 않는다.
 * suggested 로 되돌리는 것도 허용한다(잘못 눌렀을 수 있고, 되돌릴 수 없는 큐는
 * 사람이 누르기를 주저하게 만든다).
 */

const ALLOWED = new Set(['suggested', 'done', 'dismissed']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!ALLOWED.has(status)) {
      return NextResponse.json({ error: 'status는 done·dismissed·suggested 중 하나여야 합니다' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_autopilot_suggestions')
      .update({
        status,
        resolved_at: status === 'suggested' ? null : new Date().toISOString(),
        resolved_by: status === 'suggested' ? null : admin.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', OPS_TENANT_ID)
      .select(SUGGESTION_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[PATCH /api/admin/tour-ops/autopilot/[id]]', error);
      return NextResponse.json({ error: '제안을 수정하지 못했습니다', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: '제안을 찾을 수 없습니다' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/tour-ops/autopilot/[id]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
