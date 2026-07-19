import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { loadTourItineraryStopsBySlug } from '@/lib/tour-product/loadTourProductPage';

export const dynamic = 'force-dynamic';

/**
 * Plan §G tab ① — the BOOKED tour's own itinerary, served to the D-1 planner so
 * the "이 투어 추천 일정" section can render the same rich stop cards + drawer as
 * the product detail page (reusing the shared TourStopDetailDrawer).
 *
 * Read-only, any room actor (the same signed x-tour-room-auth session the
 * planner already holds). Pickup/return pseudo-stops (`_role`) are stripped —
 * they aren't wish-list stops, and the product timeline hides them too. Empty
 * stops (tour has no built detail page) → the planner falls back to the generic
 * course templates, so this never blocks the editor.
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

    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('tours ( slug, title )')
      .eq('id', booking.id)
      .maybeSingle();
    const tourRaw = (bookingRow as { tours?: unknown } | null)?.tours;
    const tour = (Array.isArray(tourRaw) ? tourRaw[0] : tourRaw) as
      | { slug?: string | null; title?: string | null }
      | null;
    const slug = typeof tour?.slug === 'string' ? tour.slug : null;
    if (!slug) {
      return NextResponse.json({ stops: [], tourTitle: tour?.title ?? null, slug: null });
    }

    const locale = normalizeRoomLocale(
      req.nextUrl.searchParams.get('locale'),
      normalizeRoomLocale(booking.preferred_language),
    );
    const allStops = await loadTourItineraryStopsBySlug(supabase, slug, locale).catch(() => []);
    // Pickup / drop-off pseudo-stops aren't wish-list places (the product
    // timeline renders them via dedicated cards, then strips them).
    const stops = allStops.filter((s) => s._role !== 'pickup' && s._role !== 'dropoff');

    return NextResponse.json({ stops, tourTitle: tour?.title ?? null, slug });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/tour-itinerary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
