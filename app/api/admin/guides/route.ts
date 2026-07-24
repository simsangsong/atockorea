import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  GUIDE_SELECT_COLUMNS,
  GUIDES_TENANT_ID,
  buildGuideWrite,
  toGuideResponse,
  type GuideRow,
} from '@/lib/ops/guides/registry';
import { piiEncryptionAvailable } from '@/lib/ops/guides/pii';
import { kstToday, monthBounds } from '@/lib/ops/guides/availability';

export const dynamic = 'force-dynamic';

/**
 * 가이드 원장 목록·생성 (§6.9).
 *
 *   GET  /api/admin/guides?active=all|true|false&q=
 *   POST /api/admin/guides
 *
 * 응답에는 **마스킹된 값만** 실린다 — GUIDE_SELECT_COLUMNS에 `*_enc`가 없으므로
 * 봉투는 이 프로세스 메모리에도 올라오지 않는다(바인딩 결정 2). 평문 열람은
 * [id]/reveal 라우트가 감사로그를 남기면서만 한다.
 *
 * `piiKeyConfigured`를 함께 돌려주는 이유: 키가 없으면 화면이 주민번호·계좌 칸을
 * 미리 잠그고 안내를 띄운다. 저장 시점에 400을 맞고 나서야 알게 되는 것보다 낫다.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const activeParam = req.nextUrl.searchParams.get('active') ?? 'true';
    const q = req.nextUrl.searchParams.get('q')?.trim();

    let query = supabase
      .from('ops_guides')
      .select(GUIDE_SELECT_COLUMNS)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .order('active', { ascending: false })
      .order('name', { ascending: true })
      .limit(500);
    if (activeParam === 'true') query = query.eq('active', true);
    else if (activeParam === 'false') query = query.eq('active', false);
    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/guides]', error);
      return NextResponse.json({ error: '가이드 목록을 불러오지 못했습니다', details: error.message }, { status: 500 });
    }

    const guides = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toGuideResponse) as GuideRow[];

    // 이번 달 휴무 일수 — 목록에서 "이 사람 이번달 얼마나 쉬나"를 바로 본다.
    // (배정 건수는 가이드↔룸 배정 원장이 생기는 정산 슬라이스에서 붙는다.)
    const today = kstToday();
    const [year, month] = today.split('-').map(Number);
    const { first, last } = monthBounds(year, month);
    const offCounts = new Map<string, number>();
    if (guides.length > 0) {
      const { data: off } = await supabase
        .from('ops_guide_unavailable_dates')
        .select('guide_id, date')
        .eq('tenant_id', GUIDES_TENANT_ID)
        .gte('date', first)
        .lte('date', last);
      for (const row of (off ?? []) as Array<{ guide_id: string }>) {
        offCounts.set(row.guide_id, (offCounts.get(row.guide_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      data: guides.map((g) => ({ ...g, unavailable_this_month: offCounts.get(g.id) ?? 0 })),
      count: guides.length,
      month: `${year}-${String(month).padStart(2, '0')}`,
      piiKeyConfigured: piiEncryptionAvailable(),
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildGuideWrite(body, 'create');
    if (!built.ok) {
      return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guides')
      .insert({ tenant_id: GUIDES_TENANT_ID, ...built.fields })
      .select(GUIDE_SELECT_COLUMNS)
      .single();
    if (error) {
      console.error('[POST /api/admin/guides]', error);
      return NextResponse.json({ error: '가이드를 등록하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: toGuideResponse(data as Record<string, unknown>) }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
