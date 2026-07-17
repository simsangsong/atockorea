import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { isRegionSlug } from '@/lib/itinerary-builder/regions';

export const dynamic = 'force-dynamic';

/**
 * W1.1 — recommended-course templates for the /plan editor's tab ①.
 *
 * Returns the course_templates rows for the booking's region (tours.city →
 * builder region slug), seeded from live tour itineraries (P-D14). Any room
 * actor may read — templates are curated public-ish content; the room gate
 * only prevents scraping outside a booking context.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking } = resolved;

    let region: string | null = null;
    if (booking.tour_id) {
      const { data } = await supabase
        .from('tours')
        .select('city')
        .eq('id', booking.tour_id)
        .maybeSingle();
      const slug = String((data as { city?: unknown } | null)?.city ?? '').trim().toLowerCase();
      region = isRegionSlug(slug) ? slug : null;
    }
    if (!region) {
      return NextResponse.json({ region: null, templates: [] });
    }

    const { data: templates, error } = await supabase
      .from('course_templates')
      .select('id, region, title_i18n, stops, total_hours, origin_tour_slug')
      .eq('region', region)
      .eq('is_active', true)
      .order('total_hours', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ region, templates: templates ?? [] });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/plan/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
