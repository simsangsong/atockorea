// GET /api/cron/analytics-refresh-views
// Hourly Vercel cron. Refreshes the materialized views that back the
// admin analytics dashboards.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed: a missing CRON_SECRET must reject, never run unguarded (N23).
  if (!secret) return false;
  // Only the Authorization header is accepted — no `?secret=` query fallback
  // (W-3: query strings leak via logs/Referer). Vercel Cron sets this header.
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
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
