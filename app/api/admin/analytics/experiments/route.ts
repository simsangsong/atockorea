// GET /api/admin/analytics/experiments      → list all experiments
// POST /api/admin/analytics/experiments     → create a new experiment

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VariantSchema = z.object({
  key: z.string().min(1).max(32),
  weight: z.number().int().min(0).max(100),
  label: z.string().max(64).optional(),
});

const CreateSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[a-z0-9_-]+$/),
  description: z.string().max(512).optional(),
  status: z.enum(['draft', 'running', 'paused', 'concluded']).default('draft'),
  variants: z.array(VariantSchema).min(2),
  primary_metric_funnel_key: z.string().max(64).nullable().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('analytics_experiments')
    .select(
      'key, description, status, variants, primary_metric_funnel_key, start_date, end_date, conclusion_notes, created_at, updated_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiments: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_schema', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Weights should sum to 100
  const weightSum = parsed.data.variants.reduce((s, v) => s + v.weight, 0);
  if (weightSum !== 100) {
    return NextResponse.json(
      { error: 'weight_sum_invalid', expected: 100, got: weightSum },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('analytics_experiments')
    .insert({
      key: parsed.data.key,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      variants: parsed.data.variants,
      primary_metric_funnel_key: parsed.data.primary_metric_funnel_key ?? null,
      start_date: parsed.data.status === 'running' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiment: data }, { status: 201 });
}
