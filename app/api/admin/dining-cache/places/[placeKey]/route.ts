import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { blockPlace } from '@/lib/ops/dining/cache.server';

export const dynamic = 'force-dynamic';

/**
 * Admin place-level actions (§5.7 R-9 / K6 — the manual half of the "no blanket
 * review gate" bargain).
 *
 *   PATCH /api/admin/dining-cache/places/[placeKey]  → { action, reopen? }
 *     `block`   / `unblock`  → `blockPlace` (slice A). A blocked place never
 *                              reaches a guest again, whatever its rating.
 *     `resolve-report`       → reset `reported_wrong_count` to 0, clearing the
 *                              queue entry when the reports turned out to be
 *                              wrong (or the underlying data has been fixed).
 *
 * `resolve-report` deliberately does NOT clear `is_closed` by default: one
 * guest standing in front of a shuttered restaurant is better evidence than an
 * operator's guess, so re-opening a place has to be asked for explicitly with
 * `{ reopen: true }`. Without that escape hatch a wrongly-closed place could
 * never leave the queue.
 */

const PLACE_TABLE = 'ops_kakao_place_cache';

const SELECT_COLUMNS =
  'place_key, cell, name, rating, review_count, reported_wrong_count, is_blocked, is_closed, updated_at';

const ACTIONS = new Set(['block', 'unblock', 'resolve-report']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ placeKey: string }> }) {
  try {
    await requireAdmin(req);
    const { placeKey } = await params;
    const key = decodeURIComponent(placeKey ?? '').trim();
    if (!key) return NextResponse.json({ error: 'placeKey is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: 'action must be block, unblock or resolve-report' }, { status: 400 });
    }

    const supabase = createServerClient();

    if (action === 'block' || action === 'unblock') {
      const ok = await blockPlace(supabase, key, action === 'block');
      if (!ok) return NextResponse.json({ error: `Failed to ${action} the place` }, { status: 500 });
      return NextResponse.json({ ok: true, action, place_key: key, is_blocked: action === 'block' });
    }

    const patch: Record<string, unknown> = {
      reported_wrong_count: 0,
      updated_at: new Date().toISOString(),
    };
    if (body?.reopen === true) patch.is_closed = false;

    const { data, error } = await supabase
      .from(PLACE_TABLE)
      .update(patch)
      .eq('place_key', key)
      .select(SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[PATCH /api/admin/dining-cache/places]', error);
      return NextResponse.json({ error: 'Failed to resolve the report', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

    return NextResponse.json({ ok: true, action, place_key: key, data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/dining-cache/places]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
