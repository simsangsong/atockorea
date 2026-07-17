import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveDaySchedule } from '@/lib/tour-room/dayPlan';
import { roomLifecycle } from '@/lib/tour-room/time';
import { verifyRoomToken } from '@/lib/tour-room/token';

export const dynamic = 'force-dynamic';

/**
 * W3 (P-D15) — the driver console's PII-minimal data bundle for one tour day.
 *
 * GET /api/tour-mode/driver/overview?rt=<driver token>
 *
 * Unlike the guide overview this returns NO contact names, languages, or
 * message excerpts — only what a driver needs: per-booking room handles,
 * guest counts, pickup stop (name/time/coords), and the resolver-chain day
 * schedule enriched with match_pois coords for the nav deep links (W3.2).
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    const token = req.nextUrl.searchParams.get('rt') ?? req.headers.get('x-tour-room-token');
    const payload = token ? verifyRoomToken(token) : null;
    if (payload?.scope !== 'tour-date' || payload.role !== 'driver') {
      return NextResponse.json({ error: 'A driver tour-date token is required' }, { status: 403 });
    }
    const { tourId, tourDate } = payload;

    const [{ data: tour }, { data: bookings }] = await Promise.all([
      supabase.from('tours').select('id, title, city').eq('id', tourId).single(),
      supabase
        .from('bookings')
        .select('id, number_of_guests, tour_date, itinerary, pickup_points ( name, lat, lng, pickup_time ), tours ( schedule )')
        .eq('tour_id', tourId)
        .eq('tour_date', tourDate)
        .neq('status', 'cancelled'),
    ]);

    const rooms = [] as Array<Record<string, unknown>>;
    for (const booking of bookings ?? []) {
      const tourRaw = (booking as { tours?: unknown }).tours;
      const tourJoin = (Array.isArray(tourRaw) ? tourRaw[0] : tourRaw) as { schedule?: unknown } | null;
      const resolved = await resolveDaySchedule(supabase, {
        bookingId: booking.id,
        tourDate,
        itinerary: (booking as { itinerary?: unknown }).itinerary ?? null,
        tourSchedule: tourJoin?.schedule,
      });

      // Nav coords (W3.2): match_pois lat/lng for poi-keyed schedule items.
      const poiKeys = resolved.schedule
        .map((item) => (typeof item.poi_key === 'string' ? item.poi_key : null))
        .filter((key): key is string => Boolean(key));
      const coordsByKey: Record<string, { lat: number; lng: number }> = {};
      if (poiKeys.length > 0) {
        try {
          const { data: pois } = await supabase
            .from('match_pois')
            .select('poi_key, lat, lng')
            .in('poi_key', [...new Set(poiKeys)]);
          for (const poi of (pois ?? []) as Array<{ poi_key: string; lat: number | null; lng: number | null }>) {
            if (typeof poi.lat === 'number' && typeof poi.lng === 'number') {
              coordsByKey[poi.poi_key] = { lat: poi.lat, lng: poi.lng };
            }
          }
        } catch {
          // nav links degrade to hidden — never block the bundle
        }
      }

      const pickupRaw = (booking as { pickup_points?: unknown }).pickup_points;
      const pickup = (Array.isArray(pickupRaw) ? pickupRaw[0] : pickupRaw) as
        | { name?: string; lat?: number; lng?: number; pickup_time?: string }
        | null;

      rooms.push({
        booking_id: booking.id,
        number_of_guests: (booking as { number_of_guests?: number | null }).number_of_guests ?? null,
        pickup: pickup ? { name: pickup.name ?? null, lat: pickup.lat ?? null, lng: pickup.lng ?? null, pickup_time: pickup.pickup_time ?? null } : null,
        schedule_source: resolved.source,
        schedule: resolved.schedule.map((item) => ({
          ...item,
          ...(typeof item.poi_key === 'string' && coordsByKey[item.poi_key] ? coordsByKey[item.poi_key] : {}),
        })),
      });
    }

    return NextResponse.json({
      tour: tour ?? { id: tourId, title: 'Tour', city: null },
      tour_date: tourDate,
      lifecycle: roomLifecycle(tourDate),
      driver_name: payload.displayName,
      rooms,
    });
  } catch (error) {
    console.error('GET /api/tour-mode/driver/overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
