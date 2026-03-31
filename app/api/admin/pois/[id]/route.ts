import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { clampManualBoostScore } from '@/lib/jeju-poi-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pois/[id]  — id = bigint PK
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    const pk = parseInt(id, 10);
    if (!Number.isFinite(pk)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*')
      .eq('id', pk)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ row: data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/pois/[id]
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin(req);
    const { id } = await ctx.params;
    const pk = parseInt(id, 10);
    if (!Number.isFinite(pk)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));

    const patch: Record<string, unknown> = {};
    const str = (k: string) => {
      if (k in body) patch[k] = body[k] === '' ? null : body[k];
    };
    str('admin_note_ko');
    str('admin_note_en');
    str('admin_short_desc_ko');
    str('admin_short_desc_en');
    if ('recommended_duration_min' in body) {
      const n = body.recommended_duration_min;
      patch.recommended_duration_min =
        n === null || n === '' ? null : parseInt(String(n), 10);
    }
    if ('manual_priority' in body) patch.manual_priority = Number(body.manual_priority) || 0;
    if ('manual_boost_score' in body) {
      patch.manual_boost_score = clampManualBoostScore(body.manual_boost_score);
    }
    if ('manual_hidden' in body) patch.manual_hidden = Boolean(body.manual_hidden);
    if ('travel_value_score' in body) patch.travel_value_score = body.travel_value_score;
    if ('photo_score' in body) patch.photo_score = body.photo_score;
    if ('senior_score' in body) patch.senior_score = body.senior_score;
    if ('family_score' in body) patch.family_score = body.family_score;
    if ('couple_score' in body) patch.couple_score = body.couple_score;
    if ('rainy_day_score' in body) patch.rainy_day_score = body.rainy_day_score;
    if ('route_efficiency_score' in body) patch.route_efficiency_score = body.route_efficiency_score;
    if ('admin_tags' in body) {
      patch.admin_tags = Array.isArray(body.admin_tags) ? body.admin_tags : null;
    }

    patch.updated_by = user.id;
    patch.admin_updated_at = new Date().toISOString();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('jeju_kor_tourapi_places')
      .update(patch)
      .eq('id', pk)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 },
    );
  }
}
