import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import { DEFAULT_TTL_SECONDS, signGuideScheduleToken } from '@/lib/ops/guides/selfToken';

export const dynamic = 'force-dynamic';

/**
 * 셀프 스케줄 링크 발급 (§11.F).
 *
 *   POST /api/admin/guides/[id]/schedule-link  {ttlDays?}
 *   → { url, expiresAt }
 *
 * 발송은 하지 않는다. 관리자가 링크를 복사해 카톡·문자로 직접 보낸다 — 가이드
 * 연락처는 이미 사람이 알고 있고, 자동 발송을 붙이는 순간 "누구에게 갔는지"를
 * 이 시스템이 책임져야 한다. 이 슬라이스의 범위는 데이터 관리까지다.
 */

const MAX_TTL_DAYS = 365;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ttlDaysRaw = Number(body.ttlDays);
    const ttlSeconds =
      Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0
        ? Math.min(Math.floor(ttlDaysRaw), MAX_TTL_DAYS) * 24 * 60 * 60
        : DEFAULT_TTL_SECONDS;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guides')
      .select('id, name, active')
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .maybeSingle();
    if (error) {
      console.error('[POST /api/admin/guides/:id/schedule-link]', error);
      return NextResponse.json({ error: '가이드를 불러오지 못했습니다', details: error.message }, { status: 500 });
    }
    const guide = data as { id: string; name: string; active: boolean } | null;
    if (!guide) return NextResponse.json({ error: '가이드를 찾을 수 없습니다' }, { status: 404 });

    const { token, payload } = signGuideScheduleToken({
      guideId: guide.id,
      name: guide.name,
      ttlSeconds,
    });

    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || req.nextUrl.origin;
    return NextResponse.json({
      url: `${origin}/g/schedule/${token}`,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      guide: { id: guide.id, name: guide.name, active: guide.active },
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/:id/schedule-link]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
