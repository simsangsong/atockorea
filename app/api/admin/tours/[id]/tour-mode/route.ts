import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

/**
 * GET  /api/admin/tours/[id]/tour-mode — tour_guide_spots + tour_facilities.
 * PUT  /api/admin/tours/[id]/tour-mode — T4.2: upsert/delete geofence spots
 *      (title, coordinates, radii, poi_key, per-locale content jsonb). The
 *      snapshot API reads these live, so a save is immediately visible to
 *      the next room join (AC).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const resolvedParams = await params;
    const tourId = resolvedParams.id;
    const supabase = createServerClient();

    const { data: tour } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .single();

    if (!tour) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }

    const [spotsRes, facilitiesRes] = await Promise.all([
      supabase
        .from('tour_guide_spots')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tour_facilities')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true }),
    ]);

    if (spotsRes.error) throw spotsRes.error;
    if (facilitiesRes.error) throw facilitiesRes.error;

    return NextResponse.json({
      tour_guide_spots: spotsRes.data ?? [],
      tour_facilities: facilitiesRes.data ?? [],
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

interface SpotInput {
  id?: string;
  title?: unknown;
  description?: unknown;
  audio_url?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  trigger_radius_m?: unknown;
  exit_radius_m?: unknown;
  sort_order?: unknown;
  poi_key?: unknown;
  content?: unknown;
}

function validateSpot(input: SpotInput, index: number): { row: Record<string, unknown> } | { error: string } {
  const title = String(input.title ?? '').trim();
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const triggerRadius = Number(input.trigger_radius_m);
  if (!title) return { error: `spots[${index}]: title is required` };
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return { error: `spots[${index}]: invalid latitude` };
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return { error: `spots[${index}]: invalid longitude` };
  if (!Number.isFinite(triggerRadius) || triggerRadius < 10 || triggerRadius > 5000) {
    return { error: `spots[${index}]: trigger_radius_m must be 10–5000` };
  }
  const exitRadius = input.exit_radius_m === null || input.exit_radius_m === undefined || input.exit_radius_m === ''
    ? null
    : Number(input.exit_radius_m);
  if (exitRadius !== null && (!Number.isFinite(exitRadius) || exitRadius <= triggerRadius)) {
    return { error: `spots[${index}]: exit_radius_m must exceed trigger_radius_m (or be empty)` };
  }
  const content = input.content ?? {};
  if (typeof content !== 'object' || Array.isArray(content)) {
    return { error: `spots[${index}]: content must be a JSON object keyed by locale` };
  }
  return {
    row: {
      title,
      description: input.description ? String(input.description) : null,
      audio_url: input.audio_url ? String(input.audio_url) : null,
      latitude,
      longitude,
      trigger_radius_m: Math.round(triggerRadius),
      exit_radius_m: exitRadius === null ? null : Math.round(exitRadius),
      sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : index + 1,
      poi_key: input.poi_key ? String(input.poi_key) : null,
      content,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id: tourId } = await params;
    const supabase = createServerClient();

    const { data: tour } = await supabase.from('tours').select('id').eq('id', tourId).single();
    if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as {
      spots?: SpotInput[];
      deleteIds?: string[];
    };
    const spots = Array.isArray(body.spots) ? body.spots : [];
    const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.map(String) : [];

    const updates: Array<{ id: string; row: Record<string, unknown> }> = [];
    const inserts: Array<Record<string, unknown>> = [];
    for (const [index, input] of spots.entries()) {
      const validated = validateSpot(input, index);
      if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
      if (input.id) updates.push({ id: String(input.id), row: validated.row });
      else inserts.push({ ...validated.row, tour_id: tourId });
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('tour_guide_spots')
        .update(update.row)
        .eq('id', update.id)
        .eq('tour_id', tourId); // never cross-tour
      if (error) throw error;
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from('tour_guide_spots').insert(inserts);
      if (error) throw error;
    }
    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from('tour_guide_spots')
        .delete()
        .in('id', deleteIds)
        .eq('tour_id', tourId);
      if (error) throw error;
    }

    const { data: refreshed, error: refetchError } = await supabase
      .from('tour_guide_spots')
      .select('*')
      .eq('tour_id', tourId)
      .order('sort_order', { ascending: true });
    if (refetchError) throw refetchError;

    return NextResponse.json({ tour_guide_spots: refreshed ?? [] });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
