// GET /api/cron/analytics-anonymize
// Daily Vercel cron. Anonymizes rows older than 90 days:
//   - anonymous_id → SHA-256 hash (cohort math still works, identity lost)
//   - user_id → NULL
//   - referrer / utm_term / utm_content → NULL (lingering PII risk surfaces)
//   - anonymized_at stamped so the cron skips already-processed rows
// PIPA / GDPR retention compliance.

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

  const retentionParam = req.nextUrl.searchParams.get('retention_days');
  const retentionDays = retentionParam ? Math.max(1, parseInt(retentionParam, 10) || 90) : 90;

  const supabase = createServerClient();
  const startedAt = Date.now();
  const { data, error } = await supabase.rpc('anonymize_old_analytics', {
    retention_days: retentionDays,
  });

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
