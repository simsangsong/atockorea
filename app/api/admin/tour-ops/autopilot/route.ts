import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { kstToday } from '@/lib/ops/guides/availability';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { DEFAULT_HORIZON_DAYS, SUGGESTION_SELECT_COLUMNS, runAutopilot } from '@/lib/ops/autopilot/runner';

export const dynamic = 'force-dynamic';

/**
 * 오토파일럿 제안 큐 (관제 W5).
 *
 *   GET  /api/admin/tour-ops/autopilot?status=suggested|all
 *   POST /api/admin/tour-ops/autopilot     — "지금 점검" (탐지 → 큐 upsert)
 *
 * 🔴 **POST는 점검이지 실행이 아니다.** 배정·배차·발송은 하나도 하지 않는다.
 * 만들어지는 것은 제안 행뿐이고, 실행은 사람이 화면에서 한다(설계안 §1-7).
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const status = req.nextUrl.searchParams.get('status') ?? 'suggested';

    let query = supabase
      .from('ops_autopilot_suggestions')
      .select(SUGGESTION_SELECT_COLUMNS)
      .eq('tenant_id', OPS_TENANT_ID)
      // 임박순. tour_date 없는 항목(정산 등)은 뒤로.
      .order('tour_date', { ascending: true, nullsFirst: false })
      .order('severity', { ascending: true })
      .limit(500);
    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/tour-ops/autopilot]', error);
      return NextResponse.json({ error: '제안 목록을 불러오지 못했습니다', details: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    return NextResponse.json({
      data: rows,
      openCount: rows.filter((r: { status: string }) => r.status === 'suggested').length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/autopilot]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const horizonRaw = body?.horizonDays;
    const horizonDays =
      typeof horizonRaw === 'number' && Number.isFinite(horizonRaw)
        ? Math.min(Math.max(Math.floor(horizonRaw), 1), 90)
        : DEFAULT_HORIZON_DAYS;

    const supabase = createServerClient();
    const result = await runAutopilot(supabase, { today: kstToday(), horizonDays });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/tour-ops/autopilot]', msg);
    return NextResponse.json({ error: '점검에 실패했습니다', details: msg }, { status: 500 });
  }
}
