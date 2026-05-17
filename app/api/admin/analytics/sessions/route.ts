// GET /api/admin/analytics/sessions?sort=recent|long|converted&range=7d|30d&limit=50

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Range = '7d' | '30d';
type Sort = 'recent' | 'long' | 'converted';

function parseRange(value: string | null): Range {
  return value === '30d' ? '30d' : '7d';
}
function parseSort(value: string | null): Sort {
  if (value === 'long' || value === 'converted') return value;
  return 'recent';
}
function rangeStart(range: Range): string {
  const days = range === '7d' ? 7 : 30;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const sort = parseSort(req.nextUrl.searchParams.get('sort'));
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 10),
    200,
  );

  const supabase = createServerClient();
  let query = supabase
    .from('analytics_sessions')
    .select(
      'id, anonymous_id, user_id, started_at, last_event_at, event_count, page_view_count, entry_path, entry_referrer, utm_source, utm_medium, device_class, viewport_width, locale, country_code, converted, converted_at, converted_event',
    )
    .gte('started_at', rangeStart(range));

  if (sort === 'recent') {
    query = query.order('started_at', { ascending: false });
  } else if (sort === 'long') {
    query = query.order('event_count', { ascending: false });
  } else if (sort === 'converted') {
    query = query.eq('converted', true).order('converted_at', { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ range, sort, limit, sessions: data ?? [] });
}
