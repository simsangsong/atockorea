import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * X18 — read the learned travel matrix.
 *
 *   GET /api/admin/travel-matrix → { rows, stats }
 *
 * `poi_travel_matrix` decides whether an ETA is "we have driven this leg N
 * times" or "straight line × 1.55". It has been written by the weekly flywheel
 * since W5 and read by the ETA resolver, and until now nobody could look at it.
 *
 * 🔴 The arrival counts are part of the payload, not a debug extra. "0 rows"
 * has two readings — a broken learner, or nothing to learn from — and they lead
 * to opposite next actions. Measured 2026-07-31: matrix 0 rows AND 0 arrivals
 * of either kind, ever, which settles it as the second. Both counts are
 * returned so the screen can say which.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    throw error;
  }

  try {
    const supabase = createServerClient();
    const [{ data: rows, error }, manual, geofence] = await Promise.all([
      supabase
        .from('poi_travel_matrix')
        .select('from_key, to_key, daypart, minutes_p50, samples, updated_at')
        .order('samples', { ascending: false })
        .limit(500),
      supabase
        .from('tour_room_events')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'manual_arrival'),
      supabase
        .from('tour_room_spot_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'arrived'),
    ]);
    if (error) throw error;

    const matrix = rows ?? [];
    return NextResponse.json({
      rows: matrix,
      stats: {
        legs: matrix.length,
        samples: matrix.reduce((sum, row) => sum + (Number(row.samples) || 0), 0),
        arrivals: {
          manual: manual.count ?? 0,
          geofence: geofence.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/admin/travel-matrix error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
