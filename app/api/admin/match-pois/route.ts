import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { getOverridePinnedKeys } from '@/lib/admin/poi-override-pins';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/match-pois
 *
 * Lists POI catalog rows for the admin editor's list pane. Returns a trimmed
 * shape (enough for the list item + region / is_attraction filters), never the
 * heavy jsonb bodies or the `embedding` vector.
 *
 * Catalog-junk rows whose poi_key starts with "_" (e.g. `_metadata`,
 * `_kb_metadata`) are filtered out server-side so they never appear as editable
 * POIs. Each returned row carries an `override_pinned` flag — see
 * lib/admin/poi-override-pins (no-op on `main` until the dq branch merges).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('match_pois')
      .select(
        'poi_key, name_en, name_ko, region, category, default_image_url, is_attraction, stop_role, lat, lng, updated_at',
      )
      .order('region', { ascending: true, nullsFirst: false })
      .order('poi_key', { ascending: true });

    if (error) {
      console.error('[GET /api/admin/match-pois]', error);
      return NextResponse.json(
        { error: 'Failed to load POIs', details: error.message },
        { status: 500 },
      );
    }

    const pinned = getOverridePinnedKeys();
    const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((r) => !String(r.poi_key).startsWith('_'))
      .map((r) => ({ ...r, override_pinned: pinned.has(String(r.poi_key)) }));

    return NextResponse.json({ data: rows, count: rows.length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/match-pois]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
