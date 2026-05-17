// GET /api/analytics/experiments/active
// Public — the client SDK fetches this once at boot to learn which experiments
// are running. Returns just the assignment-relevant fields (no PII).

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('analytics_experiments')
    .select('key, variants')
    .eq('status', 'running');

  if (error) {
    return NextResponse.json(
      { experiments: [], error: 'query_failed', message: error.message },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      experiments: (data ?? []).map((e) => ({
        key: e.key,
        variants: e.variants,
      })),
    },
    {
      headers: {
        // Slow cache — variants change rarely. Vercel CDN respects this; SDK
        // also caches in memory per pageload.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
