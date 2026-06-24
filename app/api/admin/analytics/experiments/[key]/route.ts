// GET /api/admin/analytics/experiments/[key]?range=7d|30d
//   Returns config + variant assignment counts + per-variant conversion stats
//   if a primary_metric_funnel_key is set.
//
// PATCH /api/admin/analytics/experiments/[key]
//   Update status (draft → running → paused → concluded) + conclusion_notes.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';
import { aggregateExperimentVariants, type ExperimentEvent } from '@/lib/analytics/experiment-stats';
import type { MatchableStep } from '@/lib/analytics/event-match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Range = '7d' | '30d';
function parseRange(value: string | null): Range {
  return value === '30d' ? '30d' : '7d';
}
function rangeStart(range: Range): string {
  const days = range === '7d' ? 7 : 30;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString();
}

const PatchSchema = z.object({
  status: z.enum(['draft', 'running', 'paused', 'concluded']).optional(),
  conclusion_notes: z.string().max(2048).nullable().optional(),
  primary_metric_funnel_key: z.string().max(64).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const { key } = await params;
  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const startIso = rangeStart(range);
  const supabase = createServerClient();

  const { data: exp, error: expErr } = await supabase
    .from('analytics_experiments')
    .select('*')
    .eq('key', key)
    .maybeSingle();
  if (expErr || !exp) {
    return NextResponse.json(
      { error: 'experiment_not_found', message: expErr?.message ?? 'unknown' },
      { status: 404 },
    );
  }

  const variants = (exp.variants as Array<{ key: string; weight: number; label?: string }>) ?? [];
  const expKey = exp.key as string;

  // Pull all events in window that have this experiment assignment set. payload +
  // context columns are needed so the conversion step's filter can be applied
  // (D-15: the conversion filter used to be dropped via `void conversionFilter`).
  const { data: evs, error: evErr } = await supabase
    .from('analytics_events')
    .select(
      'event_name, session_id, anonymous_id, experiment_assignments, server_ts, payload, page_path, locale, device_class',
    )
    .gte('server_ts', startIso)
    .not('experiment_assignments', 'is', null)
    .limit(200_000);
  if (evErr) {
    return NextResponse.json({ error: 'query_failed', message: evErr.message }, { status: 500 });
  }

  // Pull funnel definition if primary_metric_funnel_key is set. The conversion is
  // the funnel's final step (event name + filter).
  let conversionStep: MatchableStep | null = null;
  if (exp.primary_metric_funnel_key) {
    const { data: funnel } = await supabase
      .from('analytics_funnels')
      .select('steps')
      .eq('key', exp.primary_metric_funnel_key)
      .maybeSingle();
    const steps = (funnel?.steps as MatchableStep[]) ?? [];
    const last = steps[steps.length - 1];
    if (last) conversionStep = { event_name: last.event_name, filter: last.filter ?? null };
  }

  const { variant_stats, chi_square, pairwise_chi_square } = aggregateExperimentVariants(
    (evs ?? []) as ExperimentEvent[],
    expKey,
    variants,
    conversionStep,
  );

  return NextResponse.json({
    experiment: exp,
    range,
    start: startIso,
    conversion_event_name: conversionStep?.event_name ?? null,
    variant_stats,
    chi_square,
    pairwise_chi_square,
    summary: {
      events_scanned: (evs ?? []).length,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const { key } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_schema', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (parsed.data.status === 'running') updates.start_date = new Date().toISOString();
    if (parsed.data.status === 'concluded') updates.end_date = new Date().toISOString();
  }
  if (parsed.data.conclusion_notes !== undefined) {
    updates.conclusion_notes = parsed.data.conclusion_notes;
  }
  if (parsed.data.primary_metric_funnel_key !== undefined) {
    updates.primary_metric_funnel_key = parsed.data.primary_metric_funnel_key;
  }

  const { data, error } = await supabase
    .from('analytics_experiments')
    .update(updates)
    .eq('key', key)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiment: data });
}
