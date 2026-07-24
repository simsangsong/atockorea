import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import { MAX_RANGE_DAYS, expandDateRange, isValidYmd, monthBounds } from '@/lib/ops/guides/availability';

export const dynamic = 'force-dynamic';

/**
 * 가이드 휴무 등록·해제 (§11.F).
 *
 *   GET    /api/admin/guides/[id]/unavailable?year=&month=   (또는 ?from=&to=)
 *   POST   /api/admin/guides/[id]/unavailable                {date} 또는 {from,to}
 *   DELETE /api/admin/guides/[id]/unavailable?date=          (또는 ?from=&to=)
 *
 * 기간 일괄 등록은 범위를 하루씩 펼쳐 upsert한다 — UNIQUE(guide_id, date) 덕분에
 * 재등록이 멱등하고, 해제는 그냥 행 삭제다. 범위 상한(MAX_RANGE_DAYS)을 넘거나
 * 역순이면 조용히 자르지 않고 400으로 거절한다: 부분 등록은 "등록했다"는 착각을
 * 남기고, 그 착각의 대가는 배정 사고다.
 */

function rangeFromQuery(req: NextRequest): { from: string; to: string } | null {
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get('year'));
  const month = Number(sp.get('month'));
  if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
    const { first, last } = monthBounds(year, month);
    return { from: first, to: last };
  }
  const from = sp.get('from');
  const to = sp.get('to');
  if (from && isValidYmd(from) && to && isValidYmd(to)) return { from, to };
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const range = rangeFromQuery(req);
    const supabase = createServerClient();
    let query = supabase
      .from('ops_guide_unavailable_dates')
      .select('id, date, reason, source, created_at')
      .eq('tenant_id', GUIDES_TENANT_ID)
      .eq('guide_id', id)
      .order('date', { ascending: true })
      .limit(1000);
    if (range) query = query.gte('date', range.from).lte('date', range.to);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/guides/:id/unavailable]', error);
      return NextResponse.json({ error: '휴무를 불러오지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], range });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides/:id/unavailable]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const from = typeof body.from === 'string' ? body.from : typeof body.date === 'string' ? body.date : '';
    const to = typeof body.to === 'string' ? body.to : null;
    const dates = expandDateRange(from, to);
    if (dates.length === 0) {
      return NextResponse.json(
        { error: `날짜를 확인해 주세요 (YYYY-MM-DD, 시작 ≤ 종료, 최대 ${MAX_RANGE_DAYS}일)` },
        { status: 400 },
      );
    }
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guide_unavailable_dates')
      .upsert(
        dates.map((date) => ({
          tenant_id: GUIDES_TENANT_ID,
          guide_id: id,
          date,
          reason,
          source: 'admin',
        })),
        { onConflict: 'guide_id,date' },
      )
      .select('id, date, reason, source');
    if (error) {
      console.error('[POST /api/admin/guides/:id/unavailable]', error);
      return NextResponse.json({ error: '휴무를 등록하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: dates.length, data: data ?? [] }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/:id/unavailable]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const sp = req.nextUrl.searchParams;
    const single = sp.get('date');
    const from = single ?? sp.get('from') ?? '';
    const to = single ?? sp.get('to');
    const dates = expandDateRange(from, to);
    if (dates.length === 0) {
      return NextResponse.json({ error: '해제할 날짜를 지정해 주세요 (?date= 또는 ?from=&to=)' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('ops_guide_unavailable_dates')
      .delete()
      .eq('tenant_id', GUIDES_TENANT_ID)
      .eq('guide_id', id)
      .in('date', dates);
    if (error) {
      console.error('[DELETE /api/admin/guides/:id/unavailable]', error);
      return NextResponse.json({ error: '휴무를 해제하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: dates.length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/guides/:id/unavailable]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
