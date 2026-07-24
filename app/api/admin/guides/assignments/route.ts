import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import {
  ASSIGNMENT_SELECT_COLUMNS,
  buildAssignmentWrite,
  isValidPeriod,
  isValidYmd,
  periodDateBounds,
  type AssignmentRow,
} from '@/lib/ops/tax/assignments';

export const dynamic = 'force-dynamic';

/**
 * 가이드 × 투어 배정 원장 (§6.9).
 *
 *   GET  /api/admin/guides/assignments?period=YYYY-MM | ?date=YYYY-MM-DD
 *                                     [&guideId=][&status=worked|planned|cancelled|all]
 *   POST /api/admin/guides/assignments
 *
 * 이 원장이 없으면 월 정산 배치가 돌 데이터가 없다 — tour_rooms에는 guide_id가
 * 없고 가이드는 초대 링크로만 다뤄졌기 때문이다. **status='worked'인 행만 정산
 * 대상**이므로 "일했다" 표시는 사람이 명시적으로 해야 한다.
 *
 * 응답에 가이드 이름을 붙이지만 PII(주민번호·계좌)는 조회조차 하지 않는다 —
 * 배정 화면이 그 정보를 쓸 일이 없다.
 */

/** 목록에 붙일 가이드 이름 — PII 아닌 최소 필드만. */
async function guideNames(
  supabase: ReturnType<typeof createServerClient>,
  guideIds: string[],
): Promise<Map<string, { name: string; guideType: string | null }>> {
  const map = new Map<string, { name: string; guideType: string | null }>();
  if (guideIds.length === 0) return map;
  const { data } = await supabase
    .from('ops_guides')
    .select('id, name, guide_type')
    .in('id', [...new Set(guideIds)]);
  for (const row of (data ?? []) as Array<{ id: string; name: string; guide_type: string | null }>) {
    map.set(row.id, { name: row.name, guideType: row.guide_type });
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const period = sp.get('period');
    const date = sp.get('date');
    const guideId = sp.get('guideId')?.trim();
    const status = sp.get('status') ?? 'all';

    const supabase = createServerClient();
    let query = supabase
      .from('ops_guide_assignments')
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .order('tour_date', { ascending: true })
      .limit(1000);

    if (date) {
      if (!isValidYmd(date)) {
        return NextResponse.json({ error: 'date=YYYY-MM-DD 가 필요합니다' }, { status: 400 });
      }
      query = query.eq('tour_date', date);
    } else if (period) {
      if (!isValidPeriod(period)) {
        return NextResponse.json({ error: 'period=YYYY-MM 가 필요합니다' }, { status: 400 });
      }
      const { first, last } = periodDateBounds(period);
      query = query.gte('tour_date', first).lte('tour_date', last);
    }
    if (guideId) query = query.eq('guide_id', guideId);
    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/guides/assignments]', error);
      return NextResponse.json(
        { error: '배정 목록을 불러오지 못했습니다', details: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as unknown as AssignmentRow[];
    const names = await guideNames(supabase, rows.map((r) => r.guide_id));

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        guide_name: names.get(r.guide_id)?.name ?? null,
        guide_type: names.get(r.guide_id)?.guideType ?? null,
      })),
      count: rows.length,
      workedCount: rows.filter((r) => r.status === 'worked').length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides/assignments]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildAssignmentWrite(body, 'create');
    if (!built.ok) {
      return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guide_assignments')
      .insert({ tenant_id: GUIDES_TENANT_ID, ...built.fields })
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .single();

    if (error) {
      // UNIQUE(guide_id, tour_date, booking_id) — 같은 예약에 같은 사람을 두 번.
      if (/duplicate key|unique/i.test(error.message ?? '')) {
        return NextResponse.json(
          { error: '이 가이드는 그 날짜의 같은 예약에 이미 배정되어 있어요.', code: 'duplicate' },
          { status: 409 },
        );
      }
      console.error('[POST /api/admin/guides/assignments]', error);
      return NextResponse.json({ error: '배정을 저장하지 못했습니다', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/assignments]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
