import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import { isValidYmd } from '@/lib/ops/guides/availability';
import { recommendGuides } from '@/lib/ops/guides/recommend';

export const dynamic = 'force-dynamic';

/**
 * 배정 추천 (§11.F).
 *
 *   GET /api/admin/guides/recommend?date=YYYY-MM-DD&language=en&type=driver
 *       &assigned=<guideId,guideId>&limit=
 *
 * 휴무자는 **빠지지 않는다** — 맨 뒤로 밀리고 사유가 붙는다(trust-based NOTICE).
 * 배정 자체를 막는 것은 이 시스템의 일이 아니다.
 *
 * `assigned`는 화면이 "이 날짜에 방금 고른, 아직 저장 안 된 사람"을 알려주는
 * 파라미터다. 저장된 배정은 이제 ops_guide_assignments에서 직접 읽고 둘을
 * 합산한다(정산 슬라이스가 그 원장을 만들었다).
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const date = sp.get('date') ?? '';
    if (!isValidYmd(date)) {
      return NextResponse.json({ error: 'date=YYYY-MM-DD 가 필요합니다' }, { status: 400 });
    }

    const assignedCounts = new Map<string, number>();
    for (const raw of (sp.get('assigned') ?? '').split(',')) {
      const guideId = raw.trim();
      if (guideId) assignedCounts.set(guideId, (assignedCounts.get(guideId) ?? 0) + 1);
    }

    const limitRaw = Number(sp.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : undefined;

    const supabase = createServerClient();
    const recommendations = await recommendGuides(supabase, {
      tenantId: GUIDES_TENANT_ID,
      date,
      language: sp.get('language'),
      needType: sp.get('type'),
      assignedCounts,
      limit,
    });

    return NextResponse.json({
      date,
      data: recommendations,
      unavailableCount: recommendations.filter((r) => r.unavailable).length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides/recommend]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
