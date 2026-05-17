// GET /api/admin/analytics/funnels
// List all funnels with last-7d step-1 / step-final completion rates.

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
  const { data, error } = await supabase
    .from('analytics_funnels')
    .select('key, name, description, steps, conversion_window_seconds, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const funnels = (data ?? []).map((f) => ({
    key: f.key,
    name: f.name,
    description: f.description,
    step_count: Array.isArray(f.steps) ? f.steps.length : 0,
    conversion_window_seconds: f.conversion_window_seconds,
    updated_at: f.updated_at,
  }));

  return NextResponse.json({ funnels });
}
