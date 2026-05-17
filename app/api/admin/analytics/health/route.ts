// GET /api/admin/analytics/health
// Single round-trip ingestion health snapshot for the admin Health page.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('analytics_health_snapshot');
  if (error) {
    return NextResponse.json(
      { error: 'rpc_failed', message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ snapshot: data });
}
