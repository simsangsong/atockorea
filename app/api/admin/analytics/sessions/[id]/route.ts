// GET /api/admin/analytics/sessions/[id]
// Returns the session row + its full chronological event timeline.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS_PER_SESSION = 2_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const { id } = await params;

  const supabase = createServerClient();
  const [sess, evs] = await Promise.all([
    supabase
      .from('analytics_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('analytics_events')
      .select(
        'event_name, payload, page_path, page_query, referrer, locale, device_class, viewport_width, country_code, utm_source, utm_medium, utm_campaign, server_ts',
      )
      .eq('session_id', id)
      .order('server_ts', { ascending: true })
      .limit(MAX_EVENTS_PER_SESSION),
  ]);

  if (sess.error) {
    return NextResponse.json(
      { error: 'session_query_failed', message: sess.error.message },
      { status: 500 },
    );
  }
  if (!sess.data) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }
  if (evs.error) {
    return NextResponse.json(
      { error: 'events_query_failed', message: evs.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    session: sess.data,
    events: evs.data ?? [],
    events_cap_hit: (evs.data ?? []).length >= MAX_EVENTS_PER_SESSION,
  });
}
