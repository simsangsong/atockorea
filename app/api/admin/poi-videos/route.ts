import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Admin POI-video review API (video W3 / VP-D10 approval gate).
 *
 *   GET /api/admin/poi-videos?status=pending_review|approved|rejected|all
 *     → rows newest-first (default: pending_review, the review queue).
 *
 * Rows are created by `npm run video:upload` (never by this API); the only
 * mutation is the status transition in [id]/route.ts. The table is
 * service-role-only, so all access is admin-gated here.
 */

const SELECT_COLUMNS =
  'id, poi_key, language, version, video_url, poster_url, duration_seconds, status, qc, created_at, reviewed_at, reviewed_by';

const STATUSES = new Set(['pending_review', 'approved', 'rejected']);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const statusParam = req.nextUrl.searchParams.get('status')?.trim() || 'pending_review';
    if (statusParam !== 'all' && !STATUSES.has(statusParam)) {
      return NextResponse.json({ error: 'status must be pending_review, approved, rejected, or all' }, { status: 400 });
    }
    const supabase = createServerClient();
    let query = supabase
      .from('poi_videos')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(300);
    if (statusParam !== 'all') query = query.eq('status', statusParam);
    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/poi-videos]', error);
      return NextResponse.json({ error: 'Failed to load videos', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], count: (data ?? []).length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/poi-videos]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
