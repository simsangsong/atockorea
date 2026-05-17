// GET /api/cron/analytics-refresh-views
// Hourly Vercel cron. Refreshes the materialized views that back the
// admin analytics dashboards.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev fallback
  const header = req.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  const query = req.nextUrl.searchParams.get('secret');
  if (query === secret) return true;
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const startedAt = Date.now();
  const { data, error } = await supabase.rpc('refresh_analytics_materialized_views');

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'rpc_failed', message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    result: data,
  });
}
