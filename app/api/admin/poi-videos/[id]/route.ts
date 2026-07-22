import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Admin POI-video status transition (video W3 / VP-D10 approval gate).
 *
 *   PATCH /api/admin/poi-videos/[id]  { status: 'approved' | 'rejected' | 'pending_review' }
 *
 * Approving a language render makes it servable in arrival cards; approving
 * also auto-rejects older approved versions of the same (poi_key, language)
 * so exactly one version serves per language.
 */

const SELECT_COLUMNS =
  'id, poi_key, language, version, video_url, poster_url, duration_seconds, status, qc, created_at, reviewed_at, reviewed_by';

const ALLOWED = new Set(['approved', 'rejected', 'pending_review']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!ALLOWED.has(status)) {
      return NextResponse.json({ error: 'status must be approved, rejected, or pending_review' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('poi_videos')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.email || 'admin',
      })
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();
    if (error || !data) {
      console.error('[PATCH /api/admin/poi-videos]', error);
      return NextResponse.json({ error: 'Failed to update video', details: error?.message }, { status: 500 });
    }

    // One approved version per (poi_key, language): retire older approvals.
    if (status === 'approved') {
      const row = data as { poi_key: string; language: string; id: string };
      await supabase
        .from('poi_videos')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: 'auto-supersede' })
        .eq('poi_key', row.poi_key)
        .eq('language', row.language)
        .eq('status', 'approved')
        .neq('id', row.id);
    }

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/poi-videos]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
