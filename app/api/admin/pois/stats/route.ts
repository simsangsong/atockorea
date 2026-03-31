import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { count: total } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*', { count: 'exact', head: true });

    const { count: hidden } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*', { count: 'exact', head: true })
      .eq('manual_hidden', true);

    const { count: noImage } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*', { count: 'exact', head: true })
      .is('first_image', null);

    const { count: noTime } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*', { count: 'exact', head: true })
      .is('use_time_text', null);

    const { count: withAdminNote } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*', { count: 'exact', head: true })
      .not('admin_note_ko', 'is', null);

    const { count: boosted } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('*', { count: 'exact', head: true })
      .gt('manual_boost_score', 0);

    const { data: topRows } = await supabase
      .from('jeju_kor_tourapi_places')
      .select('id, title, base_score, region_group')
      .order('base_score', { ascending: false, nullsFirst: false })
      .limit(20);

    const { data: regionRows } = await supabase.from('jeju_kor_tourapi_places').select('region_group');

    const byRegion: Record<string, number> = {};
    for (const r of regionRows ?? []) {
      const k = (r as { region_group: string | null }).region_group || 'unknown';
      byRegion[k] = (byRegion[k] || 0) + 1;
    }

    return NextResponse.json({
      total: total ?? 0,
      hidden: hidden ?? 0,
      missingImage: noImage ?? 0,
      missingUseTime: noTime ?? 0,
      withAdminNoteKo: withAdminNote ?? 0,
      boostedCount: boosted ?? 0,
      regionCounts: byRegion,
      topByScore: topRows ?? [],
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 },
    );
  }
}
