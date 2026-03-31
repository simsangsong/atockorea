import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pois
 * Query: search, region_group, manual_hidden, sort, order, limit, offset, has_image, has_overview, boosted
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const region = searchParams.get('region_group')?.trim();
    const hidden = searchParams.get('manual_hidden');
    const sort = searchParams.get('sort') || 'base_score';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '40', 10) || 40));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const hasImage = searchParams.get('has_image');
    const hasOverview = searchParams.get('has_overview');
    const boosted = searchParams.get('boosted');

    let q = supabase.from('jeju_kor_tourapi_places').select('*', { count: 'exact' });

    if (search) {
      const pat = `%${search}%`;
      q = q.or(`title.ilike.${pat},addr1.ilike.${pat}`);
    }
    if (region) q = q.eq('region_group', region);
    if (hidden === 'true') q = q.eq('manual_hidden', true);
    if (hidden === 'false') q = q.or('manual_hidden.eq.false,manual_hidden.is.null');

    if (hasImage === '1') {
      q = q.not('first_image', 'is', null);
    }
    if (hasOverview === '1') {
      q = q.not('overview', 'is', null);
    }
    if (boosted === '1') {
      q = q.gt('manual_boost_score', 0);
    }

    const sortCol =
      sort === 'title'
        ? 'title'
        : sort === 'manual_priority'
          ? 'manual_priority'
          : sort === 'manual_boost_score'
            ? 'manual_boost_score'
            : sort === 'updated_at'
              ? 'updated_at'
              : 'base_score';

    q = q.order(sortCol, { ascending: order === 'asc', nullsFirst: false });

    const { data, error, count } = await q.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 },
    );
  }
}
